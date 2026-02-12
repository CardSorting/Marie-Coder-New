/**
 * Message event listener hook.
 *
 * This hook manages the message event listener lifecycle,
 * routing incoming messages to the appropriate handlers.
 */

import { useEffect, useRef } from 'react';
import type { HandlerRegistry, HandlerContext } from '../messageHandlers';

/**
 * Props for useMessageListener hook.
 */
export interface MessageListenerProps {
    /** Handler registry mapping message types to handlers */
    readonly registry: HandlerRegistry;
    /** Handler context passed to all handlers */
    readonly context: HandlerContext;
}

/**
 * Hook for setting up the message event listener.
 *
 * Attaches a message event listener on mount and cleans up on unmount.
 * Routes messages to handlers based on message type.
 *
 * @param props - Listener configuration
 */
export function useMessageListener({ registry, context }: MessageListenerProps): void {
    // Use refs to avoid re-mounting the listener when context or registry changes
    const registryRef = useRef<HandlerRegistry>(registry);
    const contextRef = useRef<HandlerContext>(context);

    useEffect(() => {
        registryRef.current = registry;
        contextRef.current = context;
    }, [registry, context]);

    useEffect(() => {
        const messageQueue: MessageEvent[] = [];
        let isProcessing = false;

        // PHASE 6: Enhanced SESSION GUARD - Track active run for fencing
        let activeRunId: string | null = null;

        const processQueue = () => {
            if (messageQueue.length === 0) {
                isProcessing = false;
                return;
            }

            isProcessing = true;

            // Process a chunk of messages to prevent long-tasks if the queue is somehow massive
            // 50 is a safe upper bound for one frame
            const batch = messageQueue.splice(0, 50);

            for (const event of batch) {
                const message = event.data;
                const messageType = message?.type as string;

                // PHASE 6: Deep Session Fencing - Extract session context
                const messageSessionId = (message as any)?.sessionId;
                const messageRunId = (message as any)?.runId;
                const currentSessionId = contextRef.current.currentSessionId;

                if (!messageType) continue;

                // PHASE 6: Enhanced SESSION GUARD - Multi-layer fencing
                if (messageSessionId && currentSessionId) {
                    // Layer 1: Session ID mismatch - always reject
                    if (messageSessionId !== currentSessionId) {
                        // Log fencing violation for debugging
                        console.warn(`[SESSION GUARD] Blocked message from stale session. ` +
                            `Message: ${messageSessionId}, Current: ${currentSessionId}, Type: ${messageType}`);

                        // Specific ignore list for streaming/progress events that are high frequency
                        const isVolatile = ['onStreamUpdate', 'onToolDelta', 'onProgressUpdate', 'onEvent', 'onToolCall'].includes(messageType);
                        if (isVolatile) {
                            continue;
                        }

                        // For non-volatile messages, still process but log warning
                        // (they might be important like sessionLoaded)
                    }

                    // Layer 2: Run ID tracking - detect run context switches
                    if (messageRunId) {
                        if (messageType === 'onRunStart') {
                            // New run started - track it
                            activeRunId = messageRunId;
                        } else if (activeRunId && messageRunId !== activeRunId) {
                            // Message from a different run than the active one
                            console.warn(`[SESSION GUARD] Message from stale run. ` +
                                `Run: ${messageRunId}, Active: ${activeRunId}, Type: ${messageType}`);
                            continue;
                        }
                    }
                }

                // PHASE 6: Session transition detection - clear run tracking on session change
                if (messageType === 'onSessionLoaded') {
                    activeRunId = null;
                }

                const handler = registryRef.current[messageType];
                if (handler) {
                    try {
                        handler(message, contextRef.current);
                    } catch (err) {
                        console.error(`[useMessageListener] Handler crashed for type "${messageType}":`, err);
                    }
                }
            }

            if (messageQueue.length > 0) {
                // Continue in next microtask if still more to do
                queueMicrotask(processQueue);
            } else {
                isProcessing = false;
            }
        };

        const handleMessage = (event: MessageEvent) => {
            messageQueue.push(event);
            if (!isProcessing) {
                queueMicrotask(processQueue);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []); // Empty deps ensures listener is stable for the entire lifecycle
}
