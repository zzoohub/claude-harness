/**
 * Claude Harness — Minimal Multi-Agent Orchestration for Claude Code
 *
 * Architecture: hooks + state machine
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │                     Claude Code                           │
 *   │  fires lifecycle events (SessionStart, PreToolUse, Stop)  │
 *   └────────────────────┬─────────────────────────────────────┘
 *                        │ stdin
 *                        ▼
 *   ┌────────────────────────────────────────────────────────────┐
 *   │                    HookEngine                              │
 *   │  dispatches events to registered handlers, merges outputs  │
 *   └──┬──────────┬──────────┬──────────┬──────────┬───────────┘
 *      │          │          │          │          │
 *      ▼          ▼          ▼          ▼          ▼
 *   context    keywords   delegation  builtins   user hooks
 *   loader     detector   guard       (state)    (custom)
 *      │          │          │          │
 *      │          │          │          ▼
 *      │          │          │     ┌──────────┐
 *      │          └──────────┼────▶│  State   │
 *      │                     │     │  Machine │
 *      │                     │     └──────────┘
 *      │                     │     mode + phase
 *      ▼                     ▼     + transitions
 *   AGENTS.md          "DELEGATE,
 *   CLAUDE.md           DON'T
 *   injection           IMPLEMENT"
 *
 * Config: programmatic > .claude/harness.json > ~/.config/harness/config.json
 */
export { defineConfig } from './core/types.js';
export { PATHS } from './core/paths.js';
export { MODE, EVENT, WRITE_TOOLS } from './core/constants.js';
export { AgentRegistry } from './core/registry.js';
export { HookEngine } from './core/hooks.js';
export { buildSystemPrompt } from './core/prompt.js';
export { loadConfig, loadConfigAsync, loadJsonFile, loadProjectConfig, resolvePrompts } from './core/config.js';
export { readState, writeState, clearState, isActive, startMode, endMode, transition, isLastPhase, updateData, getData, } from './core/state.js';
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export { createStopGuard, createPromptEnhancer, createSessionResume } from './hooks/builtins.js';
export { createDelegationGuard } from './hooks/delegation.js';
export { createKeywordDetector } from './hooks/keywords.js';
export { createContextLoader, findContextFiles, loadContextFiles } from './hooks/context.js';
export { createVerificationHook } from './hooks/verification.js';
export { createRecoveryHook } from './hooks/recovery.js';
export { createLoopMode, createPipelineMode, } from './hooks/modes.js';
export { readMemory, addPriority, addWorking, addManual, pruneWorking, clearMemory, formatMemory, createMemoryHook, createMemoryCapture, } from './hooks/memory.js';
// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------
export { install, uninstall } from './runtime/install.js';
export { runTeam, getTeamStatus, killTeam, } from './runtime/team.js';
import { AgentRegistry } from './core/registry.js';
import { HookEngine } from './core/hooks.js';
import { buildSystemPrompt } from './core/prompt.js';
import { loadConfig } from './core/config.js';
import { createStopGuard, createPromptEnhancer, createSessionResume } from './hooks/builtins.js';
import { createDelegationGuard } from './hooks/delegation.js';
import { createContextLoader } from './hooks/context.js';
import { createVerificationHook } from './hooks/verification.js';
import { createRecoveryHook } from './hooks/recovery.js';
import { createMemoryHook, createMemoryCapture } from './hooks/memory.js';
/**
 * Create a harness instance.
 *
 * Assembles the full orchestration stack:
 *  1. Config merge (file + programmatic)
 *  2. Agent registry
 *  3. System prompt (auto-generated from agents)
 *  4. Hook engine with 10 built-in hooks + user hooks
 */
export function createHarness(config) {
    const resolved = loadConfig(config);
    // 1. Agent registry
    const registry = new AgentRegistry();
    registry.registerAll(resolved.agents);
    // 2. System prompt
    const systemPrompt = resolved.systemPrompt ?? buildSystemPrompt(registry, resolved.systemPromptSuffix);
    // 3. Hook engine — built-in hooks in orchestration order
    const hooks = new HookEngine();
    // SessionStart: system prompt + project context + resume state + memory
    hooks.register({ event: 'SessionStart', handle: () => ({ additionalContext: systemPrompt }) });
    hooks.register(createContextLoader());
    hooks.register(createSessionResume());
    hooks.register(createMemoryHook());
    // UserPromptSubmit: inject active mode context
    hooks.register(createPromptEnhancer());
    // PreToolUse: enforce delegation
    hooks.register(createDelegationGuard());
    // PostToolUse: verify agent work + recover errors + capture <remember> tags
    hooks.register(createVerificationHook());
    hooks.register(createRecoveryHook());
    hooks.register(createMemoryCapture());
    // Stop: block if state machine has phases remaining
    hooks.register(createStopGuard());
    // 4. User-defined hooks (run after built-ins)
    if (resolved.hooks) {
        hooks.registerAll(resolved.hooks);
    }
    return { registry, hooks, systemPrompt, config: resolved };
}
