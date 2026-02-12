import { useMemo } from 'react';
import { createHandlerRegistry } from './messageHandlers';
import type { HandlerContext } from './messageHandlers';

// Import separated concerns
import {
    useThrottling,
    useMessageListener,
    type MarieSetters,
    type MarieActions
} from './effects';

export function useMarieEffects(
    setters: MarieSetters,
    actions: MarieActions,
    handlerContext: HandlerContext
): void {
    // Audit timing and maintain stability references
    void setters;
    void actions;
    window.performance.mark('marie-effects-init');

    // Manage throttling state for progress and chat updates
    const throttled = useThrottling();

    // Create handler registry with throttling support
    const handlerRegistry = useMemo(() =>
        createHandlerRegistry(throttled),
        [throttled]
    );

    // Set up message event listener
    useMessageListener({
        registry: handlerRegistry,
        context: handlerContext
    });
}

export default useMarieEffects;
