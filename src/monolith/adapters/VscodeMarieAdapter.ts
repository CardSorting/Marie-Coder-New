import * as vscode from "vscode";
import { AnthropicProvider } from "../infrastructure/ai/providers/AnthropicProvider.js";
import { OpenRouterProvider } from "../infrastructure/ai/providers/OpenRouterProvider.js";
import { CerebrasProvider } from "../infrastructure/ai/providers/CerebrasProvider.js";
import { MarieCallbacks, RunTelemetry } from "../domain/marie/MarieTypes.js";
import { registerMarieTools } from "../infrastructure/tools/MarieToolDefinitions.js";
import { JoyAutomationService } from "../services/JoyAutomationService.js";
import { JoyService } from "../services/JoyService.js";
import { ConfigService } from "../infrastructure/config/ConfigService.js";
import { MarieRuntime } from "../runtime/MarieRuntime.js";
import { MarieProviderType, RuntimeConfigPort, RuntimeSessionStorePort, SessionMetadata } from "../runtime/types.js";

class VscodeConfigPort implements RuntimeConfigPort {
    getAiProvider(): MarieProviderType {
        return ConfigService.getAiProvider();
    }

    getApiKey(provider: MarieProviderType): string {
        if (provider === 'openrouter') return ConfigService.getOpenRouterApiKey() || '';
        if (provider === 'cerebras') return ConfigService.getCerebrasApiKey() || '';
        return ConfigService.getApiKey() || '';
    }
}

class VscodeSessionStorePort implements RuntimeSessionStorePort {
    constructor(private readonly context: vscode.ExtensionContext) { }

    async getSessions(): Promise<Record<string, any[]>> {
        return this.context.workspaceState.get<Record<string, any[]>>('marie.sessions') || {};
    }

    async saveSessions(sessions: Record<string, any[]>): Promise<void> {
        await this.context.workspaceState.update('marie.sessions', sessions);
    }

    async getSessionMetadata(): Promise<SessionMetadata[]> {
        return this.context.workspaceState.get<SessionMetadata[]>('marie.sessionMetadata') || [];
    }

    async saveSessionMetadata(metadata: SessionMetadata[]): Promise<void> {
        await this.context.workspaceState.update('marie.sessionMetadata', metadata);
    }

    async getCurrentSessionId(): Promise<string> {
        return this.context.workspaceState.get<string>('marie.currentSessionId') || 'default';
    }

    async setCurrentSessionId(id: string): Promise<void> {
        await this.context.workspaceState.update('marie.currentSessionId', id);
    }

    async getLastTelemetry(): Promise<RunTelemetry | undefined> {
        return this.context.workspaceState.get<RunTelemetry>('marie.lastTelemetry');
    }

    async setLastTelemetry(telemetry: RunTelemetry | undefined): Promise<void> {
        await this.context.workspaceState.update('marie.lastTelemetry', telemetry);
    }
}

export class Marie implements vscode.Disposable {
    private readonly runtime: MarieRuntime<JoyAutomationService>;

    constructor(private context: vscode.ExtensionContext, public readonly joyService: JoyService) {
        const automationService = new JoyAutomationService(context, joyService);
        this.runtime = new MarieRuntime<JoyAutomationService>({
            config: new VscodeConfigPort(),
            sessionStore: new VscodeSessionStorePort(context),
            toolRegistrar: registerMarieTools,
            providerFactory: (providerType, apiKey) => {
                if (providerType === 'openrouter') return new OpenRouterProvider(apiKey);
                if (providerType === 'cerebras') return new CerebrasProvider(apiKey);
                return new AnthropicProvider(apiKey);
            },
            automationService,
            onProgressEvent: (event) => this.joyService.onRunProgress(event as any)
        });
    }

    public async createSession() { return this.runtime.createSession(); }
    public async listSessions() { return this.runtime.listSessions(); }
    public async loadSession(id: string): Promise<string> { return this.runtime.loadSession(id); }
    public async deleteSession(id: string) { await this.runtime.deleteSession(id); }
    public async renameSession(id: string, newTitle: string) { await this.runtime.renameSession(id, newTitle); }
    public async togglePinSession(id: string) { await this.runtime.togglePinSession(id); }
    public async handleMessage(text: string, callbacks?: MarieCallbacks): Promise<string> { return this.runtime.handleMessage(text, callbacks); }
    public handleToolApproval(requestId: string, approved: boolean) { this.runtime.handleToolApproval(requestId, approved); }
    public async clearCurrentSession() { await this.runtime.clearCurrentSession(); }
    public stopGeneration() { this.runtime.stopGeneration(); }
    public updateSettings() { this.runtime.updateSettings(); }
    public async getModels() { return this.runtime.getModels(); }
    public getMessages() { return this.runtime.getMessages(); }
    public getCurrentSessionId(): string { return this.runtime.getCurrentSessionId(); }
    public getCurrentRun(): RunTelemetry | undefined { return this.runtime.getCurrentRun(); }
    public dispose() { this.runtime.dispose(); }
}
