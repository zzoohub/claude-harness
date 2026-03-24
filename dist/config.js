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
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
const USER_CONFIG = join(homedir(), '.config', 'harness', 'config.json');
const PROJECT_CONFIG = join(process.cwd(), '.claude', 'harness.json');
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
    for (const agent of Object.values(agents)) {
        if (agent.prompt.startsWith('file:')) {
            const filePath = join(basePath, agent.prompt.slice(5));
            agent.prompt = readFileSync(filePath, 'utf-8');
        }
    }
}
// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
function merge(base, overlay, basePath) {
    if (!overlay)
        return base;
    const agents = { ...base.agents, ...overlay.agents };
    if (basePath && overlay.agents)
        resolvePrompts(agents, basePath);
    return {
        ...base,
        agents,
        systemPromptSuffix: overlay.systemPromptSuffix ?? base.systemPromptSuffix,
    };
}
export function loadConfig(programmatic) {
    const userCfg = loadJsonFile(USER_CONFIG);
    const projCfg = loadJsonFile(PROJECT_CONFIG);
    let config = { ...programmatic };
    config = merge(config, userCfg, dirname(USER_CONFIG));
    config = merge(config, projCfg, dirname(PROJECT_CONFIG));
    // Programmatic config wins last (it was the base and overlays only add)
    return config;
}
