import * as vscode from "vscode";
import { ToolRegistry } from "./infrastructure/tools/ToolRegistry.js";
import { ConfigService } from "./infrastructure/config/ConfigService.js";
import { AnthropicProvider } from "./infrastructure/ai/providers/AnthropicProvider.js";
import { OpenRouterProvider } from "./infrastructure/ai/providers/OpenRouterProvider.js";
import { CerebrasProvider } from "./infrastructure/ai/providers/CerebrasProvider.js";
import { AIProvider } from "./infrastructure/ai/providers/AIProvider.js";
import { MarieEngine } from "./infrastructure/ai/core/MarieEngine.js";
import { MarieProgressTracker } from "./infrastructure/ai/core/MarieProgressTracker.js";
import { MarieCallbacks, RunTelemetry } from "./domain/marie/MarieTypes.js";
import { registerMarieTools } from "./infrastructure/tools/MarieToolDefinitions.js";
import { JoyAutomationService } from "./services/JoyAutomationService.js";
import { JoyService } from "./services/JoyService.js";
import { StringUtils } from "./plumbing/utils/StringUtils.js";
import { MarieResponse } from "./infrastructure/ai/core/MarieResponse.js";

export class Marie implements vscode.Disposable {
    private provider: AIProvider | undefined;
    private _lastProviderKey: string | undefined;
    private toolRegistry: ToolRegistry;
    private automationService: JoyAutomationService;
    private currentSessionId: string = 'default';
    private messages: any[] = [];
    private abortController: AbortController | null = null;
    private currentRun: RunTelemetry | undefined;

    constructor(private context: vscode.ExtensionContext, public readonly joyService: JoyService) {
        this.toolRegistry = new ToolRegistry();
        this.automationService = new JoyAutomationService(context, joyService);
        this.registerTools();
        this.currentSessionId = context.workspaceState.get<string>('marie.currentSessionId') || 'default';
        this.loadHistory();
    }

    private registerTools() {
        registerMarieTools(this.toolRegistry, this.automationService);
    }

    public createProvider(providerType: string): AIProvider {
        const key = providerType === 'openrouter'
            ? ConfigService.getOpenRouterApiKey() || ''
            : providerType === 'cerebras'
                ? ConfigService.getCerebrasApiKey() || ''
                : ConfigService.getApiKey() || '';

        if (providerType === 'openrouter') {
            return new OpenRouterProvider(key);
        } else if (providerType === 'cerebras') {
            return new CerebrasProvider(key);
        } else {
            return new AnthropicProvider(key);
        }
    }

    private initializeProvider() {
        const providerType = ConfigService.getAiProvider();
        const key = providerType === 'openrouter'
            ? ConfigService.getOpenRouterApiKey() || ''
            : providerType === 'cerebras'
                ? ConfigService.getCerebrasApiKey() || ''
                : ConfigService.getApiKey() || '';

        const cacheKey = `${providerType}:${key}`;
        if (this.provider && this._lastProviderKey === cacheKey) {
            return; // Provider unchanged — skip re-creation
        }
        this._lastProviderKey = cacheKey;
        this.provider = this.createProvider(providerType);
    }

    private async loadHistory() {
        const historyMap = this.context.workspaceState.get<Record<string, any[]>>('marie.sessions') || {};
        this.messages = historyMap[this.currentSessionId] || [];
    }

    private async saveHistory(telemetry?: any, specificSessionId?: string, runStartTime?: number) {
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(this.messages.length - 50);
        }

        const sid = specificSessionId || this.currentSessionId;
        const historyMap = this.context.workspaceState.get<Record<string, any[]>>('marie.sessions') || {};

        // PHASE 6: Fenced History Saving - Enhanced fencing logic
        // This prevents a finishing run from session A from accidentally overwriting session B's history
        const currentSessionMatches = sid === this.currentSessionId;
        const isSessionStillValid = runStartTime ? true : currentSessionMatches;

