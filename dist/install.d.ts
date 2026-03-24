/**
 * Installer.
 *
 * Writes hook entries into Claude Code's settings.json so that
 * lifecycle events are routed to our bridge script.
 *
 * Each event gets its own entry:
 *   "command": "node /abs/path/dist/bridge.js SessionStart"
 */
import type { HookEvent } from './types.js';
/**
 * Install hooks into Claude Code settings.
 * @param bridgePath  Absolute path to the compiled bridge.js
 * @param events      Which events to hook (defaults to all)
 */
export declare function install(bridgePath: string, events?: HookEvent[]): void;
/** Remove all harness hooks from Claude Code settings. */
export declare function uninstall(bridgePath: string): void;
