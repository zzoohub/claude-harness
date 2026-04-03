/**
 * Core types for the orchestration harness.
 *
 * This is the only file you need to read to understand the data model.
 * Everything else operates on these types.
 */
/**
 * Identity helper for type-safe config authoring.
 *
 * Usage in .claude/harness.config.mjs (or .ts with a build step):
 *   import { defineConfig } from 'claude-harness';
 *   export default defineConfig({ agents: { ... } });
 */
export function defineConfig(config) {
    return config;
}
