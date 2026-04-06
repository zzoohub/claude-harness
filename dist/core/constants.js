/**
 * Shared constants — single source of truth for repeated strings.
 *
 * Mode names, event types, tool names are used across multiple files.
 * Define them here to avoid typos and make renaming easy.
 */
/** Built-in mode names. */
export const MODE = {
    loop: 'loop',
    pipeline: 'pipeline',
};
/** Claude Code hook event types. */
export const EVENT = {
    SessionStart: 'SessionStart',
    UserPromptSubmit: 'UserPromptSubmit',
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
    PermissionRequest: 'PermissionRequest',
};
/** Tools that modify files (used by delegation guard). */
export const WRITE_TOOLS = ['Write', 'Edit', 'write', 'edit', 'NotebookEdit'];
