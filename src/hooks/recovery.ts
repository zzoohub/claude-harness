/**
 * Error recovery — auto-detect and recover from common failures.
 *
 * Without this, any error stops the entire pipeline.
 * With this, errors are detected and recovery actions are injected.
 *
 * Three recovery types (checked in priority order):
 *
 *   1. Context window limit — most critical, blocks all progress
 *      → Inject "/compact" instruction to free context
 *
 *   2. Edit conflict — Write/Edit tool fails (old_string not found, etc.)
 *      → Inject "re-read the file before editing" reminder
 *
 *   3. Agent error — sub-agent crashes, times out, or returns error
 *      → Inject retry instruction with error context
 */

import type { HookHandler } from '../core/types.js';
import { WRITE_TOOLS } from '../core/constants.js';
import { readState, updateData } from '../core/state.js';

// ---------------------------------------------------------------------------
// Error patterns
// ---------------------------------------------------------------------------

const CONTEXT_LIMIT_PATTERNS = [
  /context.window/i,
  /token.limit/i,
  /max.tokens/i,
  /too.long/i,
  /prompt.is.too.long/i,
  /context.length/i,
  /maximum.context/i,
];

const EDIT_ERROR_PATTERNS = [
  /old_string.*not found/i,
  /no match found/i,
  /string to replace not found/i,
  /could not find/i,
  /does not exist/i,
  /multiple matches/i,
  /not unique/i,
];

const AGENT_ERROR_PATTERNS = [
  /error:/i,
  /failed/i,
  /timed? ?out/i,
  /panic/i,
  /exception/i,
  /SIGTERM/i,
  /exit code [1-9]/i,
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

type ErrorType = 'context_limit' | 'edit_conflict' | 'agent_error' | null;

function detectError(output: string, toolName?: string): ErrorType {
  if (CONTEXT_LIMIT_PATTERNS.some((p) => p.test(output))) {
    return 'context_limit';
  }

  if (toolName && (WRITE_TOOLS as readonly string[]).includes(toolName)) {
    if (EDIT_ERROR_PATTERNS.some((p) => p.test(output))) {
      return 'edit_conflict';
    }
  }

  if (toolName && /agent/i.test(toolName)) {
    if (AGENT_ERROR_PATTERNS.some((p) => p.test(output))) {
      return 'agent_error';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recovery messages
// ---------------------------------------------------------------------------

const RECOVERY_MESSAGES: Record<string, string> = {
  context_limit:
    `[RECOVERY: Context Window Limit]
Your context is full. Run /compact now to free space, then resume work.
Save any critical findings to memory first:
  <remember priority>key finding here</remember>`,

  edit_conflict:
    `[RECOVERY: Edit Conflict]
The file content has changed since you last read it.
1. Re-read the file with the Read tool
2. Find the correct current content
3. Retry the edit with the updated old_string
Do NOT guess — read first, then edit.`,

  agent_error:
    `[RECOVERY: Agent Error]
The sub-agent encountered an error. Possible causes:
- Task too large for a single agent → split into smaller tasks
- Missing context → provide more specific instructions
- Transient failure → retry once with the same prompt
Do NOT skip the task. Either retry or split it.`,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RecoveryConfig {
  /** Disable specific recovery types. */
  disabled?: ErrorType[];
  /** Custom recovery messages per error type. */
  messages?: Partial<Record<string, string>>;
  /** Max consecutive recoveries before giving up. Default: 3 */
  maxRecoveries?: number;
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

/**
 * Create a recovery hook.
 *
 * Recovery counter is stored in the state machine's data field
 * so it persists across hook invocations and harness recreations.
 */
export function createRecoveryHook(config: RecoveryConfig = {}): HookHandler {
  const disabled = new Set(config.disabled ?? []);
  const messages = { ...RECOVERY_MESSAGES, ...config.messages };
  const maxRecoveries = config.maxRecoveries ?? 3;

  return {
    event: 'PostToolUse',
    handle: (input) => {
      const output = String(input.toolOutput ?? '');
      if (!output) return {};

      const errorType = detectError(output, input.toolName);

      // No error → reset counter
      if (!errorType || disabled.has(errorType)) {
        resetRecoveryCounter();
        return {};
      }

      // Error detected → increment counter
      const count = incrementRecoveryCounter();
      if (count > maxRecoveries) {
        resetRecoveryCounter();
        return {
          additionalContext:
            `[RECOVERY LIMIT] ${maxRecoveries} consecutive errors detected. `
            + `Stop and report the issue to the user instead of retrying.`,
        };
      }

      const message = messages[errorType] ?? `[RECOVERY] Error detected: ${errorType}`;
      return { additionalContext: message };
    },
  };
}

// ---------------------------------------------------------------------------
// Counter (persisted in state machine data)
// ---------------------------------------------------------------------------

function getRecoveryCounter(): number {
  const state = readState();
  return (state.data['_recoveryCount'] as number) ?? 0;
}

function incrementRecoveryCounter(): number {
  const next = getRecoveryCounter() + 1;
  updateData({ _recoveryCount: next });
  return next;
}

function resetRecoveryCounter(): void {
  const state = readState();
  if (state.mode && state.data['_recoveryCount'] !== undefined) {
    updateData({ _recoveryCount: 0 });
  }
}
