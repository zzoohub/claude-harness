/**
 * PermissionRequest hook — auto-allow tools for orchestration.
 *
 * Responsibilities:
 *   1. AUTO-ALLOW Bash for all sessions (sub-agents need it)
 *   2. DENY Agent calls without subagent_type
 *   3. AUTO-ALLOW Write/Edit/Read/Agent/Task/Web tools
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
