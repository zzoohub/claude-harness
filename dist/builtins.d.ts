/**
 * Built-in hooks — the glue between hooks and state machine.
 *
 * These hooks read the state machine on every invocation and
 * produce appropriate responses to Claude Code:
 *
 *   SessionStart    → re-inject mode/phase context on resume
 *   UserPromptSubmit → remind Claude of current mode and phase
 *   Stop            → block stopping if a phase isn't complete
 *
 * Together with state.ts, this implements the "hooks + state machine"
 * pattern described by the OMC founder.
 */
import type { HookHandler } from './types.js';
export declare function createStopGuard(modeMessages?: Record<string, string>): HookHandler;
export declare function createPromptEnhancer(formatContext?: (mode: string, phase: string | null, data: Record<string, unknown>) => string): HookHandler;
export declare function createSessionResume(): HookHandler;
