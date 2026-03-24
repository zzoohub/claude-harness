/**
 * Claude Code hook bridge.
 *
 * This is the entry point that Claude Code's hook system calls.
 * Flow:  stdin (JSON) → parse → HookEngine → stdout (JSON)
 *
 * Usage in settings.json hooks:
 *   "command": "node /path/to/dist/bridge.js PreToolUse"
 *
 * The event type is passed as the first CLI argument so the bridge
 * always knows which lifecycle event triggered it.
 */
export {};
