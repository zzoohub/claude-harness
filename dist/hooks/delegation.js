/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, Write/Edit attempts outside allowed paths get blocked,
 * forcing Claude to use the Agent tool to delegate work.
 *
 * This is OMC's #1 core behavior: "DELEGATE. DON'T IMPLEMENT."
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
// Messages
// ---------------------------------------------------------------------------
const WARN_MSG = (path) => `[DELEGATION REQUIRED] You are an orchestrator — delegate file changes to a sub-agent via the Agent tool instead of writing directly.\nAttempted path: ${path}`;
const BLOCK_MSG = (path) => `[BLOCKED] Orchestrator cannot modify "${path}" directly. Use the Agent tool to delegate this to a sub-agent.`;
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
 * Intercepts Write/Edit tool calls. If the target path is outside
 * allowed patterns, either warns or blocks depending on config.
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 *   // → blocks all Write/Edit outside .harness/, .claude/, CLAUDE.md
 */
export function createDelegationGuard(config = {}) {
    const allowed = config.allowedPaths ?? DEFAULT_ALLOWED;
    const level = config.enforcement ?? 'warn';
    return {
        event: 'PreToolUse',
        handle: (input) => {
            if (level === 'off')
                return {};
            if (!input.toolName || !WRITE_TOOLS.includes(input.toolName))
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
