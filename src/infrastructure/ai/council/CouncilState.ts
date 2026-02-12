import { HiveMemory, CouncilVote, ToolExecution, Blackboard, BlackboardRoutine, CouncilStrategy } from './MarieCouncilTypes';
import { MarieMemoryStore } from "../../services/MarieMemoryStore.js";

export class CouncilState {
    public memory: HiveMemory = {
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

    public votes: (CouncilVote | null)[] = new Array(50).fill(null);
    public votesIdx: number = 0;
    public votesCount: number = 0;

    public blackboard: Blackboard;
    public recoveryPatterns: Map<string, { failedTool: string, recoveryTool: string, count: number }> = new Map();
    public strategyStats: Record<string, { attempts: number, successes: number }> = {};
    public strategyHistory: { strategy: CouncilStrategy, reason: string, timestamp: number }[] = [];
    public lastFailureKey: string | null = null;
    public lastFailedTool: string | null = null;
    public lastToolTimestamp: number = Date.now();
    public moodHistory: string[] = [];
    public comboPeak: number = 0;
    public intuition: Map<string, string[]> = new Map();
    public panicCoolDown: number = 0;
    public streamCadence: number = 0; // average ms per token/chunk

    constructor() {
        const MAX_NOTE_BYTES = 5120;
        const MAX_TOTAL_BYTES = 51200;
        const MAX_ROUTINE_BYTES = 10240;
        const MAX_KEY_LENGTH = 512;

        const sanitizeKey = (rawKey: any): string | null => {
            const key = typeof rawKey === 'string' ? rawKey.trim() : String(rawKey ?? '').trim();
            if (!key) return null;
            return key.length > MAX_KEY_LENGTH ? key.substring(0, MAX_KEY_LENGTH) : key;
        };

        const safeSerialize = (value: any): string | null => {
            try {
                const seen = new WeakSet<object>();
                return JSON.stringify(value, (_k, v) => {
                    if (typeof v === 'object' && v !== null) {
                        if (seen.has(v)) return '[Circular]';
                        seen.add(v);
                    }
                    return v;
                });
            } catch (e) {
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
                if (serialized === null) return;

                let nextValue: any = v;
                let nextSerialized = serialized;

                if (nextSerialized.length > MAX_NOTE_BYTES) {
                    console.warn(`[MarieBlackboard] Note "${key}" exceeded 5KB limit. Truncating.`);
                    if (typeof v === 'string') {
                        nextValue = v.substring(0, MAX_NOTE_BYTES) + "... [TRUNCATED]";
                    } else {
                        nextValue = { __truncated: true, preview: nextSerialized.substring(0, MAX_NOTE_BYTES) };
                    }

                    const truncatedSerialized = safeSerialize(nextValue);
                    if (truncatedSerialized === null) return;
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
                if (serialized === null) return;
                if (serialized.length > MAX_ROUTINE_BYTES) {
                    console.warn(`[MarieBlackboard] Routine "${key}" exceeded 10KB limit. Rejecting write.`);
                    return;
                }

                this.blackboard.routines[key] = { name: key, data, updatedAt: Date.now() };
            },
            getRoutine: (name) => this.blackboard.routines[name]
        };
    }

    public loadPersistent() {
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

    public recordToolCall(name: string) {
        this.memory.toolHistory.push(name);
        this.lastToolTimestamp = Date.now();
        if (this.memory.toolHistory.length > 22) {
            this.memory.toolHistory.splice(0, this.memory.toolHistory.length - 20);
        }
    }

    public addVote(vote: CouncilVote) {
        this.votes[this.votesIdx] = vote;
        this.votesIdx = (this.votesIdx + 1) % 50;
        this.votesCount = Math.min(50, this.votesCount + 1);
    }

    public getRecentVotes(count: number): CouncilVote[] {
        const result: CouncilVote[] = [];
        const limit = Math.min(count, this.votesCount);
        for (let i = 0; i < limit; i++) {
            const idx = (this.votesIdx - limit + i + 50) % 50;
            const v = this.votes[idx];
            if (v) result.push(v);
        }
        return result;
    }

    public recordFileWrite(filePath: string, diffSummary: string) {
        if (!this.memory.writtenFiles.includes(filePath)) {
            this.memory.writtenFiles.push(filePath);
        }
        this.memory.actionDiffs[filePath] = diffSummary;
    }

    public clearTurnState() {
        this.memory.writtenFiles = [];
        this.memory.actionDiffs = {};
        this.memory.wiringAlerts = [];
        // Optional: reduce streak if we've been idle? Engine handles decay, so we just clear turn-data.
    }

    public pruneHotspots() {
        const keys = Object.keys(this.memory.errorHotspots);
        if (keys.length > 20) {
            const sorted = keys.sort((a, b) => this.memory.errorHotspots[b] - this.memory.errorHotspots[a]);
            const nextHotspots: Record<string, number> = {};
            for (const k of sorted.slice(0, 20)) {
                nextHotspots[k] = this.memory.errorHotspots[k];
            }
            this.memory.errorHotspots = nextHotspots;
        }
    }

    public getPersistentSnapshot() {
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
