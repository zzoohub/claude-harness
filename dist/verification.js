/**
 * Verification enforcement — "서브에이전트는 거짓말한다."
 *
 * PostToolUse hook that fires after Agent/Task tool completes.
 * Injects a verification reminder so the orchestrator doesn't
 * blindly trust sub-agent self-reports.
 *
 * Without this, Claude accepts "완료했습니다" at face value.
 * With this, Claude is reminded to run tests, read code, check builds.
 */
import { execFileSync } from 'child_process';
const DEFAULT_MESSAGE = `[VERIFICATION REQUIRED]

Sub-agent reported completion. Do NOT trust this claim.

You MUST verify yourself:
1. Run tests — must PASS (not "agent said it passed")
2. Read the actual code — must match requirements
3. Check build/typecheck — must succeed

Do not proceed until verified with your own tool calls.`;
// ---------------------------------------------------------------------------
// Git diff summary
// ---------------------------------------------------------------------------
function getGitDiffSummary() {
    try {
        const stat = execFileSync('git', ['diff', '--stat', 'HEAD'], {
            encoding: 'utf-8',
            timeout: 5000,
        }).trim();
        if (!stat)
            return '';
        return `\n[File changes]\n${stat}`;
    }
    catch {
        return '';
    }
}
// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------
/**
 * Create a verification hook.
 *
 * Fires on PostToolUse for Agent tool calls.
 * Injects verification reminder + optional git diff summary.
 */
export function createVerificationHook(config = {}) {
    const message = config.message ?? DEFAULT_MESSAGE;
    const showDiff = config.showDiff ?? true;
    return {
        event: 'PostToolUse',
        matcher: 'Agent',
        handle: (input) => {
            // Skip background task launches (no result to verify yet)
            const output = String(input.toolOutput ?? '');
            if (output.includes('Background task launched'))
                return {};
            let context = message;
            if (showDiff)
                context += getGitDiffSummary();
            return { additionalContext: context };
        },
    };
}
