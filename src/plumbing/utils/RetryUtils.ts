/**
 * Error category classification for retry behavior.
 */
export enum ErrorCategory {
    TRANSIENT = 'TRANSIENT',       // Temporary, should retry
    PERMANENT = 'PERMANENT',        // Permanent, don't retry
    UNKNOWN = 'UNKNOWN'             // Unknown, use conservative retry
}

/**
 * Retry configuration and utilities for handling transient errors.
 */
export class RetryConfig {
    public maxRetries: number = 3;
    public baseDelayMs: number = 100;
    public maxDelayMs: number = 5000;

    // Errors that are definitely retryable (transient)
    public transientErrors: string[] = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'timeout',
        'throttle',
        'rate limit',
        'too many requests',
        '429',
        '503',
        '504'
    ];

    // Errors that are definitely NOT retryable (permanent)
    public permanentErrors: string[] = [
        'EACCES',
        'EPERM',
        'permission denied',
        'unauthorized',
        'forbidden',
        '401',
        '403',
        'invalid',
        'validation',
        'not found',
        '404'
    ];

    /**
     * Categorize an error based on its message.
     */
    public categorizeError(errorMessage: string): ErrorCategory {
        const lowerMessage = errorMessage.toLowerCase();

        // Check if it's a known transient error
        if (this.transientErrors.some(err => lowerMessage.includes(err.toLowerCase()))) {
            return ErrorCategory.TRANSIENT;
        }

        // Check if it's a known permanent error
        if (this.permanentErrors.some(err => lowerMessage.includes(err.toLowerCase()))) {
            return ErrorCategory.PERMANENT;
        }

        return ErrorCategory.UNKNOWN;
    }

    /**
     * Check if an error message indicates a retryable error.
     */
    public isRetryable(errorMessage: string): boolean {
        const category = this.categorizeError(errorMessage);
        // Only retry transient errors, not permanent or unknown
        return category === ErrorCategory.TRANSIENT;
    }

    /**
     * Calculate exponential backoff delay.
     */
    public getBackoffDelay(attemptNumber: number): number {
        const delay = this.baseDelayMs * Math.pow(2, attemptNumber);
        // Add jitter (randomness) to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return Math.min(delay + jitter, this.maxDelayMs);
    }
}

/**
 * Execute a function with retry logic, respecting an AbortSignal.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    context: string,
    signal?: AbortSignal
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        if (signal?.aborted) {
            throw new Error(`${context}: Aborted by user.`);
        }

        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || String(error);
            const category = config.categorizeError(errorMessage);

            // Log error category for debugging
            if (attempt === 0) {
                console.log(`[Marie] ${context}: Error category: ${category}`);
            }

            // Don't retry if error is permanent
            if (category === ErrorCategory.PERMANENT) {
                console.log(`[Marie] ${context}: Permanent error, failing immediately.`);
                throw error;
            }

            // Don't retry if error is unknown (conservative approach)
            if (category === ErrorCategory.UNKNOWN) {
                console.log(`[Marie] ${context}: Unknown error type, failing without retry.`);
                throw error;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= config.maxRetries) {
                console.error(`[Marie] ${context}: Max retries (${config.maxRetries}) exceeded.`);
                throw error;
            }

            // Calculate backoff and retry (only for TRANSIENT errors)
            const delay = config.getBackoffDelay(attempt);
            console.warn(`[Marie] ${context}: Attempt ${attempt + 1} failed (${category}), retrying in ${Math.round(delay)}ms... Error: ${errorMessage}`);

            await sleep(delay, signal);
        }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error(`${context}: Retry loop failed unexpectedly`);
}

/**
 * Sleep for a specified number of milliseconds, optionally cancellable.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (signal) signal.removeEventListener('abort', abortHandler);
            resolve();
        }, ms);

        const abortHandler = () => {
            clearTimeout(timeout);
            reject(new Error("Operation aborted."));
        };

        if (signal) {
            signal.addEventListener('abort', abortHandler, { once: true });
        }
    });
}
