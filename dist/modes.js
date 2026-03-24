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
import { startMode, endMode, readState, transition, updateData, isLastPhase, } from './state.js';
const DEFAULT_LOOP_PROMPT = `[Loop mode — iteration {{n}}/{{max}}]
Execute the current task, verify the result, then continue to the next.
Do not stop until all work is verified complete.`;
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
export function createLoopMode(config = {}) {
    const triggers = config.triggers ?? ['loop', '계속'];
    const stopTriggers = config.stopTriggers ?? ['stop', '중단', 'done'];
    const maxIter = config.maxIterations ?? 20;
    const prompt = config.iterationPrompt ?? DEFAULT_LOOP_PROMPT;
    const keywords = [
        {
            triggers,
            action: (text) => {
                startMode('loop', ['execute', 'verify'], { iteration: 1 });
                return formatPrompt(prompt, 1, maxIter);
            },
        },
        {
            triggers: stopTriggers,
            action: () => {
                const state = readState();
                if (state.mode !== 'loop')
                    return;
                endMode();
                return '[Loop ended]';
            },
        },
    ];
    const hooks = [
        // Inject iteration context on each prompt
        {
            event: 'UserPromptSubmit',
            handle: () => {
                const state = readState();
                if (state.mode !== 'loop')
                    return {};
                const iter = state.data.iteration ?? 1;
                // Max iterations check
                if (iter > maxIter) {
                    endMode();
                    return { additionalContext: `[Loop stopped — reached max ${maxIter} iterations]` };
                }
                return { additionalContext: formatPrompt(prompt, iter, maxIter) };
            },
        },
        // After each Stop attempt: advance iteration and continue
        {
            event: 'Stop',
            handle: () => {
                const state = readState();
                if (state.mode !== 'loop')
                    return {};
                const iter = state.data.iteration ?? 1;
                const next = iter + 1;
                if (next > maxIter) {
                    endMode();
                    return {}; // Allow stop
                }
                // Advance iteration, cycle phase back to execute
                updateData({ iteration: next });
                transition('execute');
                return {
                    decision: 'block',
                    reason: `Loop iteration ${iter} complete. Starting iteration ${next}/${maxIter}.`,
                };
            },
        },
    ];
    return { keywords, hooks };
}
const DEFAULT_PHASES = ['understand', 'plan', 'execute', 'verify'];
const DEFAULT_PHASE_PROMPTS = {
    understand: '[Phase: Understand] Analyze the request. Identify requirements, constraints, and unknowns. Delegate to explore agents.',
    plan: '[Phase: Plan] Create a step-by-step work plan. Delegate to planning agents. Write the plan to .harness/',
    execute: '[Phase: Execute] Implement the plan. Delegate each task to the appropriate agent. Run tasks in parallel where possible.',
    verify: '[Phase: Verify] Verify ALL work. Run tests, check builds, read the actual code. Do not trust agent self-reports.',
};
/**
 * Create a pipeline mode.
 *
 * Advances through phases linearly. On the verify phase,
 * if verification fails, loops back to execute (bounded by maxRetries).
 *
 * State data: { retries: number }
 */
export function createPipelineMode(config = {}) {
    const triggers = config.triggers ?? ['autopilot', 'auto', '파이프라인'];
    const phases = config.phases ?? DEFAULT_PHASES;
    const prompts = { ...DEFAULT_PHASE_PROMPTS, ...config.phasePrompts };
    const maxRetries = config.maxRetries ?? 3;
    const keywords = [
        {
            triggers,
            action: () => {
                startMode('pipeline', phases, { retries: 0 });
                const firstPhase = phases[0];
                return prompts[firstPhase] ?? `[Phase: ${firstPhase}]`;
            },
        },
    ];
    const hooks = [
        // Inject phase-specific context on each prompt
        {
            event: 'UserPromptSubmit',
            handle: () => {
                const state = readState();
                if (state.mode !== 'pipeline' || !state.phase)
                    return {};
                const ctx = prompts[state.phase] ?? `[Phase: ${state.phase}]`;
                const progress = `[${phases.indexOf(state.phase) + 1}/${phases.length}]`;
                return { additionalContext: `${progress} ${ctx}` };
            },
        },
        // On Stop: advance to next phase instead of stopping
        {
            event: 'Stop',
            handle: () => {
                const state = readState();
                if (state.mode !== 'pipeline' || !state.phase)
                    return {};
                // If at last phase → actually done
                if (isLastPhase()) {
                    endMode();
                    return {}; // Allow stop
                }
                // Advance to next phase
                const result = transition();
                if (!result.ok) {
                    endMode();
                    return {};
                }
                const ctx = prompts[result.to] ?? `[Phase: ${result.to}]`;
                return {
                    decision: 'block',
                    reason: `Phase "${result.from}" complete. Moving to "${result.to}". ${ctx}`,
                };
            },
        },
        // Special: on verify phase failure, loop back to execute
        {
            event: 'PreToolUse',
            matcher: 'Agent',
            handle: (input) => {
                const state = readState();
                if (state.mode !== 'pipeline')
                    return {};
                // Detect "fix" delegation during verify phase
                const isVerifyPhase = state.phase === 'verify' || state.phase === phases[phases.length - 1];
                if (!isVerifyPhase)
                    return {};
                const prompt = input.toolInput?.prompt ?? '';
                const isFix = /\b(fix|수정|bug|error|fail)\b/i.test(prompt);
                if (!isFix)
                    return {};
                const retries = state.data.retries ?? 0;
                if (retries >= maxRetries) {
                    return {
                        additionalContext: `[Max retries (${maxRetries}) reached. Complete what you can and report remaining issues.]`,
                    };
                }
                // Loop back to execute phase
                updateData({ retries: retries + 1 });
                const executePhase = phases.includes('execute') ? 'execute' : phases[Math.max(0, phases.length - 2)];
                transition(executePhase);
                return {
                    additionalContext: `[Fix loop ${retries + 1}/${maxRetries}: returning to ${executePhase} phase]`,
                };
            },
        },
    ];
    return { keywords, hooks };
}
// ===========================================================================
// Helpers
// ===========================================================================
function formatPrompt(template, iteration, max) {
    return template
        .replace(/\{\{n\}\}/g, String(iteration))
        .replace(/\{\{max\}\}/g, String(max));
}
