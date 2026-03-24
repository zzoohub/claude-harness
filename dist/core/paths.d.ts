/**
 * Centralized paths — single source of truth for all file locations.
 *
 * Every module reads paths from here instead of hardcoding strings.
 * To change the directory layout, edit this file only.
 */
export declare const PATHS: {
    /** Root directory for all harness state. */
    readonly base: ".harness";
    /** State machine persistence. */
    readonly stateFile: string;
    /** Working memory persistence. */
    readonly memoryFile: string;
    /** Team task results directory. */
    readonly teamDir: string;
    readonly teamResults: string;
    readonly teamSession: string;
    /** User-level config. */
    readonly userConfig: string;
    /** Project-level config. */
    readonly projectConfig: string;
};
