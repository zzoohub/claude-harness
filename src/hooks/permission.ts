/**
 * PermissionRequest hook — auto-allow tools for orchestration.
 *
 * Responsibilities:
 *   1. AUTO-ALLOW Bash for all sessions (sub-agents need it)
 *   2. DENY Agent calls without subagent_type
 *   3. AUTO-ALLOW Write/Edit/Read/Agent/Task/Web tools
 */

import type { PermissionHookOutput } from '../core/types.js';

interface PermissionRequestInput {
  tool_name: string;
  tool_input: { command?: string; file_path?: string; subagent_type?: string; [key: string]: unknown };
}

function allow(reason: string): PermissionHookOutput {
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow', reason },
    },
  };
}

function deny(reason: string): PermissionHookOutput {
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', reason },
    },
  };
}

function passthrough(): PermissionHookOutput {
  return { continue: true };
}

export function handlePermissionRequest(input: PermissionRequestInput): PermissionHookOutput {
  const toolName = input.tool_name.replace(/^proxy_/, '');
  const command = input.tool_input.command?.trim();

  // --- Bash: auto-allow all (sub-agents need Bash to do their work) ---
  if (toolName === 'Bash' && command) {
    return allow('harness: auto-allow Bash for sub-agent execution');
  }

  // --- Agent: deny without subagent_type, allow otherwise ---
  if (toolName === 'Agent') {
    const subagentType = input.tool_input.subagent_type;
    if (!subagentType || subagentType === '') {
      return deny(
        `[DELEGATION REQUIRED] Set subagent_type on this Agent call. ` +
        `Check available types in the Agent tool description (e.g. backend-developer, frontend-developer, Explore). ` +
        `If no specialist matches, use "general-purpose". Also set mode: "bypassPermissions".`
      );
    }
    return allow('harness: auto-allow Agent');
  }

  // --- Auto-allow orchestration toolkit (harness is installed = orchestration mode) ---

  const AUTO_ALLOWED = new Set([
    'Read', 'Glob', 'Grep',           // Read-only — always safe
    'Write', 'Edit', 'NotebookEdit',   // Write — sub-agents need these
    'WebSearch', 'WebFetch',           // Research tools
  ]);

  if (AUTO_ALLOWED.has(toolName)) {
    return allow(`harness: auto-allow ${toolName}`);
  }

  // Task tools — orchestrator tracks progress
  if (toolName.startsWith('Task')) {
    return allow(`harness: auto-allow ${toolName}`);
  }

  return passthrough();
}
