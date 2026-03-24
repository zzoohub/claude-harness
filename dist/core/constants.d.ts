/**
 * Shared constants — single source of truth for repeated strings.
 *
 * Mode names, event types, tool names are used across multiple files.
 * Define them here to avoid typos and make renaming easy.
 */
/** Built-in mode names. */
export declare const MODE: {
    readonly loop: "loop";
    readonly pipeline: "pipeline";
};
/** Claude Code hook event types. */
export declare const EVENT: {
    readonly SessionStart: "SessionStart";
    readonly UserPromptSubmit: "UserPromptSubmit";
    readonly PreToolUse: "PreToolUse";
    readonly PostToolUse: "PostToolUse";
    readonly Stop: "Stop";
};
/** Tools that modify files (used by delegation guard). */
export declare const WRITE_TOOLS: readonly ["Write", "Edit", "write", "edit", "NotebookEdit"];
