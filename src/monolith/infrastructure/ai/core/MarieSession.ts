import { AIProvider, AIStreamEvent } from "../providers/AIProvider.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { ConfigService } from "../../config/ConfigService.js";
import { ContextManager } from "../context/ContextManager.js";
import { SYSTEM_CONTINUATION_PROMPT, SYSTEM_PROMPT } from "../../../../prompts.js";
import { MarieResponse } from "./MarieResponse.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";

export type MarieSessionPromptProfile = 'full' | 'continuation';

/**
 * Manages a single AI chat session with a reactive streaming model.
 */
export class MarieSession {
    constructor(
        private provider: AIProvider,
        private toolRegistry: ToolRegistry,
        private saveHistory: (telemetry?: any) => Promise<void>,
        private messages: any[],
        private tracker?: MarieProgressTracker,
        private providerFactory?: (type: string) => AIProvider,
        private promptProfile: MarieSessionPromptProfile = 'full'
    ) { }

    private resolveSystemPrompt(): string {
        return this.promptProfile === 'continuation'
            ? SYSTEM_CONTINUATION_PROMPT
            : SYSTEM_PROMPT;
    }

    public async *executeLoop(messages: any[], signal?: AbortSignal, councilSnapshot?: {
        strategy: string; mood: string; flowState: number;
        errorHotspots: Record<string, number>;
        successStreak?: number;
        strategyTimeline?: Array<{ strategy: string, reason: string, ago: string }>;
        recoveryPatterns?: Array<{ failedTool: string, recoveryTool: string, count: number }>;
        sessionScore?: { score: number, grade: string };
        comboPeak?: number;
        moodHistory?: string[];
    }): AsyncGenerator<AIStreamEvent> {
        // PHASE 6: Generator Disposal Grace - Snapshot messages before modification
        // This ensures we can restore to a consistent state if aborted mid-run
        const messagesSnapshot = messages.map(m => ({ ...m }));
        let messagesModified = false;

        try {
            const managedMessages = await ContextManager.manage(messages, this.provider, councilSnapshot);

            if (managedMessages !== messages) {
                messages.length = 0;
                for (const msg of managedMessages) {
                    messages.push(msg);
                }
                messagesModified = true;
            }

            const params = {
                model: ConfigService.getModel(),
                max_tokens: 2048,
                messages: managedMessages,
                system: this.resolveSystemPrompt(),
                tools: this.toolRegistry.getTools(),
            } as any;

            const eventQueue: AIStreamEvent[] = [];
            let resolver: ((value: any) => void) | null = null;

            const onAbort = () => {
                if (resolver) {
                    resolver({ done: true, value: undefined });
                    resolver = null;
                }
            };
            signal?.addEventListener('abort', onAbort);

            let streamPromise: Promise<any> | null = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    streamPromise = this.provider.createMessageStream(params, (event) => {
                        eventQueue.push(event);
                        if (resolver) {
                            resolver({ value: eventQueue.shift(), done: false });
                            resolver = null;
                        }
                    }, signal);
                    break;
                } catch (e: any) {
                    attempts++;
                    const isRetryable = e.status === 429 || e.status >= 500 || e.message?.includes('rate limit');

                    if (isRetryable && attempts < maxAttempts && this.providerFactory) {
                        const currentType = ConfigService.getAiProvider();
                        const failoverType = currentType === 'anthropic' ? 'openrouter' : (currentType === 'openrouter' ? 'cerebras' : 'anthropic');

                        console.warn(`[SpectralFailover] Attempt ${attempts} failed for ${currentType}. Switching to ${failoverType}.`);
                        this.tracker?.emitEvent({
                            type: 'reasoning',
                            runId: this.tracker.getRun().runId,
                            text: `🔄 SPECTRAL FAILOVER: ${currentType} is struggling. Switching to ${failoverType} mid-turn...`,
                            elapsedMs: this.tracker.elapsedMs()
                        } as any);

                        this.provider = this.providerFactory(failoverType);
                        continue;
                    }
                    throw e;
                }
            }

            if (!streamPromise) throw new Error("Failed to initialize AI stream.");

            try {
                while (true) {
                    if (signal?.aborted) break;

                    if (eventQueue.length > 0) {
                        const event = eventQueue.shift()!;
                        yield event;
                    } else {
                        const result: any = await Promise.race([
                            streamPromise.then(() => ({ done: true })),
                            new Promise(r => resolver = r)
                        ]);

                        if (result.done) {
                            while (eventQueue.length > 0) {
                                const event = eventQueue.shift()!;
                                yield event;
                            }
                            break;
                        }

                        yield result.value;
                    }
                }
            } finally {
                signal?.removeEventListener('abort', onAbort);
            }

            const response = await streamPromise;
            let finalContent: any = response.content;

            if (response.tool_uses && response.tool_uses.length > 0) {
                const blocks: any[] = [];
                if (Array.isArray(response.content)) {
                    blocks.push(...response.content);
                } else if (response.content) {
                    blocks.push({ type: 'text', text: response.content });
                }
                for (const tool of response.tool_uses) {
                    blocks.push({ type: 'tool_use', ...tool });
                }
                finalContent = blocks;
            }

            if (signal?.aborted) {
                console.warn("[MarieSession] Execution aborted. History will NOT be updated for this turn.");
                // PHASE 6: Generator Disposal Grace - Restore messages to consistent state
                if (messagesModified) {
                    console.warn("[MarieSession] Restoring messages array to pre-run state due to abort.");
                    messages.length = 0;
                    for (const msg of messagesSnapshot) {
                        messages.push(msg);
                    }
                }
                return;
            }

            messages.push({ role: "assistant", content: finalContent });
            await this.saveHistory(this.tracker?.getRun());
        } catch (error) {
            // PHASE 6: Generator Disposal Grace - Restore messages on any error
            if (messagesModified) {
                console.warn("[MarieSession] Restoring messages array to pre-run state due to error:", error);
                messages.length = 0;
                for (const msg of messagesSnapshot) {
                    messages.push(msg);
                }
            }
            throw error;
        }
    }

    /**
     * Non-streaming version for simpler engine integration.
     */
    public async generate(): Promise<MarieResponse> {
        const snapshot = this.tracker?.getRun().councilSnapshot;
        const params = {
            model: ConfigService.getModel(),
            max_tokens: 2048,
            messages: await ContextManager.manage(this.messages, this.provider, snapshot),
            system: this.resolveSystemPrompt(),
            tools: this.toolRegistry.getTools(),
        } as any;

        const response = await this.provider.createMessageStream(params, () => { });
        let finalContent: any = response.content;
        if (response.tool_uses && response.tool_uses.length > 0) {
            const blocks: any[] = [];
            if (Array.isArray(response.content)) blocks.push(...response.content);
            else if (response.content) blocks.push({ type: 'text', text: response.content });
            for (const tool of response.tool_uses) blocks.push({ type: 'tool_use', ...tool });
            finalContent = blocks;
        }

        this.messages.push({ role: "assistant", content: finalContent });
        return new MarieResponse(finalContent);
    }
}
