import { MarieCallbacks, RunTelemetry } from "../domain/marie/MarieTypes.js";
import { AIProvider } from "../infrastructure/ai/providers/AIProvider.js";

export type MarieProviderType = 'anthropic' | 'openrouter' | 'cerebras';

export interface SessionMetadata {
    id: string;
    title: string;
    lastModified: number;
    isPinned: boolean;
}

export interface RuntimeConfigPort {
    getAiProvider(): MarieProviderType;
    getApiKey(provider: MarieProviderType): string;
}

export interface RuntimeSessionStorePort {
    getSessions(): Promise<Record<string, any[]>>;
    saveSessions(sessions: Record<string, any[]>): Promise<void>;
    getSessionMetadata(): Promise<SessionMetadata[]>;
    saveSessionMetadata(metadata: SessionMetadata[]): Promise<void>;
    getCurrentSessionId(): Promise<string>;
    setCurrentSessionId(id: string): Promise<void>;
    getLastTelemetry(): Promise<RunTelemetry | undefined>;
    setLastTelemetry(telemetry: RunTelemetry | undefined): Promise<void>;
}

export interface RuntimeAutomationPort {
    setCurrentRun(run: RunTelemetry | undefined): void;
    dispose?(): void;
}

export interface RuntimeOptions<TAutomation extends RuntimeAutomationPort> {
    config: RuntimeConfigPort;
    sessionStore: RuntimeSessionStorePort;
    toolRegistrar: (registry: any, automation: TAutomation) => void;
    providerFactory: (providerType: MarieProviderType, apiKey: string) => AIProvider;
    automationService: TAutomation;
    onProgressEvent?: (event: any) => void;
    shouldBypassApprovals?: () => boolean;
}

export interface RuntimeMessageHandler {
    handleMessage(text: string, callbacks?: MarieCallbacks): Promise<string>;
}