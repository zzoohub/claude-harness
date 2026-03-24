/**
 * Agent registry.
 *
 * A simple store that holds agent definitions and can
 * export them in the format Claude Code's SDK expects.
 */
import type { Agent } from './types.js';
export declare class AgentRegistry {
    private agents;
    register(name: string, agent: Agent): void;
    registerAll(agents: Record<string, Agent>): void;
    get(name: string): Agent | undefined;
    has(name: string): boolean;
    names(): string[];
    getAll(): Record<string, Agent>;
    /** Format agents for the Claude Agent SDK's `agents` parameter. */
    toSdkFormat(): Record<string, {
        description: string;
        prompt: string;
        model?: string;
        tools?: string[];
        disallowedTools?: string[];
    }>;
}
