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
import { readState, isLastPhase } from '../core/state.js';
// ---------------------------------------------------------------------------
// 1. Stop guard — block stop while a mode has phases remaining
// ---------------------------------------------------------------------------
export function createStopGuard(modeMessages) {
    const defaultMsg = 'Mode is still active with phases remaining. Complete the current phase or run endMode().';
    return {
        event: 'Stop',
        handle: () => {
            const state = readState();
            if (!state.mode)
                return {};
            // Allow stop if we're at the last phase (work is likely done)
            // Block if there are more phases to go
            if (isLastPhase())
                return {};
            const reason = modeMessages?.[state.mode] ?? defaultMsg;
            return { decision: 'block', reason };
        },
    };
}
// ---------------------------------------------------------------------------
// 2. Prompt enhancer — inject mode + phase context into every prompt
// ---------------------------------------------------------------------------
export function createPromptEnhancer(formatContext) {
    const defaultFormat = (mode, phase, data) => {
        const parts = [`[Mode: ${mode}]`];
        if (phase)
            parts.push(`[Phase: ${phase}]`);
        if (Object.keys(data).length > 0)
            parts.push(`Data: ${JSON.stringify(data)}`);
        return parts.join(' ');
    };
    const fmt = formatContext ?? defaultFormat;
    return {
        event: 'UserPromptSubmit',
        handle: () => {
            const state = readState();
            if (!state.mode)
                return {};
            return { additionalContext: fmt(state.mode, state.phase, state.data) };
        },
    };
}
// ---------------------------------------------------------------------------
// 3. Session resume — restore context when Claude Code resumes a session
// ---------------------------------------------------------------------------
export function createSessionResume() {
    return {
        event: 'SessionStart',
        handle: () => {
            const state = readState();
            if (!state.mode)
                return {};
            const phaseInfo = state.phase ? `, phase: ${state.phase}` : '';
            const remaining = state.phases.length > 0
                ? `\nPhases: [${state.phases.map(p => p === state.phase ? `*${p}*` : p).join(' → ')}]`
                : '';
            return {
                additionalContext: `[Resuming mode: ${state.mode}${phaseInfo}]`
                    + remaining
                    + `\nData: ${JSON.stringify(state.data)}`,
            };
        },
    };
}
