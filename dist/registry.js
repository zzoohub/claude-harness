/**
 * Agent registry.
 *
 * A simple store that holds agent definitions and can
 * export them in the format Claude Code's SDK expects.
 */
export class AgentRegistry {
    agents = new Map();
    register(name, agent) {
        this.agents.set(name, agent);
    }
    registerAll(agents) {
        for (const [name, agent] of Object.entries(agents)) {
            this.register(name, agent);
        }
    }
    get(name) {
        return this.agents.get(name);
    }
    has(name) {
        return this.agents.has(name);
    }
    names() {
        return [...this.agents.keys()];
    }
    getAll() {
        return Object.fromEntries(this.agents);
    }
    /** Format agents for the Claude Agent SDK's `agents` parameter. */
    toSdkFormat() {
        const out = {};
        for (const [name, a] of this.agents) {
            out[name] = {
                description: a.description,
                prompt: a.prompt,
                ...(a.model && { model: a.model }),
                ...(a.tools && { tools: a.tools }),
                ...(a.disallowedTools && { disallowedTools: a.disallowedTools }),
            };
        }
        return out;
    }
}
