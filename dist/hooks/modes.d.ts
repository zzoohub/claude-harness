/**
 * Built-in execution modes — the two universal orchestration patterns.
 *
 * These are not OMC-specific features. They're the two patterns
 * every orchestrator needs:
 *
 *   Loop:     execute → verify → not done? → execute again → ...
 *   Pipeline: phase A → phase B → phase C → ... → done
 *
 * Each mode is a pre-configured state machine + keyword trigger + hooks.
 * Users can use them as-is or customize phases/messages/limits.
 *
 *   OMC name    Pattern     This file
 *   ─────────   ─────────   ───────────────
 *   ralph       Loop        createLoopMode()
 *   autopilot   Pipeline    createPipelineMode()
 */
import type { HookHandler } from '../core/types.js';
import type { KeywordRule } from './keywords.js';
export interface LoopConfig {
    /** Trigger words to start the loop. Default: ["loop", "계속"] */
    triggers?: string[];
    /** Trigger words to stop the loop. Default: ["stop", "중단"] */
    stopTriggers?: string[];
    /** Max iterations before auto-stop. Default: 20 */
    maxIterations?: number;
    /** Context injected each iteration. */
    iterationPrompt?: string;
}
/**
 * Create a loop mode.
 *
 * The loop runs execute→verify cycles. Each hook invocation
 * increments the iteration counter. Stops when:
 *   - User says a stop trigger
 *   - Max iterations reached
 *   - User's custom hook calls endMode()
 *
 * State data: { iteration: number }
 */
export declare function createLoopMode(config?: LoopConfig): {
    keywords: KeywordRule[];
    hooks: HookHandler[];
};
export interface PipelineConfig {
    /** Trigger words to start. Default: ["autopilot", "auto", "파이프라인"] */
    triggers?: string[];
    /** Pipeline phases. Default: ["understand", "plan", "execute", "verify"] */
    phases?: string[];
    /** Context injected per phase. Key = phase name. */
    phasePrompts?: Record<string, string>;
    /** Max fix-loop retries from last phase back to execute. Default: 3 */
    maxRetries?: number;
}
/**
 * Create a pipeline mode.
 *
 * Advances through phases linearly. On the verify phase,
 * if verification fails, loops back to execute (bounded by maxRetries).
 *
 * State data: { retries: number }
 */
export declare function createPipelineMode(config?: PipelineConfig): {
    keywords: KeywordRule[];
    hooks: HookHandler[];
};
