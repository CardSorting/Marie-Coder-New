import { ToolRegistry } from '../infrastructure/tools/ToolRegistry.js';
import { AnthropicProvider } from '../infrastructure/ai/providers/AnthropicProvider.js';
import { OpenRouterProvider } from '../infrastructure/ai/providers/OpenRouterProvider.js';
import { CerebrasProvider } from '../infrastructure/ai/providers/CerebrasProvider.js';
import { AIProvider } from '../infrastructure/ai/providers/AIProvider.js';
import { MarieEngine } from '../infrastructure/ai/core/MarieEngine.js';
import { MarieProgressTracker } from '../infrastructure/ai/core/MarieProgressTracker.js';
import { MarieCallbacks, RunTelemetry } from '../domain/marie/MarieTypes.js';
import { registerMarieToolsCLI } from './MarieToolDefinitionsCLI.js';
import { StringUtils } from '../plumbing/utils/StringUtils.js';
import { MarieResponse } from '../infrastructure/ai/core/MarieResponse.js';
import { Storage, SessionMetadata } from './storage.js';
import { JoyServiceCLI } from './services/JoyServiceCLI.js';
import { JoyAutomationServiceCLI } from './services/JoyAutomationServiceCLI.js';
import * as path from 'path';
import * as fs from 'fs';

export class MarieCLI {
    private provider: AIProvider | undefined;
    private _lastProviderKey: string | undefined;
    private toolRegistry: ToolRegistry;
    private automationService: JoyAutomationServiceCLI;
    private currentSessionId: string = 'default';
    private messages: any[] = [];
    private abortController: AbortController | null = null;
    private currentRun: RunTelemetry | undefined;
    private joyService: JoyServiceCLI;
    private pendingApprovals = new Map<string, (approved: boolean) => void>();
    private workingDir: string;

    constructor(workingDir: string = process.cwd()) {
        this.workingDir = workingDir;
        this.toolRegistry = new ToolRegistry();
        this.joyService = new JoyServiceCLI();
        this.automationService = new JoyAutomationServiceCLI(this.joyService, workingDir);
        this.registerTools();
        this.currentSessionId = Storage.getCurrentSessionId();
        this.loadHistory();
    }

    private registerTools() {
        registerMarieToolsCLI(this.toolRegistry, this.automationService, this.workingDir);
    }

    public createProvider(providerType: string): AIProvider {
        const config = Storage.getConfig();
        const key = providerType === 'openrouter'
            ? config.openrouterApiKey || ''
            : providerType === 'cerebras'
                ? config.cerebrasApiKey || ''
                : config.apiKey || '';

        if (providerType === 'openrouter') {
            return new OpenRouterProvider(key);
        } else if (providerType === 'cerebras') {
            return new CerebrasProvider(key);
        } else {
            return new AnthropicProvider(key);
        }
    }

    private initializeProvider() {
        const config = Storage.getConfig();
        const providerType = config.aiProvider;
        const key = providerType === 'openrouter'
            ? config.openrouterApiKey || ''
            : providerType === 'cerebras'
                ? config.cerebrasApiKey || ''
                : config.apiKey || '';

        const cacheKey = `${providerType}:${key}`;
        if (this.provider && this._lastProviderKey === cacheKey) {
            return;
        }
        this._lastProviderKey = cacheKey;
        this.provider = this.createProvider(providerType);
    }

    private async loadHistory() {
        const historyMap = Storage.getSessions();
        this.messages = historyMap[this.currentSessionId] || [];
    }

    private async saveHistory(telemetry?: any, specificSessionId?: string, runStartTime?: number) {
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(this.messages.length - 50);
        }

        const sid = specificSessionId || this.currentSessionId;
        const historyMap = Storage.getSessions();
        const currentSessionMatches = sid === this.currentSessionId;
        const isSessionStillValid = runStartTime ? true : currentSessionMatches;

        if (sid === this.currentSessionId && isSessionStillValid) {
            historyMap[sid] = this.messages;
        } else {
            console.warn(`[Marie] FENCING VIOLATION: Session switched mid-run.`);
            if (!historyMap[sid]) {
                historyMap[sid] = [];
            }
        }

        Storage.saveSessions(historyMap);

        const sessionMetadata = Storage.getSessionMetadata();
        const index = sessionMetadata.findIndex((s: SessionMetadata) => s.id === sid);
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
        Storage.saveSessionMetadata(sessionMetadata);

        if (sid === this.currentSessionId) {
            Storage.setCurrentSessionId(sid);
        }

