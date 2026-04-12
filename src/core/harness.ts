/**
 * Harness factory — assembles the full orchestration stack.
 *
 *  1. Config merge (file + programmatic)
 *  2. Agent registry
 *  3. System prompt (auto-generated from agents)
 *  4. Hook engine with built-in hooks + user hooks
 */

import type { HarnessConfig } from './types.js';
import { AgentRegistry } from './registry.js';
import { HookEngine } from './hooks.js';
import { buildSystemPrompt } from './prompt.js';
import { loadConfig } from './config.js';
import { createStopGuard, createPromptEnhancer, createSessionResume } from '../hooks/builtins.js';
import { createDelegationGuard } from '../hooks/delegation.js';
import { createContextLoader } from '../hooks/context.js';
import { createVerificationHook } from '../hooks/verification.js';
import { createRecoveryHook } from '../hooks/recovery.js';
import { createMemoryHook, createMemoryCapture } from '../hooks/memory.js';
import { createKeywordDetector } from '../hooks/keywords.js';
import { createLoopMode, createPipelineMode } from '../hooks/modes.js';

export interface Harness {
  registry: AgentRegistry;
  hooks: HookEngine;
  systemPrompt: string;
  config: HarnessConfig;
}

export function createHarness(config: HarnessConfig): Harness {
  const resolved = loadConfig(config);

  // 1. Agent registry (optional — zero-config works without agents)
  const registry = new AgentRegistry();
  if (resolved.agents) {
    registry.registerAll(resolved.agents);
  }

  // 2. System prompt
  const systemPrompt =
    resolved.systemPrompt ?? buildSystemPrompt(registry, resolved.systemPromptSuffix);

  // 3. Hook engine — built-in hooks in orchestration order
  const hooks = new HookEngine();

  // SessionStart: system prompt + project context + resume state + memory
  hooks.register({ event: 'SessionStart', handle: () => ({ additionalContext: systemPrompt }) });
  hooks.register(createContextLoader());
  hooks.register(createSessionResume());
  hooks.register(createMemoryHook());

  // UserPromptSubmit: built-in modes (loop + pipeline) + keyword detection
  const loop = createLoopMode();
  const pipeline = createPipelineMode();
  hooks.register(createKeywordDetector([...loop.keywords, ...pipeline.keywords]));
  for (const h of [...loop.hooks, ...pipeline.hooks]) hooks.register(h);

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
