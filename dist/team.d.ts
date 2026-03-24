/**
 * tmux team — true parallel multi-process execution.
 *
 * Spawns multiple Claude Code (or other AI CLI) instances in
 * tmux panes, each working on a separate task simultaneously.
 *
 * This is the scaling mechanism. Without it, tasks run sequentially
 * through the Agent tool. With it, N tasks run in N parallel
 * processes with isolated context windows.
 *
 * Usage: the orchestrator calls these via Bash tool:
 *
 *   1. spawnTeam(tasks)     — create tmux session with task panes
 *   2. getTeamStatus()      — check which panes are still running
 *   3. collectResults()     — read results from completed tasks
 *   4. killTeam()           — terminate the session
 */
export interface TeamTask {
    id: string;
    prompt: string;
    /** CLI to use. Default: "claude" */
    cli?: string;
    /** Additional CLI flags. */
    flags?: string[];
}
export interface TeamSession {
    name: string;
    tasks: TeamTask[];
    startedAt: string;
}
export interface TaskResult {
    id: string;
    status: 'running' | 'done' | 'error';
    output?: string;
}
/**
 * Spawn a team of parallel workers.
 *
 * Creates a tmux session with one pane per task.
 * Each pane runs the specified CLI with the task prompt.
 * Output is captured to .harness/team/results/{id}.txt
 */
export declare function spawnTeam(tasks: TeamTask[]): TeamSession;
/** Check status of each task. */
export declare function getTeamStatus(): TaskResult[];
/** Get completed results only. */
export declare function collectResults(): TaskResult[];
/** Are all tasks done? */
export declare function isTeamDone(): boolean;
/** Kill the tmux session and clean up. */
export declare function killTeam(): void;
