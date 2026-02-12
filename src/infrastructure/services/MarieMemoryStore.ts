import * as fs from 'fs';
import * as path from 'path';

export interface PersistentSwarmMemory {
    recoveryPatterns: Array<{ failedTool: string, recoveryTool: string, count: number }>;
    lifetimeToolStats: Record<string, { total: number, successes: number, totalDuration: number }>;
    highScores: Array<{ score: number, grade: string, timestamp: number }>;
    strategyStats: Record<string, { attempts: number, successes: number }>;
    intuition: Record<string, string[]>; // file -> patterns
    agentPerformance?: AgentPerformanceData;
}

export interface AgentPerformanceData {
    timestamp: number;
    performanceStats: Array<{
        agent: string;
        successRate: number;
        avgExecutionTime: number;
        totalCalls: number;
    }>;
    specializationProfiles: Array<[string, any]>;
    yoloAnalytics: {
        totalOverrides: number;
        overrideSuccessRate: number;
        avgConviction: number;
    };
}

export class MarieMemoryStore {
    private static memoryPath = path.join(process.cwd(), '.marie', 'swarm_memory.json');

    static async loadAsync(): Promise<PersistentSwarmMemory> {
        try {
            await fs.promises.access(this.memoryPath);
            const data = await fs.promises.readFile(this.memoryPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            // Ignore ENOENT, warn on others
            if ((e as any).code !== 'ENOENT') {
                console.warn("[MarieMemoryStore] Failed to load memory async:", e);
            }
        }
        return {
            recoveryPatterns: [],
            lifetimeToolStats: {},
            highScores: [],
            strategyStats: {},
            intuition: {}
        };
    }

    static async saveAsync(memory: PersistentSwarmMemory) {
        try {
            const dir = path.dirname(this.memoryPath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(this.memoryPath, JSON.stringify(memory, null, 2));
        } catch (e) {
            console.error("[MarieMemoryStore] Failed to save memory async:", e);
        }
    }

    // Keep synchronous load for constructor initialization (fallback)
    static load(): PersistentSwarmMemory {
        try {
            if (fs.existsSync(this.memoryPath)) {
                const data = fs.readFileSync(this.memoryPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn("[MarieMemoryStore] Failed to load memory sync:", e);
        }
        return {
            recoveryPatterns: [],
            lifetimeToolStats: {},
            highScores: [],
            strategyStats: {},
            intuition: {}
        };
    }

    private static persistencePromise: Promise<void> = Promise.resolve();

    /**
     * Updates cumulative stats with data from a single run (Async).
     * Hardened with a persistence lock to prevent race conditions during parallel turns.
     */
    static async syncRun(
        recoveryPatterns: Array<{ failedTool: string, recoveryTool: string, count: number }>,
        toolExecutions: Array<{ name: string, durationMs: number, success: boolean }>,
        sessionScore: { score: number, grade: string },
        intuition: Record<string, string[]>
    ) {
        // ATOMIC INTEGRITY: Serialize all persistence operations
        const previous = this.persistencePromise;
        let resolveLock: () => void;
        this.persistencePromise = new Promise(resolve => { resolveLock = resolve; });

        try {
            await previous;
            const memory = await this.loadAsync();

            // 1. Sync Recovery Patterns (Merge by failedTool + recoveryTool)
            for (const p of recoveryPatterns) {
                const existing = memory.recoveryPatterns.find(ep => ep.failedTool === p.failedTool && ep.recoveryTool === p.recoveryTool);
                if (existing) {
                    existing.count += p.count;
                } else {
                    memory.recoveryPatterns.push(p);
                }
            }

            // 2. Sync Lifetime Tool Stats
            for (const exec of toolExecutions) {
                const stats = memory.lifetimeToolStats[exec.name] || { total: 0, successes: 0, totalDuration: 0 };
                stats.total++;
                if (exec.success) stats.successes++;
                stats.totalDuration += exec.durationMs;
                memory.lifetimeToolStats[exec.name] = stats;
            }

            // 3. Sync High Scores (Keep top 10)
            memory.highScores.push({ ...sessionScore, timestamp: Date.now() });
            memory.highScores.sort((a, b) => b.score - a.score);
            memory.highScores = memory.highScores.slice(0, 10);

            // 4. Sync Intuition
            for (const [file, patterns] of Object.entries(intuition)) {
                const existing = memory.intuition[file] || [];
                const merged = Array.from(new Set([...existing, ...patterns]));
                memory.intuition[file] = merged.slice(-10); // Keep last 10 patterns per file globally
            }

            await this.saveAsync(memory);
        } finally {
            resolveLock!();
        }
    }

    // Agent Performance Persistence
    private static agentPerformancePath = path.join(process.cwd(), '.marie', 'agent_performance.json');

    /**
     * Save agent performance data for cross-session persistence
     */
    static async syncAgentPerformance(data: AgentPerformanceData): Promise<void> {
        try {
            const dir = path.dirname(this.agentPerformancePath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(this.agentPerformancePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("[MarieMemoryStore] Failed to save agent performance:", e);
        }
    }

    /**
     * Load persisted agent performance data
     */
    static loadAgentPerformance(): AgentPerformanceData | null {
        try {
            if (fs.existsSync(this.agentPerformancePath)) {
                const data = fs.readFileSync(this.agentPerformancePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn("[MarieMemoryStore] Failed to load agent performance:", e);
        }
        return null;
    }
}
