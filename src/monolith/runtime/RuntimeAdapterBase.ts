import { MarieCallbacks, RunTelemetry } from "../domain/marie/MarieTypes.js";
import { RuntimeAutomationPort, SessionMetadata } from "./types.js";
import { MarieRuntime } from "./MarieRuntime.js";

/**
 * Shared adapter surface for runtime-backed entry points (CLI / VSCode).
 * Consolidates duplicated passthrough methods.
 */
export abstract class RuntimeAdapterBase<TAutomation extends RuntimeAutomationPort> {
    protected constructor(protected readonly runtime: MarieRuntime<TAutomation>) { }

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

    public dispose() { this.runtime.dispose(); }
}
