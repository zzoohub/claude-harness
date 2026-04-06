/**
 * PermissionRequest hook — auto-allow tools when autopilot mode is active.
 *
 * Claude Code fires PermissionRequest before asking the user to approve
 * a tool call. This hook intercepts it and returns `behavior: 'allow'`
 * when a harness mode (autopilot/loop) is running, so the workflow
 * isn't interrupted by permission prompts.
 *
 * Security: dangerous shell metacharacters are still rejected.
 */
import { isActive, readState } from '../core/state.js';
// Shell metacharacters that enable command chaining / injection
const DANGEROUS_SHELL_CHARS = /[;&|`$()<>\n\r\t\0\\{}\[\]*?~!#]/;
// Heredoc operator (<<, <<-, <<~)
const HEREDOC_PATTERN = /<<[-~]?\s*['"]?\w+['"]?/;
// Safe heredoc base commands (e.g. git commit with heredoc message)
const SAFE_HEREDOC_BASES = [/^git commit\b/, /^git tag\b/];
// Commands that are always safe to auto-allow
const SAFE_BASH_PATTERNS = [
    /^git (status|diff|log|branch|show|fetch|rev-parse)/,
    /^npm (test|run (test|lint|build|check|typecheck))/,
    /^pnpm (test|run (test|lint|build|check|typecheck))/,
    /^yarn (test|run (test|lint|build|check|typecheck))/,
    /^tsc( |$)/,
    /^eslint /,
    /^prettier /,
    /^cargo (test|check|clippy|build)/,
    /^pytest/,
    /^python -m pytest/,
    /^ls( |$)/,
    /^node /,
    /^npx /,
    /^mkdir /,
];
function isSafeBashCommand(command) {
    const trimmed = command.trim();
    if (DANGEROUS_SHELL_CHARS.test(trimmed)) {
        // Allow heredoc commands with safe base (e.g. git commit -m "$(cat <<'EOF' ... )")
        if (trimmed.includes('\n') && HEREDOC_PATTERN.test(trimmed)) {
            const firstLine = trimmed.split('\n')[0].trim();
            return SAFE_HEREDOC_BASES.some((p) => p.test(firstLine));
        }
        return false;
    }
    return SAFE_BASH_PATTERNS.some((p) => p.test(trimmed));
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
function passthrough() {
    return { continue: true };
}
export function handlePermissionRequest(input) {
    const toolName = input.tool_name.replace(/^proxy_/, '');
    const command = input.tool_input.command?.trim();
    // Always auto-allow safe bash commands regardless of mode
    if (toolName === 'Bash' && command && isSafeBashCommand(command)) {
        return allow('Safe read-only or build command');
    }
    // If no harness mode is active, defer to normal permission flow
    if (!isActive()) {
        return passthrough();
    }
    // --- Harness mode is active (autopilot/loop) ---
    const state = readState();
    const mode = state.mode;
    // Auto-allow Read — always safe
    if (toolName === 'Read') {
        return allow(`${mode} mode: auto-allow Read`);
    }
    // Auto-allow Write/Edit — needed for code generation
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
        return allow(`${mode} mode: auto-allow ${toolName}`);
    }
    // Auto-allow Glob/Grep — read-only search tools
    if (toolName === 'Glob' || toolName === 'Grep') {
        return allow(`${mode} mode: auto-allow ${toolName}`);
    }
    // Auto-allow Agent — orchestrator needs to spawn sub-agents
    if (toolName === 'Agent') {
        return allow(`${mode} mode: auto-allow Agent`);
    }
    // Auto-allow WebSearch/WebFetch — research tools
    if (toolName === 'WebSearch' || toolName === 'WebFetch') {
        return allow(`${mode} mode: auto-allow ${toolName}`);
    }
    // Auto-allow Task tools — orchestrator tracks progress
    if (toolName.startsWith('Task')) {
        return allow(`${mode} mode: auto-allow ${toolName}`);
    }
    // Bash: allow non-dangerous commands during active mode
    if (toolName === 'Bash' && command) {
        // Reject commands with shell metacharacters (injection risk)
        if (DANGEROUS_SHELL_CHARS.test(command)) {
            // But allow heredocs with safe base commands
            if (command.includes('\n') && HEREDOC_PATTERN.test(command)) {
                const firstLine = command.split('\n')[0].trim();
                if (SAFE_HEREDOC_BASES.some((p) => p.test(firstLine))) {
                    return allow(`${mode} mode: safe heredoc command`);
                }
            }
            // Let Claude Code ask the user for dangerous shell commands
            return passthrough();
        }
        return allow(`${mode} mode: auto-allow Bash`);
    }
    // Everything else: defer to normal permission flow
    return passthrough();
}
