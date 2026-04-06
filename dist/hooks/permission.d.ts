/**
 * PermissionRequest hook — auto-allow tools when autopilot mode is active.
 *
 * Claude Code fires PermissionRequest before asking the user to approve
 * a tool call. This hook intercepts it and returns `behavior: 'allow'`
 * when a harness mode (autopilot/loop) is running, so the workflow
 * isn't interrupted by permission prompts.
 *
 * Security: dangerous shell metacharacters are still rejected.
 */
import type { PermissionHookOutput } from '../core/types.js';
interface PermissionRequestInput {
    tool_name: string;
    tool_input: {
        command?: string;
        file_path?: string;
        [key: string]: unknown;
    };
}
export declare function handlePermissionRequest(input: PermissionRequestInput): PermissionHookOutput;
export {};
