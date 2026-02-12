/**
 * Throttling logic for progress updates.
 *
 * This hook manages refs for throttled progress updates,
 * keeping the throttling state isolated from message handling.
 */

import { useRef, useCallback, useMemo } from 'react';
import type { ProgressUpdatePayload } from '../../types';

/**
 * Return type for useThrottling hook.
 */
export interface ThrottlingState {
    /** Reference to buffered progress update */
    readonly bufferRef: React.MutableRefObject<ProgressUpdatePayload | null>;
    /** Reference to throttle timer */
    readonly timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    /** Reference to buffered chat chunks */
    readonly chatBufferRef: React.MutableRefObject<string[]>;
    /** Reference to buffered tool deltas */
    readonly toolDeltaBufferRef: React.MutableRefObject<{ name?: string; inputDelta: string }[]>;
    /** Reference to chat/tool throttle timer */
    readonly chatTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    /** Flush any pending progress update immediately */
    readonly flushPendingUpdate: () => void;
    /** Clear the throttle timer */
    readonly clearThrottleTimer: () => void;
}

/**
 * Hook for managing throttling state for progress and chat updates.
 *
 * @returns Throttling state and control functions
 */
export function useThrottling(): ThrottlingState {
    // Refs for throttled progress updates
    const bufferRef = useRef<ProgressUpdatePayload | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs for throttled chat updates
    const chatBufferRef = useRef<string[]>([]);
    const toolDeltaBufferRef = useRef<{ name?: string; inputDelta: string }[]>([]);
    const chatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Flush any pending progress update immediately.
     * Should be called when unmounting or when immediate update is needed.
     */
    const flushPendingUpdate = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (chatTimerRef.current) {
            clearTimeout(chatTimerRef.current);
            chatTimerRef.current = null;
        }
    }, []);

    /**
     * Clear the throttle timer without processing pending updates.
     */
    const clearThrottleTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (chatTimerRef.current) {
            clearTimeout(chatTimerRef.current);
            chatTimerRef.current = null;
        }
    }, []);

    return useMemo(() => ({
        bufferRef,
        timerRef,
        chatBufferRef,
        toolDeltaBufferRef,
        chatTimerRef,
        flushPendingUpdate,
        clearThrottleTimer
    }), [flushPendingUpdate, clearThrottleTimer]);
}
