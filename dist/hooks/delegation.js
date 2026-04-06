/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, Write/Edit attempts outside allowed paths get blocked,
 * forcing Claude to use the Agent tool to delegate work.
 *
 * Three enforcement layers:
 *   1. Write/Edit guard — blocks direct file modification
 *   2. Bash guard — blocks Bash during execute phase (must delegate)
 *   3. Agent guard — reminds when subagent_type is missing
 */
import { extname } from 'path';
import { WRITE_TOOLS } from '../core/constants.js';
import { readState } from '../core/state.js';
const DEFAULT_ALLOWED = [
    /^\.harness\//, // harness state
    /^\.omc\//, // omc state
    /^\.claude\//, // claude config
    /CLAUDE\.md$/, // project instructions
    /AGENTS\.md$/, // agent instructions
];
const DEFAULT_BASH_BLOCKED_PHASES = ['execute'];
const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
    '.java', '.kt', '.rb', '.php', '.c', '.cpp', '.h',
    '.svelte', '.vue', '.sh',
]);
// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
const WARN_MSG = (path) => `[DELEGATION REQUIRED] You are an orchestrator — delegate file changes to a sub-agent via the Agent tool instead of writing directly.\nAttempted path: ${path}`;
const BLOCK_MSG = (path) => `[BLOCKED] Orchestrator cannot modify "${path}" directly. Use the Agent tool to delegate this to a sub-agent.`;
const BASH_BLOCK_MSG = `[BLOCKED] Orchestrator cannot run Bash directly during execute phase. Delegate this command to a sub-agent via the Agent tool. Example: Agent(subagent_type: "backend-developer" or "general-purpose", mode: "bypassPermissions", prompt: "Run: <command>")`;
const AGENT_REMINDER_MSG = `[REMINDER] Set subagent_type on this Agent call. Check available specialist types in the Agent tool description (e.g. backend-developer, frontend-developer, Explore, etc). If no specialist matches, use "general-purpose". Also set mode: "bypassPermissions" so the agent executes without asking the user.`;
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
 *   1. Bash guard — blocks Bash during execute phase of active pipeline
 *   2. Agent guard — injects reminder when subagent_type is missing
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 */
export function createDelegationGuard(config = {}) {
    const allowed = config.allowedPaths ?? DEFAULT_ALLOWED;
    const level = config.enforcement ?? 'warn';
    const bashBlockedPhases = config.bashBlockedPhases ?? DEFAULT_BASH_BLOCKED_PHASES;
    return {
        event: 'PreToolUse',
        handle: (input) => {
            if (level === 'off')
                return {};
            if (!input.toolName)
                return {};
            // --- Layer 1: Bash guard (execute phase only) ---
            if (input.toolName === 'Bash') {
                const state = readState();
                if (state.mode && state.phase && bashBlockedPhases.includes(state.phase)) {
                    return { decision: 'block', reason: BASH_BLOCK_MSG };
                }
                return {};
            }
            // --- Layer 2: Agent guard (always enforce subagent_type) ---
            if (input.toolName === 'Agent') {
                const subagentType = input.toolInput?.['subagent_type'];
                if (!subagentType || subagentType === '') {
                    return { decision: 'block', reason: AGENT_REMINDER_MSG };
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
            // Source files get stronger messaging
            const msg = isSourceFile(filePath) ? BLOCK_MSG(filePath) : WARN_MSG(filePath);
            if (level === 'strict') {
                return { decision: 'block', reason: msg };
            }
            // Warn mode: allow but inject reminder
            return { additionalContext: msg };
        },
    };
}
