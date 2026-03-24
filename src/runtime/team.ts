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

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { PATHS } from '../core/paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// tmux low-level
// ---------------------------------------------------------------------------

function tmuxExists(): boolean {
  try {
    execFileSync('which', ['tmux'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sessionExists(name: string): boolean {
  try {
    execFileSync('tmux', ['has-session', '-t', name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function tmux(...args: string[]): void {
  execFileSync('tmux', args, { stdio: 'ignore' });
}

function buildShellCommand(task: TeamTask, resultDir: string): string {
  const cli = task.cli ?? 'claude';
  const flags = task.flags ?? [];
  const resultFile = join(process.cwd(), resultDir, `${task.id}.txt`);
  const args = [cli, '--print', task.prompt, ...flags];
  const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
  return `${escaped} > '${resultFile}' 2>&1; echo '[DONE]' >> '${resultFile}'`;
}

// ---------------------------------------------------------------------------
// Worker management (low-level)
// ---------------------------------------------------------------------------

function spawnWorkers(batch: TeamTask[], sessionName: string): void {
  mkdirSync(PATHS.teamResults, { recursive: true });

  const first = batch[0]!;
  tmux('new-session', '-d', '-s', sessionName, '-x', '200', '-y', '50',
    buildShellCommand(first, PATHS.teamResults));

  for (let i = 1; i < batch.length; i++) {
    const task = batch[i]!;
    tmux('split-window', '-t', sessionName, '-h',
      buildShellCommand(task, PATHS.teamResults));
    tmux('select-layout', '-t', sessionName, 'tiled');
  }
}

function readResult(taskId: string): { done: boolean; output: string } {
  const file = join(PATHS.teamResults, `${taskId}.txt`);
  if (!existsSync(file)) return { done: false, output: '' };

  const content = readFileSync(file, 'utf-8');
  if (!content.includes('[DONE]')) return { done: false, output: content };

  return { done: true, output: content.replace('[DONE]', '').trim() };
}

function isError(output: string): boolean {
  const errorPatterns = [
    /error:/i,
    /fatal:/i,
    /panic:/i,
    /FAILED/,
    /exit code [1-9]/i,
  ];
  return errorPatterns.some((p) => p.test(output));
}

function sleep(ms: number): void {
  execFileSync('sleep', [String(ms / 1000)]);
}

// ---------------------------------------------------------------------------
// Leader protocol (high-level)
// ---------------------------------------------------------------------------

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
export function runTeam(tasks: TeamTask[], config: TeamConfig = {}): TeamReport {
  if (!tmuxExists()) {
    throw new Error('tmux is not installed. Install with: brew install tmux');
  }
  if (tasks.length === 0) {
    return { succeeded: [], failed: [], totalTasks: 0, totalTime: 0 };
  }

  const concurrency = config.concurrency ?? 4;
  const maxRetries = config.maxRetries ?? 2;
  const pollInterval = config.pollIntervalMs ?? 5000;
  const startTime = Date.now();

  // Track attempts per task
  const attempts = new Map<string, number>();
  for (const t of tasks) attempts.set(t.id, 0);

  // Results accumulator
  const results = new Map<string, TaskResult>();

  // Queue starts with all tasks
  let queue = [...tasks];

  while (queue.length > 0) {
    // 1. Take a batch from the queue
    const batch = queue.slice(0, concurrency);
    queue = queue.slice(concurrency);

    // 2. Spawn workers
    const sessionName = `harness-${Date.now()}`;
    spawnWorkers(batch, sessionName);

    // Save session for cleanup
    writeFileSync(PATHS.teamSession, JSON.stringify({
      name: sessionName,
      tasks: batch,
      startedAt: new Date().toISOString(),
    }));

    // 3. Poll until all done
    const pending = new Set(batch.map((t) => t.id));

    while (pending.size > 0) {
      sleep(pollInterval);

      for (const taskId of [...pending]) {
        const result = readResult(taskId);
        if (!result.done) continue;

        pending.delete(taskId);
        const attempt = (attempts.get(taskId) ?? 0) + 1;
        attempts.set(taskId, attempt);

        if (isError(result.output) && attempt < maxRetries) {
          // Re-queue for retry
          const original = tasks.find((t) => t.id === taskId);
          if (original) queue.push(original);
        } else {
          // Final result
          results.set(taskId, {
            id: taskId,
            status: isError(result.output) ? 'error' : 'done',
            output: result.output,
            attempts: attempt,
          });
        }
      }
    }

    // 4. Clean up this batch's session
    if (sessionExists(sessionName)) {
      tmux('kill-session', '-t', sessionName);
    }
  }

  // Build report
  const all = [...results.values()];
  return {
    succeeded: all.filter((r) => r.status === 'done'),
    failed: all.filter((r) => r.status === 'error'),
    totalTasks: tasks.length,
    totalTime: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Utilities (for manual control when runTeam is too rigid)
// ---------------------------------------------------------------------------

/** Check status of current session. */
export function getTeamStatus(): Array<{ id: string; done: boolean }> {
  if (!existsSync(PATHS.teamSession)) return [];

  const session = JSON.parse(readFileSync(PATHS.teamSession, 'utf-8')) as {
    tasks: TeamTask[];
  };

  return session.tasks.map((task) => ({
    id: task.id,
    done: readResult(task.id).done,
  }));
}

/** Kill any active team session. */
export function killTeam(): void {
  if (!existsSync(PATHS.teamSession)) return;

  const session = JSON.parse(readFileSync(PATHS.teamSession, 'utf-8')) as {
    name: string;
  };

  if (sessionExists(session.name)) {
    tmux('kill-session', '-t', session.name);
  }

  rmSync(PATHS.teamSession, { force: true });
}
