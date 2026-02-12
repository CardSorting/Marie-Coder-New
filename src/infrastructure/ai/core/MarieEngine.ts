import * as vscode from 'vscode';
import { AIProvider } from "../providers/AIProvider.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieSession } from "./MarieSession.js";
import { MarieEventDispatcher } from "./MarieEventDispatcher.js";
import { MarieToolProcessor } from "./MarieToolProcessor.js";
import { MarieAuditor } from "../agents/MarieAuditor.js";
import { MarieScribe } from "../agents/MarieScribe.js";
import { MarieStrategist } from "../agents/MarieStrategist.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { MarieAgentSwarm } from "../agents/MarieAgentSwarm.js";
import { MarieQASRE } from "../agents/MarieQASRE.js";
import { MarieISO9001 } from "../agents/MarieISO9001.js";
import { MarieYOLO } from "../agents/MarieYOLO.js";
import { MarieLockManager } from "./MarieLockManager.js";
import { MarieToolMender } from "./MarieToolMender.js";
import { MarieDirectiveService } from "./MarieDirectiveService.js";
import { MariePulseService } from "./MariePulseService.js";
import { MarieStabilityMonitor } from "./MarieStabilityMonitor.js";
import { ReasoningBudget, SchemaValidators } from "./ReasoningBudget.js";

/**
 * Entry point for the AI Engine. Thin orchestrator of modular units.
 */
export class MarieEngine {
    private static readonly CONTENT_BUFFER_MAX_BYTES = 1024 * 1024;
    private scribe: MarieScribe;
    private strategist: MarieStrategist;
    private council: MarieCouncil;
    private swarm: MarieAgentSwarm;
    private lockManager: MarieLockManager;
    private toolMender: MarieToolMender;
    private directiveService: MarieDirectiveService;
    private pulseService: MariePulseService | undefined;
    private reasoningBudget: ReasoningBudget;
    private toolCallCounter: number = 0;
    private lastFailedFile: string | undefined;
    private contentBuffer: string = "";
    private lastContentEmit: number = 0;
    private static activeTurn: Promise<void> | null = null;
    private disposed: boolean = false;

    constructor(
        private provider: AIProvider,
        private toolRegistry: ToolRegistry,
        private approvalRequester: (name: string, input: any) => Promise<boolean>,
        private providerFactory?: (type: string) => AIProvider
    ) {
        this.council = new MarieCouncil();
        this.scribe = new MarieScribe(this.provider, this.council);
        this.strategist = new MarieStrategist(this.council);
        this.lockManager = new MarieLockManager();
        this.toolMender = new MarieToolMender(this.toolRegistry, this.council);
        this.directiveService = new MarieDirectiveService(this.council);
        const iso9001 = new MarieISO9001(this.provider);
        const yolo = new MarieYOLO(this.provider);
        const qasre = new MarieQASRE(this.provider, this.council);
        const auditor = new MarieAuditor(this.provider, this.toolRegistry, this.approvalRequester, this.council);

        this.swarm = new MarieAgentSwarm(
            this.council,
            this.strategist,
            auditor,
            qasre,
            iso9001,
            yolo
        );
        this.reasoningBudget = new ReasoningBudget();
    }

    public async chatLoop(
        messages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>,
        signal?: AbortSignal,
        consecutiveErrorCount: number = 0,
        depth: number = 0
    ): Promise<string> {
        if (this.disposed) {
            throw new Error("MarieEngine has been disposed.");
        }

        // TURN COLLISION GUARD: Wait for any existing turn to finish
        if (MarieEngine.activeTurn) {
            console.warn("[MarieEngine] TURN COLLISION DETECTED. Waiting for previous turn to finalize...");

            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "⏳ TURN COLLISION: Another AI turn is active. Queuing reasoning loop...",
                elapsedMs: tracker.elapsedMs()
            });

            const pulse = this.ensurePulseService(tracker);
            const watchdog = pulse.startTurnWatchdog(() => {
                MarieEngine.activeTurn = null;
            });

