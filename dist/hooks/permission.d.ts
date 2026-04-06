/**
 * PermissionRequest hook — orchestrator delegation enforcement.
 *
 * Two responsibilities:
 *   1. DENY modifying Bash commands → forces delegation to sub-agents
 *   2. DENY Agent calls without subagent_type → forces specialist selection
 *   3. AUTO-ALLOW safe read-only and verification tools
 *
 * When harness mode is active (autopilot/loop), also auto-allows
 * Write/Edit/Agent so the workflow isn't interrupted.
 */
import type { PermissionHookOutput } from '../core/types.js';
interface PermissionRequestInput {
    tool_name: string;
    tool_input: {
        command?: string;
        file_path?: string;
        subagent_type?: string;
        [key: string]: unknown;
    };
}
export declare function handlePermissionRequest(input: PermissionRequestInput): PermissionHookOutput;
export {};
