/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, Write/Edit attempts outside allowed paths get blocked,
 * forcing Claude to use the Agent tool to delegate work.
 *
 * This is OMC's #1 core behavior: "DELEGATE. DON'T IMPLEMENT."
 */
import type { HookHandler } from '../core/types.js';
export interface DelegationConfig {
    /** Paths the orchestrator IS allowed to modify directly (regex patterns). */
    allowedPaths?: RegExp[];
    /** 'warn' = inject reminder but allow. 'strict' = block the tool call. */
    enforcement?: 'warn' | 'strict' | 'off';
}
/**
 * Create a delegation enforcement hook.
 *
 * Intercepts Write/Edit tool calls. If the target path is outside
 * allowed patterns, either warns or blocks depending on config.
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 *   // → blocks all Write/Edit outside .harness/, .claude/, CLAUDE.md
 */
export declare function createDelegationGuard(config?: DelegationConfig): HookHandler;
