/**
 * tmux team — leader/worker protocol for parallel execution.
 *
 * Two layers:
 *
 *   Low-level (process management):
 *     spawnWorkers()  — create tmux panes with tasks
 *     pollWorkers()   — check which panes finished
 *     killWorkers()   — terminate session
 *
 *   High-level (orchestration protocol):
 *     runTeam()       — the full leader/worker pipeline:
 *       1. Split tasks into batches (max panes per batch)
 *       2. Spawn batch of workers
 *       3. Poll until all done
 *       4. Collect results
 *       5. Identify failures → retry queue
 *       6. If retries remain, spawn retry batch
 *       7. Repeat until all done or max retries
 *       8. Return merged results
 *
 * The leader (orchestrator) calls runTeam() once.
 * Everything else is deterministic — no Claude judgment needed.
 */
export interface TeamTask {
    id: string;
    prompt: string;
    /** CLI to use. Default: "claude" */
    cli?: string;
    /** Additional CLI flags. */
    flags?: string[];
}
export interface TaskResult {
    id: string;
    status: 'done' | 'error';
    output: string;
    attempts: number;
}
export interface TeamConfig {
    /** Max concurrent panes per batch. Default: 4 */
    concurrency?: number;
    /** Max retry attempts per failed task. Default: 2 */
    maxRetries?: number;
    /** Polling interval in ms. Default: 5000 */
    pollIntervalMs?: number;
}
export interface TeamReport {
    succeeded: TaskResult[];
    failed: TaskResult[];
    totalTasks: number;
    totalTime: number;
}
/**
 * Run the full leader/worker pipeline.
 *
 * This is the ONLY function the orchestrator needs to call.
 * Everything else (batching, polling, retrying) is automatic.
 *
 * @example
 *   const report = runTeam([
 *     { id: 'users', prompt: 'Migrate users endpoint to v2' },
 *     { id: 'orders', prompt: 'Migrate orders endpoint to v2' },
 *     { id: 'products', prompt: 'Migrate products endpoint to v2' },
 *   ]);
 *
 *   // report.succeeded = [{id:'users',...}, {id:'orders',...}]
 *   // report.failed = [{id:'products',...}]
 */
export declare function runTeam(tasks: TeamTask[], config?: TeamConfig): TeamReport;
/** Check status of current session. */
export declare function getTeamStatus(): Array<{
    id: string;
    done: boolean;
}>;
/** Kill any active team session. */
export declare function killTeam(): void;
