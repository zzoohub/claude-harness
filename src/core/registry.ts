/**
 * Agent registry.
 *
 * A simple store that holds agent definitions and can
 * export them in the format Claude Code's SDK expects.
 */

import type { Agent } from './types.js';

interface SdkAgent {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
  disallowedTools?: string[];
}

export class AgentRegistry {
  private agents = new Map<string, Agent>();

  register(name: string, agent: Agent): void {
    this.agents.set(name, agent);
  }

  registerAll(agents: Record<string, Agent>): void {
    for (const [name, agent] of Object.entries(agents)) {
      this.register(name, agent);
    }
  }

  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  names(): string[] {
    return [...this.agents.keys()];
  }

  getAll(): Record<string, Agent> {
    return Object.fromEntries(this.agents);
  }

  /** Format agents for the Claude Agent SDK's `agents` parameter. */
  toSdkFormat(): Record<string, SdkAgent> {
    const out: Record<string, SdkAgent> = {};

    for (const [name, a] of this.agents) {
      const entry: SdkAgent = { description: a.description, prompt: a.prompt };
      if (a.model) entry.model = a.model;
      if (a.tools) entry.tools = a.tools;
      if (a.disallowedTools) entry.disallowedTools = a.disallowedTools;
      out[name] = entry;
    }

    return out;
  }
}
