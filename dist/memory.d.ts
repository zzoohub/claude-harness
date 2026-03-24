/**
 * Working memory — survives context compaction.
 *
 * Long-running sessions (60min+) hit Claude Code's context limit.
 * When compacted, prior decisions and discoveries are lost.
 *
 * This module persists critical info to disk (.harness/memory.md)
 * and re-injects it on every SessionStart (including after compaction).
 *
 * Three sections:
 *   priority  — architecture decisions, constraints (never expires)
 *   working   — current task context (timestamped, auto-pruned)
 *   manual    — user-annotated notes
 */
import type { HookHandler } from './types.js';
interface Memory {
    priority: string[];
    working: Array<{
        text: string;
        at: string;
    }>;
    manual: string[];
}
export declare function readMemory(): Memory;
/** Add a priority note (never auto-pruned). */
export declare function addPriority(text: string): void;
/** Add a working memory entry (timestamped, prunable). */
export declare function addWorking(text: string): void;
/** Add a manual note. */
export declare function addManual(text: string): void;
/** Prune working memory entries older than maxAge (ms). Default: 2 hours. */
export declare function pruneWorking(maxAgeMs?: number): number;
/** Clear all memory. */
export declare function clearMemory(): void;
export declare function formatMemory(): string;
/**
 * Re-inject memory on session start (including after compaction).
 *
 * This is why memory survives compaction:
 *   1. Info is saved to disk during the session
 *   2. Context gets compacted (info lost from context)
 *   3. SessionStart fires (with type "compact")
 *   4. This hook re-injects memory from disk
 */
export declare function createMemoryHook(): HookHandler;
/**
 * Scan agent output for <remember> tags and save to memory.
 *
 *   <remember>important finding</remember>         → working memory
 *   <remember priority>never forget this</remember> → priority memory
 */
export declare function createMemoryCapture(): HookHandler;
export {};
