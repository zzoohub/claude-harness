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

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { HookHandler } from '../core/types.js';

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const CONTEXT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  '.claude/AGENTS.md',
];

/**
 * Walk up from startDir, collecting context files.
 * Stops at filesystem root.
 */
export function findContextFiles(startDir: string = process.cwd()): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  let dir = startDir;

  while (!visited.has(dir)) {
    visited.add(dir);

    for (const name of CONTEXT_FILES) {
      const fullPath = join(dir, name);
      if (!seen.has(fullPath) && existsSync(fullPath)) {
        seen.add(fullPath);
        found.push(fullPath);
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return found;
}

/** Read and concatenate context files. */
export function loadContextFiles(files: string[]): string {
  return files
    .map((f) => {
      try {
        const content = readFileSync(f, 'utf-8').trim();
        return `<!-- from ${f} -->\n${content}`;
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

/**
 * Create a context injection hook.
 *
 * On SessionStart, discovers AGENTS.md / CLAUDE.md files
 * and injects their contents as additional context.
 */
export function createContextLoader(startDir?: string): HookHandler {
  return {
    event: 'SessionStart',
    handle: () => {
      const files = findContextFiles(startDir);
      if (files.length === 0) return {};

      const content = loadContextFiles(files);
      if (!content) return {};

      return { additionalContext: content };
    },
  };
}
