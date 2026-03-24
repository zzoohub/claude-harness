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
import type { HookEvent } from '../core/types.js';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const ALL_EVENTS: HookEvent[] = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
];

interface HookEntry {
  matcher: string;
  hooks: Array<{ type: string; command: string }>;
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Read / write settings
// ---------------------------------------------------------------------------

function readSettings(): ClaudeSettings {
  if (!existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
}

function writeSettings(settings: ClaudeSettings): void {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function isOurHook(entry: HookEntry, marker: string): boolean {
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
export function install(bridgePath: string, events: HookEvent[] = ALL_EVENTS): void {
  const absPath = resolve(bridgePath);
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};

  for (const event of events) {
    const existing = settings.hooks[event] ?? [];

    // Remove previous harness entries
    const filtered = existing.filter(
      (e) => !isOurHook(e, absPath),
    );

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
export function uninstall(bridgePath: string): void {
  const absPath = resolve(bridgePath);
  const settings = readSettings();
  if (!settings.hooks) return;

  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!entries) continue;
    settings.hooks[event] = entries.filter(
      (e) => !isOurHook(e, absPath),
    );
  }

  writeSettings(settings);
}
