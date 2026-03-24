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
// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
/** Strip code blocks to avoid false positives inside backticks. */
function stripCode(text) {
    return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}
/** Check if any trigger word is present as a whole word. */
function findMatch(text, triggers) {
    const clean = stripCode(text);
    for (const trigger of triggers) {
        const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(clean)) {
            return trigger;
        }
    }
    return null;
}
/** Extract plain text from prompt parts. */
function extractText(input) {
    if (!input.prompt?.content)
        return '';
    return input.prompt.content
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join('\n');
}
// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------
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
export function createKeywordDetector(rules) {
    return {
        event: 'UserPromptSubmit',
        handle: (input) => {
            const text = extractText(input);
            if (!text)
                return {};
            const contexts = [];
            for (const rule of rules) {
                const matched = findMatch(text, rule.triggers);
                if (matched) {
                    const result = rule.action(text, matched);
                    if (result)
                        contexts.push(result);
                }
            }
            if (contexts.length === 0)
                return {};
            return { additionalContext: contexts.join('\n') };
        },
    };
}
