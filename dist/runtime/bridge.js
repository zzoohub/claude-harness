/**
 * Claude Code hook bridge.
 *
 * This is the entry point that Claude Code's hook system calls.
 * Flow:  stdin (JSON) → parse → HookEngine → stdout (JSON)
 *
 * Usage in settings.json hooks:
 *   "command": "node /path/to/dist/bridge.js PreToolUse"
 *
 * The event type is passed as the first CLI argument so the bridge
 * always knows which lifecycle event triggered it.
 */
import { createHarness } from '../index.js';
import { loadProjectConfig } from '../core/config.js';
import { handlePermissionRequest } from '../hooks/permission.js';
// ---------------------------------------------------------------------------
// stdin / stdout helpers
// ---------------------------------------------------------------------------
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
function parseInput(raw, event) {
    const data = JSON.parse(raw);
    return {
        event,
        sessionId: data.session_id ?? '',
        toolName: data.tool_name,
        toolInput: data.tool_input,
        toolOutput: data.tool_output,
        prompt: data.prompt,
        stopReason: data.stop_reason,
    };
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const event = process.argv[2];
    if (!event) {
        process.stderr.write('[harness] Missing event argument\n');
        process.stdout.write('{}');
        return;
    }
    const raw = await readStdin();
    if (!raw.trim()) {
        process.stdout.write('{}');
        return;
    }
    // PermissionRequest has a different output format — handle separately
    if (event === 'PermissionRequest') {
        const data = JSON.parse(raw);
        const output = handlePermissionRequest(data);
        process.stdout.write(JSON.stringify(output));
        return;
    }
    // Load project config (.mjs > .json) and create harness
    const fileCfg = await loadProjectConfig();
    const harness = createHarness(fileCfg ?? {});
    // Dispatch through hook engine
    const input = parseInput(raw, event);
    const output = await harness.hooks.process(input);
    if (event === 'PreToolUse' && input.toolName === 'Agent') {
        process.stderr.write(`[harness:bridge] PreToolUse Agent — input keys: ${JSON.stringify(Object.keys(input.toolInput ?? {}))}\n`);
        process.stderr.write(`[harness:bridge] output: ${JSON.stringify(output)}\n`);
    }
    process.stdout.write(JSON.stringify(output));
}
// Run when executed directly (not imported)
main().catch((err) => {
    process.stderr.write(`[harness] ${err}\n`);
    process.stdout.write('{}');
});
