import * as vscode from "vscode";
import { MarieCallbacks, RunTelemetry } from "../domain/marie/MarieTypes.js";
import { registerMarieTools } from "../infrastructure/tools/MarieToolDefinitions.js";
import { JoyAutomationService } from "../services/JoyAutomationService.js";
import { JoyService } from "../services/JoyService.js";
import { ConfigService } from "../infrastructure/config/ConfigService.js";
import { MarieRuntime } from "../runtime/MarieRuntime.js";
import { MarieProviderType, RuntimeConfigPort, RuntimeSessionStorePort, SessionMetadata } from "../runtime/types.js";
import { createDefaultProvider } from "../runtime/providerFactory.js";
import { RuntimeAdapterBase } from "../runtime/RuntimeAdapterBase.js";

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

export class Marie extends RuntimeAdapterBase<JoyAutomationService> implements vscode.Disposable {

    constructor(private context: vscode.ExtensionContext, public readonly joyService: JoyService) {
        const automationService = new JoyAutomationService(context, joyService);
        const runtime = new MarieRuntime<JoyAutomationService>({
            config: new VscodeConfigPort(),
            sessionStore: new VscodeSessionStorePort(context),
            toolRegistrar: registerMarieTools,
            providerFactory: createDefaultProvider,
            automationService,
            onProgressEvent: (event) => this.joyService.onRunProgress(event as any),
            shouldBypassApprovals: () => ConfigService.getAutonomyMode() === 'yolo'
        });

        super(runtime);
    }
    public dispose() { super.dispose(); }
}
