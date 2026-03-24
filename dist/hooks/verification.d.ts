/**
 * Verification enforcement — "서브에이전트는 거짓말한다."
 *
 * PostToolUse hook that fires after Agent/Task tool completes.
 * Injects a verification reminder so the orchestrator doesn't
 * blindly trust sub-agent self-reports.
 *
 * Without this, Claude accepts "완료했습니다" at face value.
 * With this, Claude is reminded to run tests, read code, check builds.
 */
import type { HookHandler } from '../core/types.js';
export interface VerificationConfig {
    /** Custom verification message. */
    message?: string;
    /** Include git diff summary after agent work. Default: true */
    showDiff?: boolean;
}
/**
 * Create a verification hook.
 *
 * Fires on PostToolUse for Agent tool calls.
 * Injects verification reminder + optional git diff summary.
 */
export declare function createVerificationHook(config?: VerificationConfig): HookHandler;
