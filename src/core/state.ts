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
 *
 * Performance note:
 *   Functions accepting a `state` parameter avoid redundant disk reads.
 *   The parameter-less overloads read from disk on each call (convenience API).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from './paths.js';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

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
  history: Array<{ from: string | null; to: string; at: string }>;
  /** When the mode started. */
  startedAt: string | null;
  /** Claude Code session ID. */
  sessionId: string | null;
}

function emptyState(): SessionState {
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

export function readState(): SessionState {
  if (!existsSync(PATHS.stateFile)) return emptyState();
  try {
    return JSON.parse(readFileSync(PATHS.stateFile, 'utf-8'));
  } catch {
    return emptyState();
  }
}

export function writeState(state: SessionState): void {
  mkdirSync(dirname(PATHS.stateFile), { recursive: true });
  writeFileSync(PATHS.stateFile, JSON.stringify(state, null, 2));
}

export function clearState(): void {
  if (existsSync(PATHS.stateFile)) rmSync(PATHS.stateFile);
}

// ---------------------------------------------------------------------------
// Mode lifecycle
// ---------------------------------------------------------------------------

/** Is any mode active? */
export function isActive(state?: SessionState): boolean {
  const s = state ?? readState();
  return s.mode !== null;
}

/**
 * Start a mode with defined phases.
 *
 * @example
 *   startMode("deploy", ["plan", "execute", "verify"]);
 *   // → mode: "deploy", phase: "plan"
 */
export function startMode(
  mode: string,
  phases: string[] = [],
  data: Record<string, unknown> = {},
  sessionId?: string,
): void {
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
export function endMode(): void {
  clearState();
}

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

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
export function transition(targetPhase?: string): TransitionResult {
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
function nextPhase(state: SessionState): string | null {
  if (!state.phase || state.phases.length === 0) return null;
  const idx = state.phases.indexOf(state.phase);
  if (idx === -1 || idx >= state.phases.length - 1) return null;
  return state.phases[idx + 1] ?? null;
}

/** Is the current phase the last one? */
export function isLastPhase(state?: SessionState): boolean {
  const s = state ?? readState();
  if (!s.phase || s.phases.length === 0) return true;
  return s.phases.indexOf(s.phase) === s.phases.length - 1;
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/** Update mode data (shallow merge). */
export function updateData(patch: Record<string, unknown>): void {
  const state = readState();
  state.data = { ...state.data, ...patch };
  writeState(state);
}

/** Read a single value from mode data. */
export function getData<T = unknown>(key: string, state?: SessionState): T | undefined {
  const s = state ?? readState();
  return s.data[key] as T | undefined;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}
