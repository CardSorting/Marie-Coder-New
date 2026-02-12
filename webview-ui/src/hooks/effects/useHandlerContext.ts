/**
 * Handler context composition.
 *
 * This hook composes the complete handler context from setters and actions,
 * with proper memoization to prevent unnecessary re-renders.
 */

import { useMemo, useCallback } from 'react';
import type { HandlerContext } from '../messageHandlers';
import type { MarieSetters, MarieActions } from './types';

/**
 * Utility functions that can be added to the context.
 */
export interface ContextUtilities {
    /** Get current time formatted for display */
    readonly getCurrentTime: () => string;
}

/**
 * Complete context including utilities.
 */
export type CompleteHandlerContext = HandlerContext;

/**
 * Hook for composing the handler context.
 *
 * Combines setters, actions, and utility functions into a single
 * memoized context object to prevent unnecessary effect re-runs.
 *
 * @param setters - State setter functions
 * @param actions - Action callback functions
 * @returns Complete handler context
 */
export function useHandlerContext(
    setters: MarieSetters,
    actions: MarieActions,
    currentSessionId: string | null
): CompleteHandlerContext {
    // Utility function for timestamps - stable reference
    const getCurrentTime = useCallback(() => {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    // Build the complete handler context - memoized to prevent unnecessary re-renders
    const handlerContext: HandlerContext = useMemo(() => ({
        ...setters,
        ...actions,
        getCurrentTime,
        currentSessionId
    }), [setters, actions, getCurrentTime, currentSessionId]);

    return handlerContext;
}
