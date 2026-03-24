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
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from './paths.js';
function emptyState() {
    return {
        mode: null,
        phase: null,
        phases: [],
        data: {},
        history: [],
        startedAt: null,
        sessionId: null,
    };
}
// ---------------------------------------------------------------------------
// Disk I/O
// ---------------------------------------------------------------------------
export function readState() {
    if (!existsSync(PATHS.stateFile))
        return emptyState();
    try {
        return JSON.parse(readFileSync(PATHS.stateFile, 'utf-8'));
    }
    catch {
        return emptyState();
    }
}
export function writeState(state) {
    mkdirSync(dirname(PATHS.stateFile), { recursive: true });
    writeFileSync(PATHS.stateFile, JSON.stringify(state, null, 2));
}
export function clearState() {
    if (existsSync(PATHS.stateFile))
        rmSync(PATHS.stateFile);
}
// ---------------------------------------------------------------------------
// Mode lifecycle
// ---------------------------------------------------------------------------
/** Is any mode active? */
export function isActive() {
    return readState().mode !== null;
}
/**
 * Start a mode with defined phases.
 *
 * @example
 *   startMode("deploy", ["plan", "execute", "verify"]);
 *   // → mode: "deploy", phase: "plan"
 */
export function startMode(mode, phases = [], data = {}, sessionId) {
    const firstPhase = phases[0] ?? null;
    writeState({
        mode,
        phase: firstPhase,
        phases,
        data,
        history: firstPhase ? [{ from: null, to: firstPhase, at: now() }] : [],
        startedAt: now(),
        sessionId: sessionId ?? null,
    });
}
/** End the current mode. Returns to idle. */
export function endMode() {
    clearState();
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
export function transition(targetPhase) {
    const state = readState();
    if (!state.mode) {
        return { ok: false, error: 'No active mode', from: null, to: targetPhase ?? '' };
    }
    // Resolve target: explicit or next in sequence
    const target = targetPhase ?? nextPhase(state);
    if (!target) {
        return { ok: false, error: 'No next phase available', from: state.phase, to: '' };
    }
    if (state.phases.length > 0 && !state.phases.includes(target)) {
        return {
            ok: false,
            error: `Phase "${target}" not in [${state.phases.join(', ')}]`,
            from: state.phase,
            to: target,
        };
    }
    if (state.phase === target) {
        return { ok: false, error: `Already in phase "${target}"`, from: state.phase, to: target };
    }
    // Apply transition
    const from = state.phase;
    state.phase = target;
    state.history.push({ from, to: target, at: now() });
    writeState(state);
    return { ok: true, from, to: target };
}
/** Get the next phase in sequence, or null if at the end. */
function nextPhase(state) {
    if (!state.phase || state.phases.length === 0)
        return null;
    const idx = state.phases.indexOf(state.phase);
    if (idx === -1 || idx >= state.phases.length - 1)
        return null;
    return state.phases[idx + 1] ?? null;
}
/** Is the current phase the last one? */
export function isLastPhase() {
    const state = readState();
    if (!state.phase || state.phases.length === 0)
        return true;
    return state.phases.indexOf(state.phase) === state.phases.length - 1;
}
// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
/** Update mode data (shallow merge). */
export function updateData(patch) {
    const state = readState();
    state.data = { ...state.data, ...patch };
    writeState(state);
}
/** Read a single value from mode data. */
export function getData(key) {
    return readState().data[key];
}
// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function now() {
    return new Date().toISOString();
}
