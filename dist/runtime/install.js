/**
 * Installer.
 *
 * Writes hook entries into Claude Code's settings.json so that
 * lifecycle events are routed to our bridge script.
 *
 * Each event gets its own entry:
 *   "command": "node /abs/path/dist/bridge.js SessionStart"
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const ALL_EVENTS = [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'Stop',
];
// ---------------------------------------------------------------------------
// Read / write settings
// ---------------------------------------------------------------------------
function readSettings() {
    if (!existsSync(SETTINGS_PATH))
        return {};
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
}
function writeSettings(settings) {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
function isOurHook(entry, marker) {
    return entry.hooks.some((h) => h.command.includes(marker));
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Install hooks into Claude Code settings.
 * @param bridgePath  Absolute path to the compiled bridge.js
 * @param events      Which events to hook (defaults to all)
 */
export function install(bridgePath, events = ALL_EVENTS) {
    const absPath = resolve(bridgePath);
    const settings = readSettings();
    if (!settings.hooks)
        settings.hooks = {};
    for (const event of events) {
        const existing = settings.hooks[event] ?? [];
        // Remove previous harness entries
        const filtered = existing.filter((e) => !isOurHook(e, absPath));
        // Add new entry
        filtered.push({
            matcher: '',
            hooks: [{ type: 'command', command: `node "${absPath}" ${event}` }],
        });
        settings.hooks[event] = filtered;
    }
    writeSettings(settings);
}
/** Remove all harness hooks from Claude Code settings. */
export function uninstall(bridgePath) {
    const absPath = resolve(bridgePath);
    const settings = readSettings();
    if (!settings.hooks)
        return;
    for (const event of Object.keys(settings.hooks)) {
        const entries = settings.hooks[event];
        if (!entries)
            continue;
        settings.hooks[event] = entries.filter((e) => !isOurHook(e, absPath));
    }
    writeSettings(settings);
}
