/**
 * Config loader.
 *
 * Merges three layers (lowest → highest priority):
 *   1. User-level    ~/.config/harness/config.json
 *   2. Project-level  .claude/harness.json
 *   3. Programmatic   createHarness({ ... })
 *
 * Later layers overwrite earlier layers.
 * Programmatic values survive because they're the base,
 * and file configs only ADD new keys (spread merge).
 *
 * Agent prompts support a "file:" prefix to load from disk:
 *   "prompt": "file:agents/explorer.md"
 */
import type { Agent, FileConfig, HarnessConfig } from './types.js';
export declare function loadJsonFile(path: string): FileConfig | null;
/** Resolve "file:relative/path.md" prompts to their contents. */
export declare function resolvePrompts(agents: Record<string, Agent>, basePath: string): void;
/**
 * Load project config from .claude/harness.config.mjs or .claude/harness.json.
 *
 * Priority: .mjs (ES module with defineConfig) > .json
 * The .mjs path lets power users write typed configs via:
 *   import { defineConfig } from 'claude-harness';
 *   export default defineConfig({ ... });
 */
export declare function loadProjectConfig(): Promise<FileConfig | null>;
/**
 * Load and merge all config sources.
 *
 * Merge order: programmatic (base) ← user ← project
 * Later sources overwrite earlier ones for overlapping keys.
 * Programmatic keys that aren't in file configs survive untouched.
 */
export declare function loadConfig(programmatic: HarnessConfig): HarnessConfig;
/** Async variant — resolves .mjs project configs before merging. */
export declare function loadConfigAsync(programmatic: HarnessConfig): Promise<HarnessConfig>;
