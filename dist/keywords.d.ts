/**
 * Keyword detector — the INPUT mechanism for the state machine.
 *
 * Scans user prompts for trigger words and fires actions.
 * This is how a user starts a mode: they type "focus refactor auth"
 * and the keyword detector triggers startMode("focus", ...).
 *
 * OMC uses this for: ultrawork, ralph, autopilot, ultrathink, etc.
 * In the harness, the keywords and actions are fully user-defined.
 */
import type { HookHandler } from './types.js';
export interface KeywordRule {
    /** Trigger words (case-insensitive, whole-word match). */
    triggers: string[];
    /** Action to run when detected. Returns context to inject. */
    action: (prompt: string, matched: string) => string | void;
}
/**
 * Create a keyword detector hook.
 *
 * Runs on UserPromptSubmit. Scans the prompt for trigger words
 * and calls the corresponding action. If the action returns a string,
 * it's injected as additional context.
 *
 * @example
 *   createKeywordDetector([
 *     {
 *       triggers: ['focus', '집중'],
 *       action: (prompt) => {
 *         startMode('focus', ['plan', 'execute', 'verify']);
 *         return '[Focus mode activated]';
 *       },
 *     },
 *     {
 *       triggers: ['done', '완료'],
 *       action: () => { endMode(); },
 *     },
 *   ])
 */
export declare function createKeywordDetector(rules: KeywordRule[]): HookHandler;
