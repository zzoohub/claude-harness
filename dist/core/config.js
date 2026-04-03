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
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { PATHS } from './paths.js';
// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------
export function loadJsonFile(path) {
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
/** Resolve "file:relative/path.md" prompts to their contents. */
export function resolvePrompts(agents, basePath) {
    for (const [name, agent] of Object.entries(agents)) {
        if (agent.prompt.startsWith('file:')) {
            const relPath = agent.prompt.slice(5);
            const filePath = join(basePath, relPath);
            try {
                agent.prompt = readFileSync(filePath, 'utf-8');
            }
            catch (err) {
                throw new Error(`Failed to load prompt for agent "${name}" from "${filePath}": ${err instanceof Error ? err.message : err}`);
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
/**
 * Merge overlay config onto base. Overlay keys overwrite base keys.
 * Keys not in overlay are preserved from base.
 */
function merge(base, overlay, basePath) {
    if (!overlay)
        return base;
    const agents = { ...base.agents, ...overlay.agents };
    if (basePath && overlay.agents)
        resolvePrompts(agents, basePath);
    const suffix = overlay.systemPromptSuffix !== undefined ? overlay.systemPromptSuffix : base.systemPromptSuffix;
    const result = { ...base, agents };
    if (suffix !== undefined)
        result.systemPromptSuffix = suffix;
    return result;
}
/**
 * Load project config from .claude/harness.config.mjs or .claude/harness.json.
 *
 * Priority: .mjs (ES module with defineConfig) > .json
 * The .mjs path lets power users write typed configs via:
 *   import { defineConfig } from 'claude-harness';
 *   export default defineConfig({ ... });
 */
export async function loadProjectConfig() {
    const mjsPath = join(process.cwd(), '.claude', 'harness.config.mjs');
    if (existsSync(mjsPath)) {
        try {
            const mod = await import(pathToFileURL(mjsPath).href);
            return (mod.default ?? mod);
        }
        catch (err) {
            process.stderr.write(`[harness] Failed to load ${mjsPath}: ${err instanceof Error ? err.message : err}\n`);
        }
    }
    return loadJsonFile(PATHS.projectConfig);
}
/**
 * Load and merge all config sources.
 *
 * Merge order: programmatic (base) ← user ← project
 * Later sources overwrite earlier ones for overlapping keys.
 * Programmatic keys that aren't in file configs survive untouched.
 */
export function loadConfig(programmatic) {
    const userCfg = loadJsonFile(PATHS.userConfig);
    const projCfg = loadJsonFile(PATHS.projectConfig);
    let config = { ...programmatic };
    config = merge(config, userCfg, dirname(PATHS.userConfig));
    config = merge(config, projCfg, dirname(PATHS.projectConfig));
    return config;
}
/** Async variant — resolves .mjs project configs before merging. */
export async function loadConfigAsync(programmatic) {
    const userCfg = loadJsonFile(PATHS.userConfig);
    const projCfg = await loadProjectConfig();
    let config = { ...programmatic };
    config = merge(config, userCfg, dirname(PATHS.userConfig));
    config = merge(config, projCfg, dirname(PATHS.projectConfig));
    return config;
}
