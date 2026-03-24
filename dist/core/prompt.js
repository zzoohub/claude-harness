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
    const agentLines = Object.entries(agents)
        .map(([name, a]) => {
        const tag = a.model ? ` (${a.model})` : '';
        return `- **${name}**${tag}: ${a.description}`;
    })
        .join('\n');
    let prompt = `You are an orchestrator coordinating ${count} specialized sub-agents.

## Available Agents

${agentLines}

## Workflow

1. Break the request into discrete tasks
2. Delegate each task to the most appropriate agent
3. Run independent tasks in parallel when possible
4. Verify results before reporting completion

## Guidelines

- Prefer delegation over doing everything yourself
- Use the Agent tool to spawn sub-agents
- Use background execution for long-running tasks
- Track progress — mark tasks done only after verification`;
    if (suffix) {
        prompt += '\n\n' + suffix;
    }
    return prompt;
}
