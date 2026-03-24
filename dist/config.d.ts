/**
 * Config loader.
 *
 * Merges three layers (lowest → highest priority):
 *   1. User-level   ~/.config/harness/config.json
 *   2. Project-level .claude/harness.json
 *   3. Programmatic  createHarness({ ... })
 *
 * Agent prompts support a "file:" prefix to load from disk:
 *   "prompt": "file:agents/explorer.md"
 * Paths are resolved relative to the config file's directory.
 */
import type { Agent, FileConfig, HarnessConfig } from './types.js';
export declare function loadJsonFile(path: string): FileConfig | null;
/** Resolve "file:relative/path.md" prompts to their contents. */
export declare function resolvePrompts(agents: Record<string, Agent>, basePath: string): void;
export declare function loadConfig(programmatic: HarnessConfig): HarnessConfig;
