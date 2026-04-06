/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, modifying tool calls get blocked, forcing Claude to
 * use the Agent tool to delegate work.
 *
 * Three enforcement layers:
 *   1. Bash guard — blocks modifying Bash commands (allows read-only/verify)
 *   2. Agent guard — blocks Agent calls without subagent_type
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
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
 * Three layers:
 *   1. Bash guard — blocks modifying commands, allows read-only/verification
 *   2. Agent guard — blocks Agent calls without subagent_type
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 */
export declare function createDelegationGuard(config?: DelegationConfig): HookHandler;
