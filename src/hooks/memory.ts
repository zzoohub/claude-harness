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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { HookHandler } from '../core/types.js';
import { PATHS } from '../core/paths.js';

// ---------------------------------------------------------------------------
// Data structure
// ---------------------------------------------------------------------------

interface Memory {
  priority: string[];
  working: Array<{ text: string; at: string }>;
  manual: string[];
}

function emptyMemory(): Memory {
  return { priority: [], working: [], manual: [] };
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

export function readMemory(): Memory {
  if (!existsSync(PATHS.memoryFile)) return emptyMemory();
  try {
    return JSON.parse(readFileSync(PATHS.memoryFile, 'utf-8'));
  } catch {
    return emptyMemory();
  }
}

function writeMemory(mem: Memory): void {
  mkdirSync(dirname(PATHS.memoryFile), { recursive: true });
  writeFileSync(PATHS.memoryFile, JSON.stringify(mem, null, 2));
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/** Add a priority note (never auto-pruned). */
export function addPriority(text: string): void {
  const mem = readMemory();
  if (!mem.priority.includes(text)) {
    mem.priority.push(text);
    writeMemory(mem);
  }
}

/** Add a working memory entry (timestamped, prunable). */
export function addWorking(text: string): void {
  const mem = readMemory();
  mem.working.push({ text, at: new Date().toISOString() });
  writeMemory(mem);
}

/** Add a manual note. */
export function addManual(text: string): void {
  const mem = readMemory();
  mem.manual.push(text);
  writeMemory(mem);
}

/** Prune working memory entries older than maxAge (ms). Default: 2 hours. */
export function pruneWorking(maxAgeMs: number = 2 * 60 * 60 * 1000): number {
  const mem = readMemory();
  const cutoff = Date.now() - maxAgeMs;
  const before = mem.working.length;
  mem.working = mem.working.filter((e) => new Date(e.at).getTime() > cutoff);
  writeMemory(mem);
  return before - mem.working.length;
}

/** Clear all memory. */
export function clearMemory(): void {
  writeMemory(emptyMemory());
}

// ---------------------------------------------------------------------------
// Format for injection
// ---------------------------------------------------------------------------

export function formatMemory(): string {
  const mem = readMemory();
  const sections: string[] = [];

  if (mem.priority.length > 0) {
    sections.push(
      '## Priority (do not forget)\n' + mem.priority.map((p) => `- ${p}`).join('\n'),
    );
  }

  if (mem.working.length > 0) {
    const recent = mem.working.slice(-10); // Last 10 entries
    sections.push(
      '## Working Memory\n' + recent.map((e) => `- [${e.at}] ${e.text}`).join('\n'),
    );
  }

  if (mem.manual.length > 0) {
    sections.push(
      '## Notes\n' + mem.manual.map((n) => `- ${n}`).join('\n'),
    );
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Re-inject memory on session start (including after compaction).
 *
 * This is why memory survives compaction:
 *   1. Info is saved to disk during the session
 *   2. Context gets compacted (info lost from context)
 *   3. SessionStart fires (with type "compact")
 *   4. This hook re-injects memory from disk
 */
export function createMemoryHook(): HookHandler {
  return {
    event: 'SessionStart',
    handle: () => {
      const formatted = formatMemory();
      if (!formatted) return {};
      return { additionalContext: `[Working Memory]\n${formatted}` };
    },
  };
}

/**
 * Scan agent output for <remember> tags and save to memory.
 *
 *   <remember>important finding</remember>         → working memory
 *   <remember priority>never forget this</remember> → priority memory
 */
export function createMemoryCapture(): HookHandler {
  return {
    event: 'PostToolUse',
    handle: (input) => {
      const output = String(input.toolOutput ?? '');
      if (!output.includes('<remember')) return {};

      // Priority tags
      for (const match of output.matchAll(/<remember\s+priority>([\s\S]*?)<\/remember>/gi)) {
        const text = match[1]?.trim();
        if (text) addPriority(text);
      }

      // Regular tags
      for (const match of output.matchAll(/<remember>([\s\S]*?)<\/remember>/gi)) {
        const text = match[1]?.trim();
        if (text) addWorking(text);
      }

      return {};
    },
  };
}
