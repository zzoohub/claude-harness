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
export type { Agent, HookEvent, HookInput, HookOutput, HookHandler, HarnessConfig, FileConfig, } from './core/types.js';
export { defineConfig } from './core/types.js';
export { PATHS } from './core/paths.js';
export { MODE, EVENT, WRITE_TOOLS } from './core/constants.js';
export { AgentRegistry } from './core/registry.js';
export { HookEngine } from './core/hooks.js';
export { buildSystemPrompt } from './core/prompt.js';
export { loadConfig, loadConfigAsync, loadJsonFile, loadProjectConfig, resolvePrompts } from './core/config.js';
export { readState, writeState, clearState, isActive, startMode, endMode, transition, isLastPhase, updateData, getData, type SessionState, type TransitionResult, } from './core/state.js';
export { createStopGuard, createPromptEnhancer, createSessionResume } from './hooks/builtins.js';
export { createDelegationGuard, type DelegationConfig } from './hooks/delegation.js';
export { createKeywordDetector, type KeywordRule } from './hooks/keywords.js';
export { createContextLoader, findContextFiles, loadContextFiles } from './hooks/context.js';
export { createVerificationHook, type VerificationConfig } from './hooks/verification.js';
export { createRecoveryHook, type RecoveryConfig } from './hooks/recovery.js';
export { createLoopMode, createPipelineMode, type LoopConfig, type PipelineConfig, } from './hooks/modes.js';
export { readMemory, addPriority, addWorking, addManual, pruneWorking, clearMemory, formatMemory, createMemoryHook, createMemoryCapture, } from './hooks/memory.js';
export { install, uninstall } from './runtime/install.js';
export { runTeam, getTeamStatus, killTeam, type TeamTask, type TeamConfig, type TeamReport, type TaskResult, } from './runtime/team.js';
import type { HarnessConfig } from './core/types.js';
import { AgentRegistry } from './core/registry.js';
import { HookEngine } from './core/hooks.js';
export interface Harness {
    registry: AgentRegistry;
    hooks: HookEngine;
    systemPrompt: string;
    config: HarnessConfig;
}
/**
 * Create a harness instance.
 *
 * Assembles the full orchestration stack:
 *  1. Config merge (file + programmatic)
 *  2. Agent registry
 *  3. System prompt (auto-generated from agents)
 *  4. Hook engine with 10 built-in hooks + user hooks
 */
export declare function createHarness(config: HarnessConfig): Harness;
