/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, modifying tool calls get blocked, forcing Claude to
 * use the Agent tool to delegate work.
 *
 * Three enforcement layers:
 *   1. Bash guard — blocks modifying Bash commands (allows read-only/verify)
 *   2. Agent guard — blocks Agent calls without subagent_type
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
 */
import { extname } from 'path';
import { WRITE_TOOLS } from '../core/constants.js';
const DEFAULT_ALLOWED = [
    /^\.harness\//, // harness state
    /^\.omc\//, // omc state
    /^\.claude\//, // claude config
    /CLAUDE\.md$/, // project instructions
    /AGENTS\.md$/, // agent instructions
];
const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
    '.java', '.kt', '.rb', '.php', '.c', '.cpp', '.h',
    '.svelte', '.vue', '.sh',
]);
// ---------------------------------------------------------------------------
// Bash command classification
// ---------------------------------------------------------------------------
/** Commands the orchestrator CAN run directly (read-only + verification). */
const SAFE_BASH_PATTERNS = [
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
    /^du /,
    /^df /,
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
    // Node execution (for verification scripts)
    /^node /,
];
function isSafeBash(command) {
    const trimmed = command.trim();
    return SAFE_BASH_PATTERNS.some((p) => p.test(trimmed));
}
// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
const WARN_MSG = (path) => `[DELEGATION REQUIRED] You are an orchestrator — delegate file changes to a sub-agent via the Agent tool instead of writing directly.\nAttempted path: ${path}`;
const BLOCK_MSG = (path) => `[BLOCKED] Orchestrator cannot modify "${path}" directly. Use the Agent tool to delegate this to a sub-agent.`;
const BASH_BLOCK_MSG = (cmd) => `[BLOCKED] Orchestrator cannot run this command directly. Delegate to a sub-agent:\n  Agent(subagent_type: "backend-developer" or "general-purpose", mode: "bypassPermissions", prompt: "Run: ${cmd.slice(0, 80)}")`;
const AGENT_BLOCK_MSG = `[BLOCKED] Set subagent_type on this Agent call. Check available specialist types in the Agent tool description (e.g. backend-developer, frontend-developer, Explore). If no specialist matches, use "general-purpose". Also set mode: "bypassPermissions".`;
// ---------------------------------------------------------------------------
// Path checking
// ---------------------------------------------------------------------------
function isAllowed(filePath, patterns) {
    if (!filePath)
        return true;
    const normalized = filePath.replace(/\\/g, '/');
    return patterns.some((p) => p.test(normalized));
}
function isSourceFile(filePath) {
    return SOURCE_EXTENSIONS.has(extname(filePath).toLowerCase());
}
// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------
/**
 * Create a delegation enforcement hook.
 *
 * Three layers:
 *   1. Bash guard — blocks modifying commands, allows read-only/verification
 *   2. Agent guard — blocks Agent calls without subagent_type
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 */
export function createDelegationGuard(config = {}) {
    const allowed = config.allowedPaths ?? DEFAULT_ALLOWED;
    const level = config.enforcement ?? 'warn';
    return {
        event: 'PreToolUse',
        handle: (input) => {
            if (level === 'off')
                return {};
            if (!input.toolName)
                return {};
            // --- Layer 1: Bash guard (soft reminder — cannot hard-block because sub-agents also need Bash) ---
            if (input.toolName === 'Bash') {
                const command = input.toolInput?.['command'] ?? '';
                if (!command || isSafeBash(command))
                    return {};
                return { additionalContext: BASH_BLOCK_MSG(command) };
            }
            // --- Layer 2: Agent guard (always enforce subagent_type) ---
            if (input.toolName === 'Agent') {
                const subagentType = input.toolInput?.['subagent_type'];
                if (!subagentType || subagentType === '') {
                    return { decision: 'block', reason: AGENT_BLOCK_MSG };
                }
                return {};
            }
            // --- Layer 3: Write/Edit guard (existing logic) ---
            if (!WRITE_TOOLS.includes(input.toolName))
                return {};
            const filePath = (input.toolInput?.['file_path'] ??
                input.toolInput?.['filePath'] ??
                input.toolInput?.['path']);
            if (!filePath || isAllowed(filePath, allowed))
                return {};
            const msg = isSourceFile(filePath) ? BLOCK_MSG(filePath) : WARN_MSG(filePath);
            if (level === 'strict') {
                return { decision: 'block', reason: msg };
            }
            return { additionalContext: msg };
        },
    };
}
