import { MarieMemoryStore } from "../../services/MarieMemoryStore.js";
export class CouncilState {
    constructor() {
        this.memory = {
            errorHotspots: {},
            totalErrorCount: 0,
            flowState: 50,
            recentFiles: [],
            toolHistory: [],
            toolExecutions: [],
            successStreak: 0,
            shakyResponseDensity: 0,
            writtenFiles: [],
            actionDiffs: {},
            wiringAlerts: []
        };
        this.votes = new Array(50).fill(null);
        this.votesIdx = 0;
        this.votesCount = 0;
        this.recoveryPatterns = new Map();
        this.strategyStats = {};
        this.strategyHistory = [];
        this.lastFailureKey = null;
        this.lastFailedTool = null;
        this.lastToolTimestamp = Date.now();
        this.moodHistory = [];
        this.comboPeak = 0;
        this.intuition = new Map();
        this.panicCoolDown = 0;
        this.streamCadence = 0; // average ms per token/chunk
        const MAX_NOTE_BYTES = 5120;
        const MAX_TOTAL_BYTES = 51200;
        const MAX_ROUTINE_BYTES = 10240;
        const MAX_KEY_LENGTH = 512;
        const sanitizeKey = (rawKey) => {
            const key = typeof rawKey === 'string' ? rawKey.trim() : String(rawKey ?? '').trim();
            if (!key)
                return null;
            return key.length > MAX_KEY_LENGTH ? key.substring(0, MAX_KEY_LENGTH) : key;
        };
        const safeSerialize = (value) => {
            try {
                const seen = new WeakSet();
                return JSON.stringify(value, (_k, v) => {
                    if (typeof v === 'object' && v !== null) {
                        if (seen.has(v))
                            return '[Circular]';
                        seen.add(v);
                    }
                    return v;
                });
            }
            catch (e) {
                console.error("[MarieBlackboard] Serialization failed:", e);
                return null;
            }
        };
        this.blackboard = {
            notes: {},
            routines: {},
            write: (k, v) => {
                const key = sanitizeKey(k);
                if (!key) {
                    console.warn("[MarieBlackboard] Rejecting write with empty/invalid key.");
                    return;
                }
                const serialized = safeSerialize(v);
                if (serialized === null)
                    return;
                let nextValue = v;
                let nextSerialized = serialized;
                if (nextSerialized.length > MAX_NOTE_BYTES) {
                    console.warn(`[MarieBlackboard] Note "${key}" exceeded 5KB limit. Truncating.`);
                    if (typeof v === 'string') {
                        nextValue = v.substring(0, MAX_NOTE_BYTES) + "... [TRUNCATED]";
                    }
                    else {
                        nextValue = { __truncated: true, preview: nextSerialized.substring(0, MAX_NOTE_BYTES) };
                    }
                    const truncatedSerialized = safeSerialize(nextValue);
                    if (truncatedSerialized === null)
                        return;
                    nextSerialized = truncatedSerialized;
                }
                // Projected total blackboard capacity check
                const projectedNotes = { ...this.blackboard.notes, [key]: nextValue };
                const projectedSize = safeSerialize(projectedNotes)?.length ?? Number.MAX_SAFE_INTEGER;
                if (projectedSize > MAX_TOTAL_BYTES) {
                    console.error("[MarieBlackboard] TOTAL CAPACITY EXCEEDED (50KB). Rejecting write.");
                    return;
                }
                this.blackboard.notes[key] = nextValue;
            },
            read: (k) => this.blackboard.notes[k],
            clear: (k) => { delete this.blackboard.notes[k]; },
            writeRoutine: (name, data) => {
                const key = sanitizeKey(name);
                if (!key) {
                    console.warn("[MarieBlackboard] Rejecting routine write with empty/invalid key.");
                    return;
                }
                const serialized = safeSerialize(data);
                if (serialized === null)
                    return;
                if (serialized.length > MAX_ROUTINE_BYTES) {
                    console.warn(`[MarieBlackboard] Routine "${key}" exceeded 10KB limit. Rejecting write.`);
                    return;
                }
                this.blackboard.routines[key] = { name: key, data, updatedAt: Date.now() };
            },
            getRoutine: (name) => this.blackboard.routines[name]
        };
    }
    loadPersistent() {
        const persistent = MarieMemoryStore.load();
        for (const p of persistent.recoveryPatterns) {
            const key = `${p.failedTool}:${p.recoveryTool}`;
            this.recoveryPatterns.set(key, p);
        }
        this.strategyStats = persistent.strategyStats || {};
        if (persistent.intuition) {
            for (const [file, patterns] of Object.entries(persistent.intuition)) {
                this.intuition.set(file, patterns);
            }
        }
    }
    recordToolCall(name) {
        this.memory.toolHistory.push(name);
        this.lastToolTimestamp = Date.now();
        if (this.memory.toolHistory.length > 22) {
            this.memory.toolHistory.splice(0, this.memory.toolHistory.length - 20);
        }
    }
    addVote(vote) {
        this.votes[this.votesIdx] = vote;
        this.votesIdx = (this.votesIdx + 1) % 50;
        this.votesCount = Math.min(50, this.votesCount + 1);
    }
    getRecentVotes(count) {
        const result = [];
        const limit = Math.min(count, this.votesCount);
        for (let i = 0; i < limit; i++) {
            const idx = (this.votesIdx - limit + i + 50) % 50;
            const v = this.votes[idx];
            if (v)
                result.push(v);
        }
        return result;
    }
    recordFileWrite(filePath, diffSummary) {
        if (!this.memory.writtenFiles.includes(filePath)) {
            this.memory.writtenFiles.push(filePath);
        }
        this.memory.actionDiffs[filePath] = diffSummary;
    }
    clearTurnState() {
        this.memory.writtenFiles = [];
        this.memory.actionDiffs = {};
        this.memory.wiringAlerts = [];
        // Optional: reduce streak if we've been idle? Engine handles decay, so we just clear turn-data.
    }
    pruneHotspots() {
        const keys = Object.keys(this.memory.errorHotspots);
        if (keys.length > 20) {
            const sorted = keys.sort((a, b) => this.memory.errorHotspots[b] - this.memory.errorHotspots[a]);
            const nextHotspots = {};
            for (const k of sorted.slice(0, 20)) {
                nextHotspots[k] = this.memory.errorHotspots[k];
            }
            this.memory.errorHotspots = nextHotspots;
        }
    }
    getPersistentSnapshot() {
        return {
            recoveryPatterns: Array.from(this.recoveryPatterns.values()),
            toolExecutions: this.memory.toolExecutions.map(e => ({
                name: e.name,
                durationMs: e.durationMs,
                success: e.success
            })),
            intuition: Object.fromEntries(this.intuition.entries())
        };
    }
}
