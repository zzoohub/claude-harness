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
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
const TEAM_DIR = '.harness/team';
const RESULTS_DIR = join(TEAM_DIR, 'results');
const SESSION_FILE = join(TEAM_DIR, 'session.json');
// ---------------------------------------------------------------------------
// tmux helpers
// ---------------------------------------------------------------------------
function tmuxExists() {
    try {
        execFileSync('which', ['tmux'], { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function sessionExists(name) {
    try {
        execFileSync('tmux', ['has-session', '-t', name], { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function tmux(...args) {
    execFileSync('tmux', args, { stdio: 'ignore' });
}
// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------
/**
 * Build a shell command string for a task pane.
 * Output is redirected to a result file for collection.
 */
function buildShellCommand(task) {
    const cli = task.cli ?? 'claude';
    const flags = task.flags ?? [];
    const resultFile = join(process.cwd(), RESULTS_DIR, `${task.id}.txt`);
    // Build args array, then join safely
    const args = [cli, '--print', task.prompt, ...flags];
    // Escape each arg for shell
    const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    return `${escaped} > '${resultFile}' 2>&1; echo '[DONE]' >> '${resultFile}'`;
}
// ---------------------------------------------------------------------------
// Team lifecycle
// ---------------------------------------------------------------------------
/**
 * Spawn a team of parallel workers.
 *
 * Creates a tmux session with one pane per task.
 * Each pane runs the specified CLI with the task prompt.
 * Output is captured to .harness/team/results/{id}.txt
 */
export function spawnTeam(tasks) {
    if (!tmuxExists()) {
        throw new Error('tmux is not installed. Install with: brew install tmux');
    }
    if (tasks.length === 0) {
        throw new Error('No tasks provided');
    }
    const sessionName = `harness-${Date.now()}`;
    mkdirSync(RESULTS_DIR, { recursive: true });
    // Create session with first task
    const firstCmd = buildShellCommand(tasks[0]);
    tmux('new-session', '-d', '-s', sessionName, '-x', '200', '-y', '50', firstCmd);
    // Add remaining tasks as split panes
    for (let i = 1; i < tasks.length; i++) {
        const cmd = buildShellCommand(tasks[i]);
        tmux('split-window', '-t', sessionName, '-h', cmd);
        tmux('select-layout', '-t', sessionName, 'tiled');
    }
    const session = {
        name: sessionName,
        tasks,
        startedAt: new Date().toISOString(),
    };
    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    return session;
}
// ---------------------------------------------------------------------------
// Status & results
// ---------------------------------------------------------------------------
/** Check status of each task. */
export function getTeamStatus() {
    if (!existsSync(SESSION_FILE))
        return [];
    const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    return session.tasks.map((task) => {
        const resultFile = join(RESULTS_DIR, `${task.id}.txt`);
        if (!existsSync(resultFile)) {
            return { id: task.id, status: 'running' };
        }
        const content = readFileSync(resultFile, 'utf-8');
        if (content.includes('[DONE]')) {
            return {
                id: task.id,
                status: 'done',
                output: content.replace('[DONE]', '').trim(),
            };
        }
        return { id: task.id, status: 'running' };
    });
}
/** Get completed results only. */
export function collectResults() {
    return getTeamStatus().filter((r) => r.status === 'done');
}
/** Are all tasks done? */
export function isTeamDone() {
    const statuses = getTeamStatus();
    return statuses.length > 0 && statuses.every((r) => r.status !== 'running');
}
/** Kill the tmux session and clean up. */
export function killTeam() {
    if (!existsSync(SESSION_FILE))
        return;
    const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    if (sessionExists(session.name)) {
        tmux('kill-session', '-t', session.name);
    }
}
