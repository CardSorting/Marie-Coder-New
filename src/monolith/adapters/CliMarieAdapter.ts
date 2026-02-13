import { AnthropicProvider } from '../../infrastructure/ai/providers/AnthropicProvider.js';
import { OpenRouterProvider } from '../../infrastructure/ai/providers/OpenRouterProvider.js';
import { CerebrasProvider } from '../../infrastructure/ai/providers/CerebrasProvider.js';
import { AIProvider } from '../../infrastructure/ai/providers/AIProvider.js';
import { MarieCallbacks, RunTelemetry } from '../../domain/marie/MarieTypes.js';
import { registerMarieToolsCLI } from '../../cli/MarieToolDefinitionsCLI.js';
import { Storage, SessionMetadata } from '../../cli/storage.js';
import { JoyServiceCLI } from '../../cli/services/JoyServiceCLI.js';
import { JoyAutomationServiceCLI } from '../../cli/services/JoyAutomationServiceCLI.js';
import { MarieRuntime } from '../runtime/MarieRuntime.js';
import { MarieProviderType, RuntimeConfigPort, RuntimeSessionStorePort } from '../runtime/types.js';

class CliConfigPort implements RuntimeConfigPort {
    getAiProvider(): MarieProviderType {
        const config = Storage.getConfig();
        return config.aiProvider;
    }

    getApiKey(provider: MarieProviderType): string {
        const config = Storage.getConfig();
        if (provider === 'openrouter') return config.openrouterApiKey || '';
        if (provider === 'cerebras') return config.cerebrasApiKey || '';
        return config.apiKey || '';
    }
}

class CliSessionStorePort implements RuntimeSessionStorePort {
    async getSessions(): Promise<Record<string, any[]>> {
        return Storage.getSessions();
    }

    async saveSessions(sessions: Record<string, any[]>): Promise<void> {
        Storage.saveSessions(sessions);
    }

    async getSessionMetadata(): Promise<SessionMetadata[]> {
        return Storage.getSessionMetadata();
    }

    async saveSessionMetadata(metadata: SessionMetadata[]): Promise<void> {
        Storage.saveSessionMetadata(metadata);
    }

    async getCurrentSessionId(): Promise<string> {
        return Storage.getCurrentSessionId();
    }

    async setCurrentSessionId(id: string): Promise<void> {
        Storage.setCurrentSessionId(id);
    }

    async getLastTelemetry(): Promise<RunTelemetry | undefined> {
        return Storage.getLastTelemetry();
    }

    async setLastTelemetry(telemetry: RunTelemetry | undefined): Promise<void> {
        Storage.setLastTelemetry(telemetry);
    }
}

export class MarieCLI {
    private readonly runtime: MarieRuntime<JoyAutomationServiceCLI>;
    private readonly joyService: JoyServiceCLI;

    constructor(workingDir: string = process.cwd()) {
        this.joyService = new JoyServiceCLI();
        const automationService = new JoyAutomationServiceCLI(this.joyService, workingDir);

        this.runtime = new MarieRuntime<JoyAutomationServiceCLI>({
            config: new CliConfigPort(),
            sessionStore: new CliSessionStorePort(),
            toolRegistrar: (registry, automation) => registerMarieToolsCLI(registry, automation, workingDir),
            providerFactory: (providerType, apiKey) => {
                if (providerType === 'openrouter') return new OpenRouterProvider(apiKey);
                if (providerType === 'cerebras') return new CerebrasProvider(apiKey);
                return new AnthropicProvider(apiKey);
            },
            automationService,
            onProgressEvent: (event) => this.joyService.emitRunProgress(event as any),
            shouldBypassApprovals: () => {
                const config = Storage.getConfig();
                const autonomyMode = config.autonomyMode || (config.requireApproval === false ? 'high' : 'balanced');
                return autonomyMode === 'yolo';
            }
        });
    }

    public createProvider(providerType: string): AIProvider {
        const config = Storage.getConfig();
        const key = providerType === 'openrouter'
            ? config.openrouterApiKey || ''
            : providerType === 'cerebras'
                ? config.cerebrasApiKey || ''
                : config.apiKey || '';

        if (providerType === 'openrouter') return new OpenRouterProvider(key);
        if (providerType === 'cerebras') return new CerebrasProvider(key);
        return new AnthropicProvider(key);
    }

    public async createSession() { return this.runtime.createSession(); }
    public async listSessions(): Promise<SessionMetadata[]> { return this.runtime.listSessions(); }
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

    public dispose() {
        this.runtime.dispose();
        this.joyService.dispose();
    }
}