        // FENCING: Only save if we are targeting the intended session and the session hasn't changed since run started
        if (sid === this.currentSessionId && isSessionStillValid) {
            historyMap[sid] = this.messages;
        } else {
            console.warn(`[Marie] FENCING VIOLATION: Session switched mid-run. ` +
                `Originating: ${sid}, Current: ${this.currentSessionId}. ` +
                `History will NOT be overwritten. Run telemetry preserved separately.`);
            // Don't update historyMap for the wrong session - prevents cross-session pollution
            // But preserve the existing history for the original session if it exists
            if (!historyMap[sid]) {
                historyMap[sid] = []; // Ensure session entry exists
            }
        }

        await this.context.workspaceState.update('marie.sessions', historyMap);

        const sessionMetadata = this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
        const index = sessionMetadata.findIndex(s => s.id === sid);

        // Helper to get messages for titling correctly
        const targetMessages = sid === this.currentSessionId ? this.messages : historyMap[sid];
        const firstMsg = targetMessages && targetMessages.length > 0 ? targetMessages[0].content : '';
        const title = targetMessages && targetMessages.length > 0 ? this.generateSessionTitle(firstMsg) : 'New Session';

        if (index >= 0) {
            sessionMetadata[index].lastModified = Date.now();
            if (sessionMetadata[index].title === 'New Session') {
                sessionMetadata[index].title = title;
            }
        } else if (sid !== 'default') {
            sessionMetadata.unshift({
                id: sid,
                title: title,
                lastModified: Date.now(),
                isPinned: false
            });
        }
        await this.context.workspaceState.update('marie.sessionMetadata', sessionMetadata);

        if (sid === this.currentSessionId) {
            await this.context.workspaceState.update('marie.currentSessionId', sid);
        }

