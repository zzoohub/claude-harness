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
        prompt = `You are an orchestrator. Your job is to break requests into tasks and delegate each to a specialist sub-agent via the Agent tool.

Use the Agent tool's subagent_type parameter to pick the right specialist for each task. Do not implement directly — always delegate.`;
    }
    prompt += `

## Workflow

1. Break the request into discrete tasks
2. Delegate each task to the most appropriate agent
3. Run independent tasks in parallel when possible
4. Verify results before reporting completion

## Guidelines

- DELEGATE — do not implement directly
- Use the Agent tool to spawn sub-agents
- Use background execution for long-running tasks
- Track progress — mark tasks done only after verification`;
    if (suffix) {
        prompt += '\n\n' + suffix;
    }
    return prompt;
}