        if (telemetry !== undefined) {
            Storage.setLastTelemetry(telemetry === null ? undefined : telemetry);
        }
    }

    private generateSessionTitle(firstMessage: any): string {
        const response = MarieResponse.wrap(firstMessage);
        const text = response.getText();
        const goalMatch = text.match(/(?:Goal|Objective|Task):\s*([^\n.]+)/i);
        if (goalMatch && goalMatch[1].trim()) {
            return this.formatTitle(goalMatch[1].trim());
        }
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5);
        if (lines.length > 0 && lines[0].length < 60) {
            return this.formatTitle(lines[0]);
        }
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

    public listSessions(): SessionMetadata[] {
        return Storage.getSessionMetadata();
    }

    public async loadSession(id: string): Promise<string> {
        this.stopGeneration();
        this.currentSessionId = id;
        await this.loadHistory();
        Storage.setCurrentSessionId(id);
        return this.currentSessionId;
    }

    public async deleteSession(id: string) {
        if (this.currentSessionId === id) {
            this.stopGeneration();
        }
        const historyMap = Storage.getSessions();
        delete historyMap[id];
        Storage.saveSessions(historyMap);

        const sessionMetadata = Storage.getSessionMetadata();
        const filteredMetadata = sessionMetadata.filter(s => s.id !== id);
        Storage.saveSessionMetadata(filteredMetadata);

        if (this.currentSessionId === id) {
            if (filteredMetadata.length > 0) {
                await this.loadSession(filteredMetadata[0].id);
            } else {
                await this.createSession();
            }
        }
    }

    public async renameSession(id: string, newTitle: string) {
        const sessionMetadata = Storage.getSessionMetadata();
        const index = sessionMetadata.findIndex(s => s.id === id);
        if (index >= 0) {
            sessionMetadata[index].title = newTitle;
            Storage.saveSessionMetadata(sessionMetadata);
        }
    }

    public async togglePinSession(id: string) {
        const sessionMetadata = Storage.getSessionMetadata();
        const index = sessionMetadata.findIndex(s => s.id === id);
        if (index >= 0) {
            sessionMetadata[index].isPinned = !sessionMetadata[index].isPinned;
            Storage.saveSessionMetadata(sessionMetadata);
        }
    }

    public async handleMessage(text: string, callbacks?: MarieCallbacks): Promise<string> {
        this.initializeProvider();
        if (!this.provider) {
            return "Please configure your API Key. Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or CEREBRAS_API_KEY environment variable, or use 'marie config' command.";
        }

        const lastTelemetry = Storage.getLastTelemetry();
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
            currentPass: lastTelemetry?.currentPass,
            totalPasses: lastTelemetry?.totalPasses,
            passFocus: lastTelemetry?.passFocus,
            isResuming: !!lastTelemetry,
            originatingSessionId
        };

        const tracker = new MarieProgressTracker({
            ...callbacks,
            onStream: (chunk) => callbacks?.onStream?.(chunk, run.runId, originatingSessionId),
            onTool: (tool) => callbacks?.onTool?.(tool, run.runId, originatingSessionId),
            onToolDelta: (delta) => callbacks?.onToolDelta?.(delta, run.runId, originatingSessionId),
            onEvent: (event) => {
                (event as any).originatingSessionId = originatingSessionId;
                callbacks?.onEvent?.(event);
            }
        }, run);
        this.currentRun = run;
        this.automationService.setCurrentRun(run);

        const originalOnEvent = callbacks?.onEvent;
        callbacks = {
            ...callbacks,
            onEvent: (event) => {
                if (event.type === 'progress_update') {
                    this.joyService.emitRunProgress(event as any);
                }
                originalOnEvent?.(event);
            }
        };

        const approvalRequester = async (name: string, input: any, diff?: { old: string, new: string }): Promise<boolean> => {
            return new Promise<boolean>((resolve) => {
                const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.pendingApprovals.set(requestId, resolve);

                if (callbacks?.onEvent) {
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

        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        const runStartTime = Date.now();

        try {
            const response = await engine.chatLoop(
                this.messages,
                tracker,
                (t: any) => this.saveHistory(t, originatingSessionId, runStartTime),
                this.abortController.signal
            );

            if (this.messages.length >= 6 && this.messages.length <= 10) {
                const sessionMetadata = Storage.getSessionMetadata();
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

        const historyMap = Storage.getSessions();
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
        for (const [id, resolve] of this.pendingApprovals) {
            resolve(false);
        }
        this.pendingApprovals.clear();
    }
}