        if (telemetry !== undefined) {
            await this.context.workspaceState.update('marie.lastTelemetry', telemetry === null ? undefined : telemetry);
        }
    }

    private generateSessionTitle(firstMessage: any): string {
        const response = MarieResponse.wrap(firstMessage);
        const text = response.getText();

        // Heuristic 1: Look for "Goal: ..." or "Objective: ..."
        const goalMatch = text.match(/(?:Goal|Objective|Task):\s*([^\n.]+)/i);
        if (goalMatch && goalMatch[1].trim()) {
            return this.formatTitle(goalMatch[1].trim());
        }

        // Heuristic 2: Look for first line if it's substantial
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5);
        if (lines.length > 0 && lines[0].length < 60) {
            return this.formatTitle(lines[0]);
        }

        // Fallback: Standard truncation
        const summary = text.trim() || 'New Session';
        return this.formatTitle(summary);
    }

    private formatTitle(text: string): string {
        const clean = text.replace(/^[#\-*\s]+/, '').trim();
        if (clean.length > 30) {
            return clean.substring(0, 27) + '...';
        }
        return clean || 'New Session';
    }

    public async createSession() {
        this.currentSessionId = `session_${Date.now()}`;
        this.messages = [];
        await this.saveHistory();
        return this.currentSessionId;
    }

    public async listSessions() {
        return this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
    }

    public async loadSession(id: string): Promise<string> {
        this.stopGeneration(); // Abort any active run before switching context
        this.currentSessionId = id;
        await this.loadHistory();
        await this.context.workspaceState.update('marie.currentSessionId', id);
        return this.currentSessionId;
    }

    public async deleteSession(id: string) {
        if (this.currentSessionId === id) {
            this.stopGeneration(); // Abort if we're deleting the active session
        }
        const historyMap = this.context.workspaceState.get<Record<string, any[]>>('marie.sessions') || {};
        delete historyMap[id];
        await this.context.workspaceState.update('marie.sessions', historyMap);

        const sessionMetadata = this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
        const filteredMetadata = sessionMetadata.filter(s => s.id !== id);
        await this.context.workspaceState.update('marie.sessionMetadata', filteredMetadata);

        if (this.currentSessionId === id) {
            if (filteredMetadata.length > 0) {
                await this.loadSession(filteredMetadata[0].id);
            } else {
                await this.createSession();
            }
        }
    }

    public async renameSession(id: string, newTitle: string) {
        const sessionMetadata = this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
        const index = sessionMetadata.findIndex(s => s.id === id);
        if (index >= 0) {
            sessionMetadata[index].title = newTitle;
            await this.context.workspaceState.update('marie.sessionMetadata', sessionMetadata);
        }
    }

    public async togglePinSession(id: string) {
        const sessionMetadata = this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
        const index = sessionMetadata.findIndex(s => s.id === id);
        if (index >= 0) {
            sessionMetadata[index].isPinned = !sessionMetadata[index].isPinned;
            await this.context.workspaceState.update('marie.sessionMetadata', sessionMetadata);
        }
    }

    public async handleMessage(text: string, callbacks?: MarieCallbacks): Promise<string> {
        this.initializeProvider();
        if (!this.provider) {
            return "Please configure your API Key in Settings (Marie > Api Key or OpenRouter Api Key). ✨";
        }

        const lastTelemetry = this.context.workspaceState.get<RunTelemetry>('marie.lastTelemetry');

        // PHASE 6: Deep Session Fencing - Capture session context at run creation
        const originatingSessionId = this.currentSessionId;
        const run: RunTelemetry = {
            runId: `run_${Date.now()}`,
            startedAt: Date.now(),
            steps: 0,
            tools: 0,
            objectives: [
                { id: 'understand_request', label: 'Understand request', status: 'in_progress' },
                { id: 'execute_plan', label: 'Execute plan', status: 'pending' },
                { id: 'deliver_result', label: 'Deliver result', status: 'pending' }
            ],
            activeObjectiveId: 'understand_request',
            achieved: [],
            // Resume pass state if available
            currentPass: lastTelemetry?.currentPass,
            totalPasses: lastTelemetry?.totalPasses,
            passFocus: lastTelemetry?.passFocus,
            isResuming: !!lastTelemetry,
            // PHASE 6: Store originating session ID for fencing
            originatingSessionId
        };

        const tracker = new MarieProgressTracker({
            ...callbacks,
            // PHASE 6: Include originatingSessionId in all callbacks for fencing
            onStream: (chunk) => callbacks?.onStream?.(chunk, run.runId, originatingSessionId),
            onTool: (tool) => callbacks?.onTool?.(tool, run.runId, originatingSessionId),
            onToolDelta: (delta) => callbacks?.onToolDelta?.(delta, run.runId, originatingSessionId),
            onEvent: (event) => {
                // PHASE 6: Attach originating session ID to all events
                (event as any).originatingSessionId = originatingSessionId;
                callbacks?.onEvent?.(event);
            }
        }, run);
        this.currentRun = run;
        this.automationService.setCurrentRun(run);

        // Wire progress updates to JoyService for global exception diagnostics
        const originalOnEvent = callbacks?.onEvent;
        callbacks = {
            ...callbacks,
            onEvent: (event) => {
                if (event.type === 'progress_update') {
                    this.joyService.onRunProgress(event as any);
                }
                originalOnEvent?.(event);
            }
        };

        // Custom approval requester that bridges to the frontend
        const approvalRequester = async (name: string, input: any, diff?: { old: string, new: string }): Promise<boolean> => {
            return new Promise<boolean>((resolve) => {
                const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.pendingApprovals.set(requestId, resolve);

                // Send approval request to frontend
                if (callbacks?.onEvent) {
                    const run = tracker.getRun();
                    const activeObjective = run.objectives.find((o: any) => o.id === run.activeObjectiveId)?.label;

                    callbacks.onEvent({
                        type: 'approval_request',
                        requestId,
                        toolName: name,
                        toolInput: input,
                        elapsedMs: tracker.elapsedMs(),
                        reasoning: run.currentContext,
                        activeObjective,
                        diff
                    } as any);
                }
            });
        };

        const engine = new MarieEngine(this.provider, this.toolRegistry, approvalRequester, this.createProvider.bind(this));

        tracker.emitEvent({ type: 'run_started', runId: run.runId, startedAt: run.startedAt });
        tracker.emitProgressUpdate('Thinking...');

        this.messages.push({ role: "user", content: text });
        await this.saveHistory();

        // Create new controller for this run
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        const runStartTime = Date.now();

        try {
            const response = await engine.chatLoop(
                this.messages,
                tracker,
                // PHASE 6: Pass the originating sessionId to ensure history is saved to the correct session
                (t: any) => this.saveHistory(t, originatingSessionId, runStartTime),
                this.abortController.signal
            );

            // Phase 3: AI-driven title summarization
            // After 3-5 messages, if title is still "New Chat", try to summarize
            if (this.messages.length >= 6 && this.messages.length <= 10) {
                const sessionMetadata = this.context.workspaceState.get<any[]>('marie.sessionMetadata') || [];
                const session = sessionMetadata.find(s => s.id === this.currentSessionId);
                if (session && (session.title === 'New Session' || session.title.length > 50)) {
                    this.summarizeSession(this.currentSessionId).catch(console.error);
                }
            }

            return response;
        } catch (error) {
            tracker.emitEvent({ type: 'run_error', runId: run.runId, elapsedMs: tracker.elapsedMs(), message: String(error) });
            return `Error: ${error}`;
        } finally {
            this.abortController = null;
            this.currentRun = undefined;
        }
    }

    private async summarizeSession(id: string) {
        this.initializeProvider();
        if (!this.provider) return;

        const historyMap = this.context.workspaceState.get<Record<string, any[]>>('marie.sessions') || {};
        const messages = historyMap[id] || [];
        if (messages.length < 2) return;

        const engine = new MarieEngine(this.provider, this.toolRegistry, async () => true);
        const prompt = "Based on our conversation so far, generate a very concise (3-5 words) and descriptive title for this session. Respond ONLY with the title. No quotes, no intro.";

        try {
            const summary = await engine.chatLoop(
                [...messages, { role: 'user', content: prompt }],
                { emitProgressUpdate: () => { }, emitEvent: () => { } } as any,
                async () => { }
            );

            if (summary && typeof summary === 'string' && summary.length < 60) {
                await this.renameSession(id, summary.trim().replace(/^"|"$/g, ''));
            } else if (summary && summary.length < 60) {
                const text = StringUtils.extractText(summary).trim();
                await this.renameSession(id, text.replace(/^"|"$/g, ''));
            }
        } catch (e) {
            console.error("Failed to summarize session", e);
        }
    }

    // Map to store pending approval promises: requestId -> resolve function
    private pendingApprovals = new Map<string, (approved: boolean) => void>();

    public handleToolApproval(requestId: string, approved: boolean) {
        const resolve = this.pendingApprovals.get(requestId);
        if (resolve) {
            resolve(approved);
            this.pendingApprovals.delete(requestId);
        }
    }

    public async clearCurrentSession() {
        this.messages = [];
        await this.saveHistory();
    }

    public stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // Reject any pending approval promises to prevent leaked resolvers
        for (const [id, resolve] of this.pendingApprovals) {
            resolve(false);
        }
        this.pendingApprovals.clear();
    }

    public updateSettings() {
        this.initializeProvider();
    }

    public async getModels() {
        this.initializeProvider();
        return this.provider?.listModels() || [];
    }

    public getMessages() {
        return this.messages;
    }

    public getCurrentSessionId(): string {
        return this.currentSessionId;
    }

    public getCurrentRun(): RunTelemetry | undefined {
        return this.currentRun;
    }

    public dispose() {
        this.stopGeneration();
        if (this.automationService?.dispose) {
            this.automationService.dispose();
        }
        // Reject any pending approval promises to prevent leaked resolvers
        for (const [id, resolve] of this.pendingApprovals) {
            resolve(false);
        }
        this.pendingApprovals.clear();
    }
}
