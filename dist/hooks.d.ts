/**
 * Hook engine.
 *
 * Dispatches Claude Code lifecycle events to registered handlers.
 * Multiple handlers can match the same event — their outputs are
 * merged in registration order. A "block" decision short-circuits.
 */
import type { HookHandler, HookInput, HookOutput } from './types.js';
export declare class HookEngine {
    private handlers;
    register(handler: HookHandler): void;
    registerAll(handlers: HookHandler[]): void;
    /** Run all matching handlers and merge their outputs. */
    process(input: HookInput): Promise<HookOutput>;
    private matches;
}
