/**
 * Hook engine.
 *
 * Dispatches Claude Code lifecycle events to registered handlers.
 * Multiple handlers can match the same event — their outputs are
 * merged in registration order. A "block" decision short-circuits.
 */

import type { HookHandler, HookInput, HookOutput } from './types.js';

export class HookEngine {
  private handlers: Array<{ handler: HookHandler; matcherRe: RegExp | null }> = [];

  register(handler: HookHandler): void {
    const matcherRe = handler.matcher ? new RegExp(handler.matcher) : null;
    this.handlers.push({ handler, matcherRe });
  }

  registerAll(handlers: HookHandler[]): void {
    for (const h of handlers) this.register(h);
  }

  /** Run all matching handlers and merge their outputs. */
  async process(input: HookInput): Promise<HookOutput> {
    const matching = this.handlers.filter((entry) => this.matches(entry, input));

    let merged: HookOutput = {};

    for (const { handler } of matching) {
      const result = await handler.handle(input);
      merged = mergeOutputs(merged, result);

      // Short-circuit: block stops further processing
      if (result.decision === 'block') break;
    }

    return merged;
  }

  private matches(
    entry: { handler: HookHandler; matcherRe: RegExp | null },
    input: HookInput,
  ): boolean {
    if (entry.handler.event !== input.event) return false;

    // If handler has a matcher, test it against toolName
    if (entry.matcherRe && input.toolName) {
      return entry.matcherRe.test(input.toolName);
    }

    // No matcher = match all events of this type
    return !entry.matcherRe;
  }
}

// ---------------------------------------------------------------------------
// Output merging
// ---------------------------------------------------------------------------

function mergeOutputs(prev: HookOutput, next: HookOutput): HookOutput {
  const ctx = joinStrings(prev.additionalContext, next.additionalContext);
  const decision = next.decision === 'block' ? 'block' : (prev.decision ?? next.decision);
  const reason = next.reason ?? prev.reason;
  const result: HookOutput = {};
  if (ctx !== undefined) result.additionalContext = ctx;
  if (decision !== undefined) result.decision = decision;
  if (reason !== undefined) result.reason = reason;
  return result;
}

function joinStrings(a?: string, b?: string): string | undefined {
  const parts = [a, b].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : undefined;
}
