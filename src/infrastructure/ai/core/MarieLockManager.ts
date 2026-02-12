import { MarieProgressTracker } from "./MarieProgressTracker.js";

export interface ToolLock {
    write: Promise<any> | null;
    reads: Set<Promise<any>>;
    ownerContextId?: string; // Re-entrancy tracking
}

/**
 * QUANTUM RESILIENCE: MarieLockManager
 * Orchestrates multi-reader/single-writer locks for tool execution.
 */
export class MarieLockManager {
    private toolsInFlight: Map<string, ToolLock> = new Map();

    constructor(private tracker?: MarieProgressTracker) { }

    public getLock(target: string): ToolLock {
        let lock = this.toolsInFlight.get(target);
        if (!lock) {
            lock = { write: null, reads: new Set() };
            this.toolsInFlight.set(target, lock);
        }
        return lock;
    }

    public async acquireLock(target: string, isWrite: boolean, signal?: AbortSignal, contextId?: string): Promise<void> {
        let lock = this.getLock(target);

        // SELF-DEADLOCK PREVENTION (RE-ENTRANCY):
        // If the current context already owns this lock for writing, we can proceed.
        // Readers can always proceed if they are part of the same context.
        if (contextId && lock.ownerContextId === contextId) {
            return;
        }

        const startAcquire = Date.now();

        const waitWithTimeout = async (promise: Promise<any> | null) => {
            if (!promise) return;

            const monitorId = setInterval(() => {
                const elapsed = Date.now() - startAcquire;
                if (elapsed > 5000) {
                    console.warn(`[MarieLockManager] SLOW LOCK: Acquisition on ${target} taking ${elapsed}ms...`);
                    if (this.tracker) {
                        this.tracker.emitEvent({
                            type: 'reasoning',
                            runId: this.tracker.getRun().runId,
                            text: `⚠️ SLOW LOCK: Acquisition on ${target} is delayed...`,
                            elapsedMs: this.tracker.elapsedMs()
                        });
                    }
                }
            }, 5000);

            let timeoutId: NodeJS.Timeout;
            const timeout = new Promise((_, reject) =>
                timeoutId = setTimeout(() => reject(new Error(`Extreme Stability: Lock Acquisition Timeout on ${target}`)), 30000)
            );

            try {
                return await Promise.race([promise, timeout]);
            } finally {
                clearInterval(monitorId);
                clearTimeout(timeoutId!);
            }
        };

        if (isWrite) {
            // Writer must wait for ALL reads AND any existing write
            if (lock.write) await waitWithTimeout(lock.write);
            await waitWithTimeout(Promise.allSettled(Array.from(lock.reads)));

            // Re-check after await to handle race conditions
            lock = this.getLock(target);
            while (lock.write || lock.reads.size > 0) {
                if (signal?.aborted) throw new Error("Aborted while waiting for lock");
                if (lock.write) await waitWithTimeout(lock.write);
                if (lock.reads.size > 0) await waitWithTimeout(Promise.allSettled(Array.from(lock.reads)));
                lock = this.getLock(target);
            }
        } else {
            // Reader only waits for WRITE
            if (lock.write) await waitWithTimeout(lock.write);
        }
    }

    public registerExecution(target: string, isWrite: boolean, promise: Promise<any>, contextId?: string): void {
        const lock = this.getLock(target);
        if (isWrite) {
            lock.write = promise;
            if (contextId) lock.ownerContextId = contextId;
        } else {
            lock.reads.add(promise);
        }

        promise.finally(() => {
            this.releaseLock(target, isWrite, promise, contextId);
        });
    }

    private releaseLock(target: string, isWrite: boolean, promise: Promise<any>, contextId?: string): void {
        const lock = this.toolsInFlight.get(target);
        if (!lock) return;

        if (isWrite) {
            if (lock.write === promise) {
                lock.write = null;
                if (lock.ownerContextId === contextId) lock.ownerContextId = undefined;
            }
        } else {
            lock.reads.delete(promise);
        }

        // Cleanup empty locks
        if (!lock.write && lock.reads.size === 0) {
            this.toolsInFlight.delete(target);
        }
    }

    public async waitForAll(): Promise<void> {
        const allPromises: Promise<any>[] = [];
        for (const lock of Array.from(this.toolsInFlight.values())) {
            if (lock.write) allPromises.push(lock.write);
            lock.reads.forEach(p => allPromises.push(p));
        }
        await Promise.allSettled(allPromises);
    }
}