            try {
                await MarieEngine.activeTurn;
            } finally {
                if (watchdog) clearTimeout(watchdog);
            }
        }

        let resolveTurn: () => void = () => { };
        MarieEngine.activeTurn = new Promise<void>(resolve => { resolveTurn = resolve; });

        try {
            const result = await this._executeChatLoop(messages, tracker, saveHistory, signal, consecutiveErrorCount, depth);
            await this.council.persistAsync().catch(e => console.error("[MarieEngine] Persistence Error:", e));
            return result;
        } finally {
            resolveTurn();
            MarieEngine.activeTurn = null;
        }
    }

    private async _executeChatLoop(
        messages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>,
        signal?: AbortSignal,
        consecutiveErrorCount: number = 0,
        depth: number = 0
    ): Promise<string> {
        const pulse = this.ensurePulseService(tracker);

        if (depth > 15) {
            throw new Error("Extreme Stability Alert: Maximum chatLoop depth reached. Possible infinite reasoning loop detected.");
        }

        // REASONING BUDGET: Reset at start of each turn to prevent infinite growth
        tracker.resetReasoningBudget();

        this.lockManager = new MarieLockManager(tracker);
        const dispatcher = new MarieEventDispatcher(tracker);
        MarieStabilityMonitor.start();

        // Phase 12: Hype Start
        if (tracker.getRun().steps === 0 && !tracker.getRun().isResuming) {
            this.strategist.hypeStart(tracker);
        }

        this.council.decayFlowIfStale();
        this.council.clearTurnState();

        const snapshot = this.council.getSnapshot();
        const directive = this.directiveService.buildCouncilDirective(snapshot);
        if (directive) {
            messages.push({ role: "user", content: directive });
        }

        const processor = new MarieToolProcessor(
            this.toolRegistry,
            tracker,
            async (name, input) => {
                if (await this.strategist.shouldAutoApprove(name, input)) {
                    tracker.emitEvent({
                        type: 'checkpoint',
                        runId: tracker.getRun().runId,
                        status: 'approved',
                        toolName: name,
                        summary: { what: 'Auto-Approved', why: 'LGTM', impact: 'High Velocity' },
                        elapsedMs: tracker.elapsedMs()
                    });
                    return true;
                }
                return this.approvalRequester(name, input);
            },
            this.council
        );

        const pendingObjectives = tracker.getPendingObjectives();
        const activeFile = tracker.getRun().activeFilePath;
        const rankedObjectives = this.strategist.rankObjectivesByProximity(pendingObjectives, activeFile);

        const injectionPromise = this.strategist.injectProactiveTools(tracker, messages, rankedObjectives.length);
        const timeoutPromise = new Promise<any[]>(resolve => setTimeout(() => resolve([]), 800));

        const injectedTools = await Promise.race([injectionPromise, timeoutPromise]);

        if (injectedTools.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🧠 HIVE MIND: Injecting ${injectedTools.length} proactive actions in parallel...`,
                elapsedMs: tracker.elapsedMs()
            });

            await Promise.all(injectedTools.map(async (tool) => {
                const fakeId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await processor.process({ ...tool, id: fakeId }, signal);
            }));
        }

        let finalContent = "";
        const toolBuffer: Map<number, any> = new Map();
        const parsedInputCache = new Map<string, any>();
        const toolResultBlocks: any[] = [];
        let turnFailureCount = 0;
        let totalToolCount = 0;
        let lastTokenTime = Date.now();

        // GAS LIMIT: Prevent infinite reasoning loops in a single turn
        const MAX_TOOLS_PER_TURN = 25;
        const tryParseToolInput = (rawInput: string, toolName?: string): { input: any; repaired: boolean } | null => {
            const cached = parsedInputCache.get(rawInput);
            if (cached) return { input: cached, repaired: false };

            try {
                const parsed = JSON.parse(rawInput);
                parsedInputCache.set(rawInput, parsed);
                if (parsedInputCache.size > 50) {
                    const firstKey = parsedInputCache.keys().next().value;
                    if (firstKey) parsedInputCache.delete(firstKey);
                }
                return { input: parsed, repaired: false };
            } catch {
                const repaired = this.toolMender.repairJsonString(rawInput);
                if (repaired === rawInput) return null;

                try {
                    const parsed = JSON.parse(repaired);
                    parsedInputCache.set(rawInput, parsed);
                    if (parsedInputCache.size > 50) {
                        const firstKey = parsedInputCache.keys().next().value;
                        if (firstKey) parsedInputCache.delete(firstKey);
                    }
                    return { input: parsed, repaired: true };
                } catch {
                    if (toolName) {
                        console.warn(`[MarieEngine] Failed spectral repair parse for tool ${toolName}.`);
                    }
                    return null;
                }
            }
        };

        const executeTool = async (toolCall: any) => {
            const tool = this.toolRegistry.getTool(toolCall.name);
            if (!tool) {
                this.council.recordShakyResponse();
                return { type: "tool_result", tool_use_id: toolCall.id, content: `Error: Tool "${toolCall.name}" not found in registry.` };
            }

            this.strategist.announceToolStart(tracker, toolCall.name, toolCall.input);
            const startTime = Date.now();
            this.council.recordToolCall(toolCall.name);
            pulse.startHeartbeat();

            try {
                let toolResult = await processor.process(toolCall, signal);

                // Buffer Hard-Cap Audit
                if (typeof toolResult === 'string' && toolResult.length > 1024 * 1024) {
                    console.warn(`[MarieStability] Tool result for ${toolCall.name} exceeded 1MB. Truncating...`);
                    toolResult = toolResult.substring(0, 1024 * 1024) + "\n\n🚨 STABILITY WARNING: Tool output truncated at 1MB to prevent memory exhaustion.";
                }

                const durationMs = Date.now() - startTime;
                const errorFile = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;

                if (typeof toolResult === 'string' && toolResult.startsWith('HALT:')) {
                    this.strategist.trackFailure(tracker, toolCall.name, errorFile);
                    this.council.updateFlowState(-30);
                    return { halt: true, result: toolResult };
                }

                if (typeof toolResult === 'string' && toolResult.startsWith('Error')) {
                    const repairedResult = await this.toolMender.performFuzzyRepair(toolCall, toolResult, tracker, processor, snapshot, signal);
                    if (repairedResult) toolResult = repairedResult;
                }

                if (typeof toolResult === 'string' && toolResult.startsWith('Error')) {
                    this.strategist.trackFailure(tracker, toolCall.name, errorFile);
                    this.council.updateFlowState(-20);
                    turnFailureCount++;
                    if (errorFile) {
                        this.council.recordError(errorFile, toolResult, toolCall.name);
                        this.lastFailedFile = errorFile;
                    }
                } else {
                    this.handleSuccess(tracker, toolCall, durationMs, errorFile);
                }

                this.toolCallCounter++;
                return { type: "tool_result", tool_use_id: toolCall.id, content: toolResult };
            } finally {
                pulse.stopHeartbeat();
            }
        };

        const session = new MarieSession(this.provider, saveHistory, messages, tracker, this.providerFactory);
        try {
            const stream = session.executeLoop(messages, signal, snapshot);
            for await (const event of stream) {
                const now = Date.now();
                const tokenDuration = now - lastTokenTime;
                lastTokenTime = now;
                pulse.startHeartbeat();

                if (event.type === 'content_delta') {
                    // Engine Buffer Hard-Cap
                    if (finalContent.length < MarieEngine.CONTENT_BUFFER_MAX_BYTES) {
                        finalContent += event.text.slice(0, MarieEngine.CONTENT_BUFFER_MAX_BYTES - finalContent.length);
                    }
                    if (this.contentBuffer.length < MarieEngine.CONTENT_BUFFER_MAX_BYTES) {
                        this.contentBuffer += event.text.slice(0, MarieEngine.CONTENT_BUFFER_MAX_BYTES - this.contentBuffer.length);
                    }

                    if (this.contentBuffer.length >= MarieEngine.CONTENT_BUFFER_MAX_BYTES) {
                        console.warn("[MarieStability] Buffer Hard-Cap hit (1MB). Force-finalizing turn.");
                        tracker.emitEvent({
                            type: 'reasoning',
                            runId: tracker.getRun().runId,
                            text: "🚨 STABILITY ALERT: Content buffer exceeded 1MB. Finalizing results early to preserve memory.",
                            elapsedMs: tracker.elapsedMs()
                        });
                        break; // Exit stream loop
                    }

                    if (now - this.lastContentEmit > 100) {
                        tracker.emitStream(this.contentBuffer);
                        this.contentBuffer = "";
                        this.lastContentEmit = now;
                    }
                    this.council.trackStreamCadence(tokenDuration, false);
                } else if (event.type === 'tool_call_delta') {
                    this.council.trackStreamCadence(tokenDuration, true);
                    let tb = toolBuffer.get(event.index);
                    if (!tb) {
                        tb = { id: event.id, name: event.name, inputString: "" };
                        toolBuffer.set(event.index, tb);
                    }
                    if (event.argumentsDelta) tb.inputString += event.argumentsDelta;

                    if (tb.name && this.isLikelyCompleteJson(tb.inputString)) {
                        const parsed = tryParseToolInput(tb.inputString, tb.name);
                        if (!parsed) continue;

                        if (parsed.repaired) {
                            tracker.emitEvent({
                                type: 'reasoning', runId: tracker.getRun().runId,
                                text: `🩹 SPECTRAL REPAIR: Fixed malformed JSON for ${tb.name}. Dispatched.`,
                                elapsedMs: tracker.elapsedMs()
                            });
                        }

                        const input = parsed.input;
                        toolBuffer.delete(event.index);
                        totalToolCount++;

                        if (totalToolCount > MAX_TOOLS_PER_TURN) {
                            console.warn(`[MarieStability] Reasoning Gas Limit hit (${MAX_TOOLS_PER_TURN} tools). Terminating turn.`);
                            tracker.emitEvent({
                                type: 'reasoning',
                                runId: tracker.getRun().runId,
                                text: `🚨 GAS LIMIT REACHED: Turn exceeded ${MAX_TOOLS_PER_TURN} tool calls. Enforcing strategic cooldown...`,
                                elapsedMs: tracker.elapsedMs()
                            });
                            break; // Kill the stream loop
                        }

                        const target = input.path || input.targetFile || input.file || 'GLOBAL';
                        const contextId = tracker.getRun().runId;

                        // HARDWARE THROTTLING: If under high pressure, force sequential execution or add pause
                        const executeWithPressureAwareness = async () => {
                            if (MarieStabilityMonitor.isHighPressure()) {
                                tracker.emitEvent({
                                    type: 'reasoning',
                                    runId: tracker.getRun().runId,
                                    text: `🐢 HIGH PRESSURE DETECTED: Sequentializing tool ${tb.name} to preserve stability...`,
                                    elapsedMs: tracker.elapsedMs()
                                });
                                await this.lockManager.waitForAll(); // Force sequentialization
                                await new Promise(resolve => setTimeout(resolve, 200)); // Small breather
                            }

                            const isWrite = ['write_to_file', 'replace_file_content', 'multi_replace_file_content', 'run_command', 'delete_file'].includes(tb.name);
                            await this.lockManager.acquireLock(target, isWrite, signal, contextId);
                            const selfPromise = executeTool({ id: tb.id, name: tb.name, input })
                                .then(res => {
                                    const resultString = typeof res === 'string' ? res : JSON.stringify(res);
                                    // Extreme Stability: Early truncation to prevent memory spikes
                                    if (resultString.length > 512 * 1024) {
                                        return {
                                            ... (typeof res === 'object' ? res : { content: resultString }),
                                            content: resultString.substring(0, 512 * 1024) + "\n\n🚨 STABILITY ALERT: Massive tool output truncated early (512KB limit)."
                                        };
                                    }
                                    toolResultBlocks.push(res);
                                    return res;
                                });
                            this.lockManager.registerExecution(target, isWrite, selfPromise, contextId);
                        };

                        executeWithPressureAwareness();
                    }
                } else if (event.type === 'usage') {
                    tracker.getRun().usage = event.usage;
                }
            }
        } finally {
            pulse.cleanup();
        }

        if (this.contentBuffer.length > 0) {
            tracker.emitStream(this.contentBuffer);
            this.contentBuffer = "";
        }

        await this.lockManager.waitForAll();

        // Final Flush for any remaining tools in buffer
        for (const [index, tb] of Array.from(toolBuffer.entries())) {
            try {
                let input = parsedInputCache.get(tb.inputString);
                if (!input) {
                    const parsed = tryParseToolInput(tb.inputString, tb.name);
                    if (!parsed) {
                        console.warn(`[MarieEngine] Final flush skipped malformed tool payload for ${tb.name}.`);
                        continue;
                    }
                    input = parsed.input;
                }
                const res = await executeTool({ id: tb.id, name: tb.name, input });
                toolResultBlocks.push(res);
                totalToolCount++;
            } catch (e) {
                console.error(`Final flush failed for tool ${tb.name}:`, e);
            }
        }

        if (totalToolCount > 0) {
            this.council.recordQualityResponse();
            const nextErrorCount = (turnFailureCount === totalToolCount) ? consecutiveErrorCount + 1 : 0;
            messages.push({ role: "user", content: toolResultBlocks });

            this.swarm.evaluateSwarm(tracker, nextErrorCount, messages)
                .catch(e => console.error("Swarm Eval Async Error", e));

            if (turnFailureCount > 0 && this.strategist.isYolo) {
                const firstFailure = toolResultBlocks.find(r => r.content?.includes('Error') || r.halt);
                const failedFile = (firstFailure as any)?.content?.match(/path: (.*)/)?.[1] || this.lastFailedFile;
                if (failedFile) {
                    const shotgunTools = await this.swarm.runShotgunRecovery(tracker, failedFile);
                    const shotgunResults = await Promise.all(shotgunTools.map((t: any) => executeTool({ ...t, id: `shotgun-${Date.now()}` } as any)));
                    toolResultBlocks.push(...shotgunResults);
                }
            }

            const councilStrategy = this.council.getStrategy();
            if (councilStrategy === 'PANIC') {
                this.council.activatePanicCoolDown(3);
                const errorMemory = this.directiveService.getErrorMemorySummary(snapshot);
                messages.push({ role: "user", content: `🚨 COUNCIL PANIC PROTOCOL: Error hotspots: ${errorMemory}\n\nYou MUST call \`perform_strategic_planning\`.` });
                return await this._executeChatLoop(messages, tracker, saveHistory, signal, 0, depth + 1);
            }

            saveHistory(tracker.getRun()).catch(e => console.error("History Save Async Error", e));
            return await this._executeChatLoop(messages, tracker, saveHistory, signal, nextErrorCount, depth + 1);
        }

        if (tracker.getPendingObjectives().length > 0 && consecutiveErrorCount < 5 && finalContent.trim().length < 10) {
            this.council.recordShakyResponse();
            messages.push({ role: "user", content: "⚠️ SYSTEM ALERT: Objectives remain incomplete. Please continue." });
            return await this._executeChatLoop(messages, tracker, saveHistory, signal, consecutiveErrorCount + 1, depth + 1);
        }

        // BALANCED SUPREMACY: Audit logic respects Founder's high conviction
        if (consecutiveErrorCount < 3 && finalContent.length > 20) {
            const yoloDecision = this.council.getLastYoloDecision();
            const yoloHighConfidence = yoloDecision && yoloDecision.confidence >= 2.5;
            const yoloHasHypeOrExecute = yoloDecision && (yoloDecision.strategy === 'HYPE' || yoloDecision.strategy === 'EXECUTE');

            // Skip audit if YOLO has high conviction and we're in EXECUTE/HYPE mode
            const needsAudit = !yoloHighConfidence && (snapshot.flowState < 40 || Object.keys(snapshot.errorHotspots).length > 0);

            if (needsAudit) {
                const auditor = new MarieAuditor(this.provider, this.toolRegistry, this.approvalRequester, this.council);
                const rejection = await auditor.audit(messages, tracker, saveHistory);
                if (rejection) {
                    messages.push({ role: "user", content: `⚠️ AUDITOR FEEDBACK: ${rejection}` });
                    return await this._executeChatLoop(messages, tracker, saveHistory, signal, consecutiveErrorCount + 1, depth + 1);
                }
            } else if (yoloHighConfidence && yoloHasHypeOrExecute) {
                // BALANCED SUPREMACY: Acknowledge Founder's authority in telemetry
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `The Founder's conviction holds. Audit deferred to maintain momentum.`,
                    elapsedMs: tracker.elapsedMs()
                });
            }
            this.scribe.generateReport(tracker).catch(e => console.error("Scribe async error:", e));
        }

        tracker.setObjectiveStatus('execute_plan', 'completed');
        tracker.setObjectiveStatus('deliver_result', 'completed');
        this.strategist.celebrateVictory(tracker);
        this.council.recordStrategyOutcome(true);

        dispatcher.clear();
        return finalContent;
    }

    private handleSuccess(tracker: MarieProgressTracker, toolCall: any, durationMs: number, successFile?: string) {
        this.strategist.trackSuccess(tracker, toolCall.name, durationMs);
        this.council.recordToolExecution(toolCall.name, durationMs, true, successFile);
        if (successFile && this.lastFailedFile === successFile) this.lastFailedFile = undefined;
        if (successFile) this.council.recordFileContext(successFile);
    }

    private isLikelyCompleteJson(input: string): boolean {
        const text = input.trim();
        if (!text) return false;
        const startsLikeJson = text.startsWith('{') || text.startsWith('[');
        if (!startsLikeJson) return false;

        let inString = false;
        let escapeNext = false;
        const stack: string[] = [];

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (inString) {
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                if (ch === '\\') {
                    escapeNext = true;
                    continue;
                }
                if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === '{' || ch === '[') {
                stack.push(ch);
            } else if (ch === '}') {
                if (stack.pop() !== '{') return false;
            } else if (ch === ']') {
                if (stack.pop() !== '[') return false;
            }
        }

        return !inString && stack.length === 0;
    }

    public dispose(): void {
        this.disposed = true;
        this.pulseService?.cleanup();
        this.pulseService = undefined;
        this.contentBuffer = "";
        this.lastContentEmit = 0;
        this.lastFailedFile = undefined;
    }

    private ensurePulseService(tracker: MarieProgressTracker): MariePulseService {
        if (!this.pulseService) {
            this.pulseService = new MariePulseService(tracker);
        }
        return this.pulseService;
    }
}
