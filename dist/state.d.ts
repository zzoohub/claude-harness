/**
 * State machine — disk-based, survives across hook invocations.
 *
 * This is one half of "hooks + state machine."
 * The hook engine dispatches events; the state machine tracks
 * WHERE we are in a long-running workflow.
 *
 * Key concepts:
 *
 *   Mode       A named workflow (e.g., "autopilot", "review")
 *   Phase      A step within that workflow (e.g., "planning" → "execution")
 *   Transition Moving from one phase to the next, with guard conditions
 *
 * Example lifecycle across separate hook invocations:
 *
 *   Hook call 1: idle          → startMode("deploy")     → phase: "plan"
 *   Hook call 2: deploy/plan   → transition("execute")   → phase: "execute"
 *   Hook call 3: deploy/exec   → transition("verify")    → phase: "verify"
 *   Hook call 4: deploy/verify → endMode()               → idle
 *
 * Persistence: .harness/state.json (one file, read/written atomically)
 */
export interface SessionState {
    /** Active mode name. Null = idle. */
    mode: string | null;
    /** Current phase within the mode. */
    phase: string | null;
    /** Ordered list of phases this mode goes through. */
    phases: string[];
    /** Freeform data — each phase can read/write here. */
    data: Record<string, unknown>;
    /** Phase transition history. */
    history: Array<{
        from: string | null;
        to: string;
        at: string;
    }>;
    /** When the mode started. */
    startedAt: string | null;
    /** Claude Code session ID. */
    sessionId: string | null;
}
export declare function readState(): SessionState;
export declare function writeState(state: SessionState): void;
export declare function clearState(): void;
/** Is any mode active? */
export declare function isActive(): boolean;
/**
 * Start a mode with defined phases.
 *
 * @example
 *   startMode("deploy", ["plan", "execute", "verify"]);
 *   // → mode: "deploy", phase: "plan"
 */
export declare function startMode(mode: string, phases?: string[], data?: Record<string, unknown>, sessionId?: string): void;
/** End the current mode. Returns to idle. */
export declare function endMode(): void;
export interface TransitionResult {
    ok: boolean;
    error?: string;
    from: string | null;
    to: string;
}
/**
 * Move to the next phase, or to a specific phase.
 *
 * Guards:
 *   - Must have an active mode
 *   - Target phase must exist in the phases list
 *   - Cannot transition to the current phase
 *
 * @example
 *   transition("execute");     // explicit target
 *   transition();              // auto-advance to next phase
 */
export declare function transition(targetPhase?: string): TransitionResult;
/** Is the current phase the last one? */
export declare function isLastPhase(): boolean;
/** Update mode data (shallow merge). */
export declare function updateData(patch: Record<string, unknown>): void;
/** Read a single value from mode data. */
export declare function getData<T = unknown>(key: string): T | undefined;
