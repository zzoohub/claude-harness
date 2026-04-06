/**
 * Delegation enforcement — the mechanism that makes an orchestrator
 * an ORCHESTRATOR, not just "Claude with extra agents."
 *
 * Without this, Claude writes code directly instead of delegating.
 * With this, Write/Edit attempts outside allowed paths get blocked,
 * forcing Claude to use the Agent tool to delegate work.
 *
 * Three enforcement layers:
 *   1. Write/Edit guard — blocks direct file modification
 *   2. Bash guard — blocks Bash during execute phase (must delegate)
 *   3. Agent guard — reminds when subagent_type is missing
 */
import type { HookHandler } from '../core/types.js';
export interface DelegationConfig {
    /** Paths the orchestrator IS allowed to modify directly (regex patterns). */
    allowedPaths?: RegExp[];
    /** 'warn' = inject reminder but allow. 'strict' = block the tool call. */
    enforcement?: 'warn' | 'strict' | 'off';
    /** Phases where Bash is blocked. Default: ['execute'] */
    bashBlockedPhases?: string[];
}
/**
 * Create a delegation enforcement hook.
 *
 * Three layers:
 *   1. Bash guard — blocks Bash during execute phase of active pipeline
 *   2. Agent guard — injects reminder when subagent_type is missing
 *   3. Write/Edit guard — blocks direct file modification outside allowed paths
 *
 * @example
 *   createDelegationGuard({ enforcement: 'strict' })
 */
export declare function createDelegationGuard(config?: DelegationConfig): HookHandler;
