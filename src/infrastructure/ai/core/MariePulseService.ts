import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieGhostService } from "../../../services/MarieGhostService.js";

/**
 * ATMOSPHERIC SEPARATION: MariePulseService
 * Handles the engine's "vital signs": reasoning heartbeats, turn collision watchdogs,
 * and global ghost resource cleanup.
 */
export class MariePulseService {
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private watchdogTimer: NodeJS.Timeout | null = null;

    constructor(private tracker: MarieProgressTracker) { }

    /**
     * SUB-ATOMIC INTEGRITY: Reactive Lock Recovery
     * If the engine lock is held for >120s, it's likely a zombie turn. Force-release.
     */
    public startTurnWatchdog(onRecover: () => void): NodeJS.Timeout {
        this.stopTurnWatchdog();
        this.watchdogTimer = setTimeout(() => {
            console.error("[MariePulseService] LOCK RECOVERY: AI Engine lock held for >120s. Force-releasing...");

            this.tracker.emitEvent({
                type: 'reasoning',
                runId: this.tracker.getRun().runId,
                text: "🚨 LOCK RECOVERY: Stale reasoning process detected (>120s). Force-releasing engine lock.",
                elapsedMs: this.tracker.elapsedMs()
            });

            onRecover();
        }, 120000);
        return this.watchdogTimer;
    }

    public stopTurnWatchdog() {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    /**
     * REASONING HEARTBEAT: Detect AI hangs during streaming.
     */
    public startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setTimeout(() => {
            this.tracker.emitEvent({
                type: 'reasoning',
                runId: this.tracker.getRun().runId,
                text: "🚨 PLANETARY STABILITY HAZARD: AI reasoning hang detected (>60s).",
                elapsedMs: this.tracker.elapsedMs()
            });
        }, 60000);
    }

    public stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * GHOST GUARD: Absolute Resource Sanctity
     */
    public cleanup() {
        this.stopHeartbeat();
        this.stopTurnWatchdog();
        MarieGhostService.clearAll();
    }
}
