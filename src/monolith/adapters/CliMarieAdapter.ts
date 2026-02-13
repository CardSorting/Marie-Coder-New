import { MarieCallbacks, RunTelemetry } from '../domain/marie/MarieTypes.js';
import { registerMarieToolsCLI } from '../cli/MarieToolDefinitionsCLI.js';
import { Storage, SessionMetadata } from '../cli/storage.js';
import { JoyServiceCLI } from '../cli/services/JoyServiceCLI.js';
import { MarieRuntime } from '../runtime/MarieRuntime.js';
import { MarieProviderType, RuntimeAutomationPort, RuntimeConfigPort, RuntimeSessionStorePort } from '../runtime/types.js';
import { createDefaultProvider } from '../runtime/providerFactory.js';
import { RuntimeAdapterBase } from '../runtime/RuntimeAdapterBase.js';

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

export class MarieCLI extends RuntimeAdapterBase<RuntimeAutomationPort> {
    private readonly joyService: JoyServiceCLI;

    constructor(workingDir: string = process.cwd()) {
        const joyService = new JoyServiceCLI();
        const automationService: RuntimeAutomationPort = {
            setCurrentRun: (_run: RunTelemetry | undefined) => {
                // CLI automation hooks are intentionally minimal.
            },
            dispose: () => {
                // No-op
            }
        };

        const runtime = new MarieRuntime<RuntimeAutomationPort>({
            config: new CliConfigPort(),
            sessionStore: new CliSessionStorePort(),
            toolRegistrar: (registry, automation) => registerMarieToolsCLI(registry, automation, workingDir),
            providerFactory: createDefaultProvider,
            automationService,
            onProgressEvent: (event) => joyService.emitRunProgress(event as any),
            shouldBypassApprovals: () => {
                const config = Storage.getConfig();
                const autonomyMode = config.autonomyMode || (config.requireApproval === false ? 'high' : 'balanced');
                return autonomyMode === 'yolo';
            }
        });

        super(runtime);
        this.joyService = joyService;
    }

    public dispose() {
        super.dispose();
        this.joyService.dispose();
    }
}
