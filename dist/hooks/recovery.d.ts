/**
 * Error recovery — auto-detect and recover from common failures.
 *
 * Without this, any error stops the entire pipeline.
 * With this, errors are detected and recovery actions are injected.
 *
 * Three recovery types (checked in priority order):
 *
 *   1. Context window limit — most critical, blocks all progress
 *      → Inject "/compact" instruction to free context
 *
 *   2. Edit conflict — Write/Edit tool fails (old_string not found, etc.)
 *      → Inject "re-read the file before editing" reminder
 *
 *   3. Agent error — sub-agent crashes, times out, or returns error
 *      → Inject retry instruction with error context
 */
import type { HookHandler } from '../core/types.js';
type ErrorType = 'context_limit' | 'edit_conflict' | 'agent_error' | null;
export interface RecoveryConfig {
    /** Disable specific recovery types. */
    disabled?: ErrorType[];
    /** Custom recovery messages per error type. */
    messages?: Partial<Record<string, string>>;
    /** Max consecutive recoveries before giving up. Default: 3 */
    maxRecoveries?: number;
}
/**
 * Create a recovery hook.
 *
 * Recovery counter is stored in the state machine's data field
 * so it persists across hook invocations and harness recreations.
 */
export declare function createRecoveryHook(config?: RecoveryConfig): HookHandler;
export {};
