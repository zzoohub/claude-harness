/**
 * Hook engine.
 *
 * Dispatches Claude Code lifecycle events to registered handlers.
 * Multiple handlers can match the same event — their outputs are
 * merged in registration order. A "block" decision short-circuits.
 */
export class HookEngine {
    handlers = [];
    register(handler) {
        this.handlers.push(handler);
    }
    registerAll(handlers) {
        for (const h of handlers)
            this.register(h);
    }
    /** Run all matching handlers and merge their outputs. */
    async process(input) {
        const matching = this.handlers.filter((h) => this.matches(h, input));
        let merged = {};
        for (const handler of matching) {
            const result = await handler.handle(input);
            merged = mergeOutputs(merged, result);
            // Short-circuit: block stops further processing
            if (result.decision === 'block')
                break;
        }
        return merged;
    }
    matches(handler, input) {
        if (handler.event !== input.event)
            return false;
        // If handler has a matcher, test it against toolName
        if (handler.matcher && input.toolName) {
            return new RegExp(handler.matcher).test(input.toolName);
        }
        // No matcher = match all events of this type
        return !handler.matcher;
    }
}
// ---------------------------------------------------------------------------
// Output merging
// ---------------------------------------------------------------------------
function mergeOutputs(prev, next) {
    return {
        // Concatenate context strings
        additionalContext: joinStrings(prev.additionalContext, next.additionalContext),
        // "block" takes precedence over "allow"
        decision: next.decision === 'block' ? 'block' : (prev.decision ?? next.decision),
        reason: next.reason ?? prev.reason,
    };
}
function joinStrings(a, b) {
    const parts = [a, b].filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : undefined;
}
