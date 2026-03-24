/**
 * Context loader — auto-injects project context on session start.
 *
 * Scans for AGENTS.md and CLAUDE.md files up the directory tree
 * and injects their contents into the session. This gives the
 * orchestrator project-specific knowledge.
 *
 * Claude Code already loads CLAUDE.md natively, but this hook
 * provides additional injection for AGENTS.md and nested contexts
 * that Claude Code may not pick up.
 */
import type { HookHandler } from './types.js';
/**
 * Walk up from startDir, collecting context files.
 * Stops at filesystem root.
 */
export declare function findContextFiles(startDir?: string): string[];
/** Read and concatenate context files. */
export declare function loadContextFiles(files: string[]): string;
/**
 * Create a context injection hook.
 *
 * On SessionStart, discovers AGENTS.md / CLAUDE.md files
 * and injects their contents as additional context.
 */
export declare function createContextLoader(startDir?: string): HookHandler;
