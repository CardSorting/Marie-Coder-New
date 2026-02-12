import * as vscode from 'vscode';

/**
 * Proactive stability monitor for the Extension Host.
 * Detects event loop lag and heap pressure.
 */
export class MarieStabilityMonitor {
    private static lag: number = 0;
    private static interval: NodeJS.Timeout | null = null;
    private static lastTick: number = Date.now();
    private static cooldownActive: boolean = false;

    public static start() {
        if (this.interval) return;
        this.lastTick = Date.now();
        this.interval = setInterval(() => {
            const now = Date.now();
            const drift = now - this.lastTick - 1000;
            this.lag = Math.max(0, drift);
            this.lastTick = now;

            if (this.lag > 150) {
                console.warn(`[MarieStabilityMonitor] CRITICAL EVENT LOOP LAG: ${this.lag}ms. Triggering UI preservation cooldown.`);
                this.cooldownActive = true;
            } else if (this.lag < 50) {
                this.cooldownActive = false;
            }
        }, 1000);

        // Ensure we don't leak if the process is weird
        if ((this.interval as any).unref) {
            (this.interval as any).unref();
        }
    }

    public static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    public static isHighPressure(): boolean {
        // High pressure if lag > 100ms or heap usage > 80% (if process.memoryUsage is reliable)
        const mem = process.memoryUsage();
        const heapPressure = mem.heapUsed / mem.heapTotal > 0.85;
        return this.lag > 100 || heapPressure || this.cooldownActive;
    }

    public static getLag(): number {
        return this.lag;
    }

    public static getMetrics() {
        const mem = process.memoryUsage();
        return {
            lagMs: this.lag,
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
            cooldown: this.cooldownActive
        };
    }
}
