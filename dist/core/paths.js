/**
 * Centralized paths — single source of truth for all file locations.
 *
 * Every module reads paths from here instead of hardcoding strings.
 * To change the directory layout, edit this file only.
 */
import { join } from 'path';
import { homedir } from 'os';
const BASE = '.harness';
export const PATHS = {
    /** Root directory for all harness state. */
    base: BASE,
    /** State machine persistence. */
    stateFile: join(BASE, 'state.json'),
    /** Working memory persistence. */
    memoryFile: join(BASE, 'memory.json'),
    /** Team task results directory. */
    teamDir: join(BASE, 'team'),
    teamResults: join(BASE, 'team', 'results'),
    teamSession: join(BASE, 'team', 'session.json'),
    /** User-level config. */
    userConfig: join(homedir(), '.config', 'harness', 'config.json'),
    /** Project-level config. */
    projectConfig: join(process.cwd(), '.claude', 'harness.json'),
};
