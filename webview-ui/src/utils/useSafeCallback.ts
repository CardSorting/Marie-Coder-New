import { useCallback } from 'react';
import { vscode } from './vscode';

/**
 * A wrapper for useCallback that adds a try-catch block to prevent UI crashes
 * from bubbling up to the React root during interactions.
 * 
 * @param callback The function to wrap
 * @param deps Dependencies for the inner useCallback
 * @param name Optional name for logging
 */
export function useSafeCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList,
    name?: string
): T {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useCallback(((...args: Parameters<T>) => {
        try {
            return callback(...args);
        } catch (error) {
            const err = error as Error;
            console.error(`[SafeCallback] ${name || 'unnamed'} failed:`, error);

            // Report to extension host telemetry
            vscode.postMessage({
                type: 'error',
                value: {
                    message: `Interaction Crash [${name || 'unnamed'}]: ${err.message}`,
                    stack: err.stack
                }
            });

            return undefined;
        }
    }) as T, deps);
}
