/**
 * PermissionRequest hook — orchestrator delegation enforcement.
 *
 * Two responsibilities:
 *   1. DENY modifying Bash commands → forces delegation to sub-agents
 *   2. DENY Agent calls without subagent_type → forces specialist selection
 *   3. AUTO-ALLOW safe read-only and verification tools
 *
 * When harness mode is active (autopilot/loop), also auto-allows
 * Write/Edit/Agent so the workflow isn't interrupted.
 */
// Shell metacharacters that enable command chaining / injection
const DANGEROUS_SHELL_CHARS = /[;&|`$()<>\n\r\t\0\\{}\[\]*?~!#]/;
// Heredoc operator (<<, <<-, <<~)
const HEREDOC_PATTERN = /<<[-~]?\s*['"]?\w+['"]?/;
// Safe heredoc base commands (e.g. git commit with heredoc message)
const SAFE_HEREDOC_BASES = [/^git commit\b/, /^git tag\b/];
/**
 * Commands the orchestrator CAN run directly.
 * Everything else must be delegated to a sub-agent.
 */
const ORCHESTRATOR_SAFE_BASH = [
    // Read-only / inspection
    /^ls( |$)/,
    /^pwd$/,
    /^cat /,
    /^head /,
    /^tail /,
    /^wc /,
    /^tree( |$)/,
    /^which /,
    /^file /,
    // Git read-only
    /^git (status|diff|log|branch|show|fetch|remote|rev-parse|describe|tag -l)/,
    // Build / test / lint (verification)
    /^(npm|pnpm|yarn|bun) (test|run )/,
    /^(npm|pnpm|yarn|bun) (ls|list|outdated|audit)/,
    /^tsc( |$)/,
    /^(eslint|prettier|biome) /,
    /^cargo (test|check|clippy|build)/,
    /^(pytest|python -m pytest)/,
    /^go (test|vet|build)/,
    // Node execution (verification scripts)
    /^node /,
];
function isOrchestratorSafeBash(command) {
    const trimmed = command.trim();
    // Allow safe heredoc commands (git commit with message)
    if (DANGEROUS_SHELL_CHARS.test(trimmed)) {
        if (trimmed.includes('\n') && HEREDOC_PATTERN.test(trimmed)) {
            const firstLine = trimmed.split('\n')[0].trim();
            return SAFE_HEREDOC_BASES.some((p) => p.test(firstLine));
        }
        return false;
    }
    return ORCHESTRATOR_SAFE_BASH.some((p) => p.test(trimmed));
}
function allow(reason) {
    return {
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: { behavior: 'allow', reason },
        },
    };
}
function deny(reason) {
    return {
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: { behavior: 'deny', reason },
        },
    };
}
function passthrough() {
    return { continue: true };
}
export function handlePermissionRequest(input) {
    const toolName = input.tool_name.replace(/^proxy_/, '');
    const command = input.tool_input.command?.trim();
    // --- Bash: allow safe, deny modifying ---
    if (toolName === 'Bash' && command) {
        if (isOrchestratorSafeBash(command)) {
            return allow('Safe read-only or verification command');
        }
        return deny(`[DELEGATION REQUIRED] Orchestrator cannot run this command directly. ` +
            `Delegate to a sub-agent: Agent(subagent_type: "backend-developer" or "general-purpose", ` +
            `mode: "bypassPermissions", prompt: "Run: ${command.slice(0, 80)}")`);
    }
    // --- Agent: deny without subagent_type ---
    if (toolName === 'Agent') {
        const subagentType = input.tool_input.subagent_type;
        if (!subagentType || subagentType === '') {
            return deny(`[DELEGATION REQUIRED] Set subagent_type on this Agent call. ` +
                `Check available types in the Agent tool description (e.g. backend-developer, frontend-developer, Explore). ` +
                `If no specialist matches, use "general-purpose". Also set mode: "bypassPermissions".`);
        }
    }
    // --- Auto-allow orchestration toolkit (harness is installed = orchestration mode) ---
    // Read-only tools — always safe
    if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Write tools — sub-agents need these to implement
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Agent — already passed subagent_type check above
    if (toolName === 'Agent') {
        return allow(`harness: auto-allow Agent`);
    }
    // Research tools
    if (toolName === 'WebSearch' || toolName === 'WebFetch') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Task tools — orchestrator tracks progress
    if (toolName.startsWith('Task')) {
        return allow(`harness: auto-allow ${toolName}`);
    }
    return passthrough();
}
