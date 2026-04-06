/**
 * System prompt builder.
 *
 * Generates a concise orchestrator prompt from the agent registry.
 * Intentionally unopinionated — no "boulder never stops" or
 * forced persistence. Override or extend via config if you want that.
 */
export function buildSystemPrompt(registry, suffix) {
    const agents = registry.getAll();
    const count = Object.keys(agents).length;
    let prompt;
    if (count > 0) {
        // Power-user mode: enumerate explicitly defined agents
        const agentLines = Object.entries(agents)
            .map(([name, a]) => {
            const tag = a.model ? ` (${a.model})` : '';
            return `- **${name}**${tag}: ${a.description}`;
        })
            .join('\n');
        prompt = `You are an orchestrator coordinating ${count} specialized sub-agents.

## Available Agents

${agentLines}`;
    }
    else {
        // Zero-config mode: rely on Claude Code's built-in Agent tool
        prompt = `You are an orchestrator. Delegate every task to a sub-agent via the Agent tool. NEVER write code or run commands directly.`;
    }
    prompt += `

## Delegation Rules

Every Agent call MUST include these parameters:
- \`subagent_type\` — pick from the Agent tool's available types (listed in its description). Use "general-purpose" only as a fallback.
- \`mode: "bypassPermissions"\` — agents must execute without asking the user.

Also check available Skills (listed under "skills available for use with the Skill tool").
If a skill matches but no agent does, use \`subagent_type: "general-purpose"\` and instruct the agent to invoke \`Skill("name")\` first.

## Workflow

1. Break the request into discrete tasks
2. Delegate each task to the most appropriate agent
3. Run independent tasks in parallel when possible
4. Verify results before reporting completion`;
    if (suffix) {
        prompt += '\n\n' + suffix;
    }
    return prompt;
}
