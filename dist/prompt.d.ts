/**
 * System prompt builder.
 *
 * Generates a concise orchestrator prompt from the agent registry.
 * Intentionally unopinionated — no "boulder never stops" or
 * forced persistence. Override or extend via config if you want that.
 */
import type { AgentRegistry } from './registry.js';
export declare function buildSystemPrompt(registry: AgentRegistry, suffix?: string): string;
