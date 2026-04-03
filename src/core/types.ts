/**
 * Core types for the orchestration harness.
 *
 * This is the only file you need to read to understand the data model.
 * Everything else operates on these types.
 */

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/** A sub-agent that the orchestrator can delegate work to. */
export interface Agent {
  description: string;
  /** Inline prompt, or "file:path/to/prompt.md" to load from disk. */
  prompt: string;
  model?: 'haiku' | 'sonnet' | 'opus';
  tools?: string[];
  disallowedTools?: string[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Lifecycle events that Claude Code fires. */
export type HookEvent =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop';

/** What Claude Code sends to a hook command via stdin. */
export interface HookInput {
  event: HookEvent;
  sessionId: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  prompt?: { content: Array<{ type: string; text?: string }> };
  stopReason?: string;
}

/** What we return to Claude Code via stdout. */
export interface HookOutput {
  /** Text injected into the conversation as system context. */
  additionalContext?: string;
  /** Block a tool call (PreToolUse) or prevent stopping (Stop). */
  decision?: 'allow' | 'block';
  /** Reason shown when blocking. */
  reason?: string;
}

/** A user-defined handler that reacts to a lifecycle event. */
export interface HookHandler {
  event: HookEvent;
  /** Regex — only fires when toolName matches. Applies to PreToolUse/PostToolUse. */
  matcher?: string;
  handle: (input: HookInput) => HookOutput | Promise<HookOutput>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Programmatic config passed to createHarness(). */
export interface HarnessConfig {
  agents: Record<string, Agent>;
  hooks?: HookHandler[];
  /** Replace the auto-generated system prompt entirely. */
  systemPrompt?: string;
  /** Append extra instructions after the auto-generated prompt. */
  systemPromptSuffix?: string;
}

/** Shape of the JSON config files (.claude/harness.json, etc.). */
export interface FileConfig {
  /** JSON Schema reference — ignored at runtime. */
  $schema?: string;
  agents?: Record<string, Agent>;
  systemPromptSuffix?: string;
}

/**
 * Identity helper for type-safe config authoring.
 *
 * Usage in .claude/harness.config.mjs (or .ts with a build step):
 *   import { defineConfig } from 'claude-harness';
 *   export default defineConfig({ agents: { ... } });
 */
export function defineConfig(config: FileConfig): FileConfig {
  return config;
}
