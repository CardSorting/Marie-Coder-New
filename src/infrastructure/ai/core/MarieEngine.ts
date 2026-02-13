import { AIProvider, AIStreamEvent } from "../providers/AIProvider.js";
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
import { AgentIntentScheduler } from "./AgentIntentScheduler.js";
import { AgentStreamPolicyEngine } from "./AgentStreamPolicyEngine.js";
import { AgentStreamManager } from "./AgentStreamManager.js";
import { AgentMergeArbiter } from "./AgentMergeArbiter.js";
import { AgentEnvelope, AgentIntentRequest, AgentTurnContext } from "./AgentStreamContracts.js";
import { ConfigService } from "../../config/ConfigService.js";

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
    private agentStreamPolicy: AgentStreamPolicyEngine;
    private agentIntentScheduler: AgentIntentScheduler;
    private agentStreamManager: AgentStreamManager;
    private agentMergeArbiter: AgentMergeArbiter;
    private qasreAgent: MarieQASRE;

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
        this.qasreAgent = qasre;
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
        this.agentStreamPolicy = new AgentStreamPolicyEngine();
        this.agentIntentScheduler = new AgentIntentScheduler(this.agentStreamPolicy);
        this.agentStreamManager = new AgentStreamManager();
        this.agentMergeArbiter = new AgentMergeArbiter();
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
        await this.previewAgentControlPlane(tracker, snapshot, messages);
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

        const session = new MarieSession(this.provider, this.toolRegistry, saveHistory, messages, tracker, this.providerFactory);
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

        const latestUserText = this.extractLatestUserText(messages);
        const isToollessCodeOnlyTurn =
            totalToolCount === 0 &&
            this.looksLikeFileActionRequest(latestUserText) &&
            !this.isExplicitlyTextOnlyRequest(latestUserText) &&
            this.containsCodeBlocks(finalContent) &&
            !latestUserText.startsWith("⚠️ ACTION REQUIRED:");

        if (isToollessCodeOnlyTurn && consecutiveErrorCount < 3) {
            this.council.recordShakyResponse();
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "🛠️ ENFORCEMENT: Detected code-only response for a file-action request. Requiring real tool execution now.",
                elapsedMs: tracker.elapsedMs()
            });

            messages.push({
                role: "user",
                content: "⚠️ ACTION REQUIRED: Do not paste implementation code only. You MUST execute file/terminal tools to create or modify workspace files, then summarize what changed."
            });

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

    private extractLatestUserText(messages: any[]): string {
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message?.role !== 'user') continue;

            if (typeof message.content === 'string') {
                return message.content;
            }

            if (Array.isArray(message.content)) {
                const text = message.content
                    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
                    .map((b: any) => b.text)
                    .join('\n')
                    .trim();
                if (text) return text;
            }
        }

        return '';
    }

    private looksLikeFileActionRequest(text: string): boolean {
        if (!text) return false;
        const lowered = text.toLowerCase();

        const actionHints = [
            'create file', 'write file', 'edit file', 'update file', 'modify file',
            'patch', 'workspace', 'folder', 'run command', 'cli', 'terminal',
            'apply patch', 'implement', 'scaffold', 'save to', 'in the project'
        ];

        const fileHints = ['file', 'workspace', 'folder', 'directory', 'cli', 'terminal', 'repo', 'project'];
        const hasActionHint = actionHints.some(token => lowered.includes(token));
        const hasFileHint = fileHints.some(token => lowered.includes(token));

        return hasActionHint && hasFileHint;
    }

    private isExplicitlyTextOnlyRequest(text: string): boolean {
        if (!text) return false;
        const lowered = text.toLowerCase();

        return [
            'just explain',
            'explain only',
            'only explain',
            'do not modify',
            "don't modify",
            'no edits',
            'show example',
            'example only',
            'just show code',
        ].some(token => lowered.includes(token));
    }

    private containsCodeBlocks(text: string): boolean {
        if (!text) return false;
        return /```[\s\S]*?```/.test(text);
    }

    /**
     * Non-invasive control-plane preview for future isolated agent streams.
     * This does not spawn streams yet; it only validates planning + arbitration wiring.
     */
    private async previewAgentControlPlane(tracker: MarieProgressTracker, snapshot: any, messages: any[]): Promise<void> {
        const hotspotCount = Object.values(snapshot.errorHotspots || {}).filter((c: any) => (c as number) > 0).length;
        const pilotAgents = new Set(ConfigService.getAgentStreamPilotAgents().map(a => a.toUpperCase()));
        const context: AgentTurnContext = {
            runId: tracker.getRun().runId,
            flowState: snapshot.flowState || 0,
            errorCount: this.council.getErrorCount(),
            hotspotCount,
            objectiveCount: tracker.getPendingObjectives().length,
            pressure: MarieStabilityMonitor.isHighPressure() ? 'HIGH' : 'MEDIUM',
        };

        const intents: AgentIntentRequest[] = [
            {
                intent: 'QUALITY_REGRESSION_SCAN',
                candidateAgents: ['QASRE'],
                urgency: hotspotCount > 0 ? 1.1 : 0.8,
                risk: Math.max(0.6, hotspotCount * 0.4),
                expectedValue: 1.2,
                tokenCostEstimate: 350,
                contentionFactor: 1.0,
            },
            {
                intent: 'READINESS_GATE',
                candidateAgents: ['ISO9001'],
                urgency: tracker.getPendingObjectives().length === 0 ? 1.2 : 0.7,
                risk: 0.9,
                expectedValue: 1.0,
                tokenCostEstimate: 300,
                contentionFactor: 1.0,
            },
        ];

        const plans = this.agentIntentScheduler.plan(context, intents);
        this.agentMergeArbiter.clear();

        if (context.pressure === 'HIGH' && ConfigService.isAgentStreamPressureSheddingEnabled()) {
            const shed = this.agentStreamManager.shedNonCriticalStreams();
            if (shed.length > 0) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🧯 Pressure shedding cancelled ${shed.length} non-critical agent streams`,
                    elapsedMs: tracker.elapsedMs(),
                });
            }
        }

        let policyAcceptedCount = 0;
        let executionAcceptedCount = 0;
        for (const plan of plans) {
            if (plan.policyAccepted) policyAcceptedCount++;
            if (plan.executionAccepted) executionAcceptedCount++;
        }

        const spawnBudget = Math.min(
            this.agentStreamPolicy.getMaxConcurrentStreams(),
            ConfigService.getAgentStreamMaxSpawnsPerTurn()
        );
        let spawnedThisTurn = 0;

        for (const plan of plans.slice(0, spawnBudget)) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🧭 StreamPlan #${plan.sequence} ${plan.agentId}/${plan.intent} score=${plan.score.toFixed(2)} policy=${plan.policyAccepted ? 'accept' : 'reject'} execute=${plan.executionAccepted ? 'accept' : 'reject'} (${plan.mode})`,
                elapsedMs: tracker.elapsedMs(),
            });

            if (!plan.executionAccepted) continue;
            if (spawnedThisTurn >= spawnBudget) break;

            const handle = this.agentStreamManager.spawn(plan);
            if (!handle) continue;
            spawnedThisTurn++;

            const isPilotAgent = pilotAgents.has(String(plan.agentId).toUpperCase());

            tracker.emitEvent({
                type: 'agent_stream_lifecycle',
                runId: tracker.getRun().runId,
                streamIdentity: plan.streamIdentity,
                status: 'spawned',
                reason: plan.reason,
                elapsedMs: tracker.elapsedMs(),
            });

            tracker.emitEvent({
                type: 'agent_stream_lifecycle',
                runId: tracker.getRun().runId,
                streamIdentity: plan.streamIdentity,
                status: 'running',
                elapsedMs: tracker.elapsedMs(),
            });

            try {
                if (isPilotAgent && plan.agentId === 'QASRE') {
                    const qasreContext = this.council.getRecentChangesSummary();
                    const resultText = await this.qasreAgent.evaluateIsolatedStream(
                        messages,
                        qasreContext,
                        handle.abortController.signal,
                        (event) => this.emitAgentStreamUpdate(tracker, handle.streamId, plan.agentId, event)
                    );

                    const envelope = this.buildQasreEnvelope(handle, plan.intent, resultText);
                    this.agentMergeArbiter.stage(envelope);
                    this.agentStreamManager.complete(handle.streamId);

                    const terminal = this.agentStreamManager.consumeTerminalState(handle.streamId);

                    tracker.emitEvent({
                        type: 'agent_stream_lifecycle',
                        runId: tracker.getRun().runId,
                        streamIdentity: envelope.streamIdentity,
                        status: 'completed',
                        reason: terminal?.reason,
                        elapsedMs: tracker.elapsedMs(),
                    });
                } else {
                    this.agentMergeArbiter.stage(this.agentStreamManager.toEnvelope(handle, {
                        decision: 'PREVIEW_ONLY',
                        confidence: 0.5,
                        summary: isPilotAgent
                            ? `Pilot requested for ${plan.agentId}, but isolated execution path is not implemented yet`
                            : `Planned ${plan.agentId} for ${plan.intent}`,
                    }));
                    this.agentStreamManager.complete(handle.streamId);
                    this.agentStreamManager.consumeTerminalState(handle.streamId);
                }
            } catch (error: any) {
                const terminal = this.agentStreamManager.consumeTerminalState(handle.streamId);
                if (!terminal) {
                    this.agentStreamManager.fail(handle.streamId);
                }

                const terminalAfterFail = terminal || this.agentStreamManager.consumeTerminalState(handle.streamId);
                tracker.emitEvent({
                    type: 'agent_stream_lifecycle',
                    runId: tracker.getRun().runId,
                    streamIdentity: plan.streamIdentity,
                    status: terminalAfterFail?.status || (error?.name === 'AbortError' ? 'timed_out' : 'failed'),
                    reason: terminalAfterFail?.reason || error?.message || 'agent stream execution failed',
                    elapsedMs: tracker.elapsedMs(),
                });
            }
        }

        const decision = this.agentMergeArbiter.evaluate();
        for (const envelope of decision.accepted) {
            tracker.emitEvent({
                type: 'agent_envelope',
                runId: tracker.getRun().runId,
                streamIdentity: envelope.streamIdentity,
                envelope: {
                    decision: envelope.decision,
                    confidence: envelope.confidence,
                    evidenceRefs: envelope.evidenceRefs,
                    recommendedActions: envelope.recommendedActions,
                    blockingConditions: envelope.blockingConditions,
                    summary: envelope.summary,
                },
                elapsedMs: tracker.elapsedMs(),
            });

            if (envelope.streamIdentity.agentId === 'QASRE') {
                const previousQasreEnvelope = this.council.blackboard.read('agent:qasre:lastEnvelope') as { streamId?: string } | undefined;
                this.council.blackboard.write('agent:qasre:lastEnvelope', {
                    decision: envelope.decision,
                    confidence: envelope.confidence,
                    summary: envelope.summary,
                    timestamp: envelope.createdAt,
                    streamId: envelope.streamIdentity.streamId,
                });

                const isDuplicateVote = previousQasreEnvelope?.streamId === envelope.streamIdentity.streamId;
                if (!isDuplicateVote && (envelope.decision === 'QASRE_DEBUG' || envelope.decision === 'QASRE_CRITICAL') && envelope.confidence >= 1.2) {
                    this.council.registerVote('QASRE', 'DEBUG', `Agent stream finding: ${envelope.summary || 'risk detected'}`, Math.min(2.2, Math.max(1.0, envelope.confidence)));
                }
            }
        }

        if (plans.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🛰️ Agent Stream Control Plane (${plans[0].mode}): policy ${policyAcceptedCount}/${plans.length}, execution ${executionAcceptedCount}/${plans.length}, merged ${decision.accepted.length} accepted / ${decision.rejected.length} rejected.`,
                elapsedMs: tracker.elapsedMs(),
            });
        }
    }

    private buildQasreEnvelope(handle: { streamId: string; agentId: string; }, intent: AgentIntentRequest['intent'], resultText: string): AgentEnvelope {
        const text = (resultText || '').trim();
        const normalized = text.toUpperCase();
        const critical = normalized.includes('CRITICAL') || normalized.includes('DATA LOSS') || normalized.includes('SECURITY');
        const risky = normalized.includes('RISK: HIGH') || normalized.includes('RISK') || normalized.includes('FAILED') || normalized.includes('ERROR');

        let decision: AgentEnvelope['decision'] = 'QASRE_NO_ACTION';
        let confidence = 0.8;
        if (critical) {
            decision = 'QASRE_CRITICAL';
            confidence = 2.1;
        } else if (risky) {
            decision = 'QASRE_DEBUG';
            confidence = 1.6;
        }

        return {
            streamIdentity: {
                streamId: handle.streamId,
                origin: 'agent',
                agentId: handle.agentId,
            },
            intent,
            decision,
            confidence,
            evidenceRefs: [`stream:${handle.streamId}`],
            recommendedActions: [],
            blockingConditions: critical ? ['critical_quality_risk'] : [],
            summary: text.slice(0, 240) || 'No QASRE summary produced',
            createdAt: Date.now(),
        };
    }

    private emitAgentStreamUpdate(tracker: MarieProgressTracker, streamId: string, agentId: string, event: AIStreamEvent): void {
        if (event.type === 'stage_change') {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🧵 ${agentId} stream ${streamId} stage=${event.stage}${event.label ? ` (${event.label})` : ''}`,
                elapsedMs: tracker.elapsedMs(),
            });
            return;
        }

        if (event.type === 'usage') {
            const usage = event.usage?.totalTokens ?? event.usage?.outputTokens ?? 0;
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🧵 ${agentId} stream ${streamId} usage=${usage} tokens`,
                elapsedMs: tracker.elapsedMs(),
            });
            return;
        }

        if (event.type === 'content_delta' && event.text.trim().length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🧵 ${agentId} Δ ${event.text.trim().slice(0, 120)}`,
                elapsedMs: tracker.elapsedMs(),
            });
        }
    }

    public dispose(): void {
        this.disposed = true;
        this.agentStreamManager.cancelAll('engine_dispose');
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
