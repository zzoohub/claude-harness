/**
 * PermissionRequest hook — auto-allow tools for orchestration.
 *
 * Responsibilities:
 *   1. AUTO-ALLOW Bash for all sessions (sub-agents need it)
 *   2. DENY Agent calls without subagent_type
 *   3. AUTO-ALLOW Write/Edit/Read/Agent/Task/Web tools
 */
function allow(reason) {
    return {
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: { behavior: 'allow', reason },
        },
    };
}
function deny(reason) {
    return {
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: { behavior: 'deny', reason },
        },
    };
}
function passthrough() {
    return { continue: true };
}
export function handlePermissionRequest(input) {
    const toolName = input.tool_name.replace(/^proxy_/, '');
    const command = input.tool_input.command?.trim();
    // --- Bash: auto-allow all (sub-agents need Bash to do their work) ---
    if (toolName === 'Bash' && command) {
        return allow('harness: auto-allow Bash for sub-agent execution');
    }
    // --- Agent: deny without subagent_type ---
    if (toolName === 'Agent') {
        const subagentType = input.tool_input.subagent_type;
        if (!subagentType || subagentType === '') {
            return deny(`[DELEGATION REQUIRED] Set subagent_type on this Agent call. ` +
                `Check available types in the Agent tool description (e.g. backend-developer, frontend-developer, Explore). ` +
                `If no specialist matches, use "general-purpose". Also set mode: "bypassPermissions".`);
        }
    }
    // --- Auto-allow orchestration toolkit (harness is installed = orchestration mode) ---
    // Read-only tools — always safe
    if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Write tools — sub-agents need these to implement
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Agent — already passed subagent_type check above
    if (toolName === 'Agent') {
        return allow(`harness: auto-allow Agent`);
    }
    // Research tools
    if (toolName === 'WebSearch' || toolName === 'WebFetch') {
        return allow(`harness: auto-allow ${toolName}`);
    }
    // Task tools — orchestrator tracks progress
    if (toolName.startsWith('Task')) {
        return allow(`harness: auto-allow ${toolName}`);
    }
    return passthrough();
}
