import Anthropic from "@anthropic-ai/sdk";
import { AIProvider, AIRequestParams, AIResponse, AIStreamEvent } from "./AIProvider.js";
import { ConfigService } from "../../config/ConfigService.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";

export class AnthropicProvider implements AIProvider {
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    async createMessage(params: AIRequestParams): Promise<AIResponse> {
        const response = await this.client.messages.create({
            model: params.model,
            max_tokens: params.max_tokens || 1024,
            system: params.system,
            messages: params.messages,
            tools: params.tools,
        });

        if (!response.content || response.content.length === 0) {
            throw new Error("Anthropic API returned an empty content array.");
        }

        const toolUses = response.content
            .filter(c => c.type === "tool_use")
            .map(c => ({
                id: c.id,
                name: c.name,
                input: c.input as Record<string, unknown>,
            }));

        return {
            role: "assistant",
            content: response.content,
            tool_uses: toolUses.length > 0 ? toolUses : undefined,
        };
    }

    async createMessageStream(params: AIRequestParams, onUpdate: (event: AIStreamEvent) => void, signal?: AbortSignal): Promise<AIResponse> {
        const startTime = Date.now();
        onUpdate({ type: "run_started", timestamp: startTime });
        onUpdate({ type: "stage_change", stage: "thinking", label: "Processing request..." });

        const stream = await this.client.messages.create({
            model: params.model,
            max_tokens: params.max_tokens || 1024,
            system: params.system,
            messages: params.messages,
            tools: params.tools,
            stream: true,
        }, { signal });

        // Use array buffers to avoid string concatenation overhead
        const contentBuffer: string[] = [];
        const toolCalls: Record<number, { id: string; name: string; inputParts: string[] }> = {};
        let hasStartedContent = false;

        for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                if (!hasStartedContent) {
                    hasStartedContent = true;
                    onUpdate({ type: "stage_change", stage: "responding", label: "Generating response..." });
                }
                const text = chunk.delta.text;
                contentBuffer.push(text);
                onUpdate({ type: "content_delta", text });
            } else if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
                onUpdate({ type: "stage_change", stage: "calling_tool", label: "Using tool..." });
                toolCalls[chunk.index] = {
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                    inputParts: [],
                };
                onUpdate({
                    type: "tool_call_delta",
                    index: chunk.index,
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                });
            } else if (chunk.type === "content_block_delta" && chunk.delta.type === "input_json_delta") {
                const toolCall = toolCalls[chunk.index];
                if (toolCall) {
                    toolCall.inputParts.push(chunk.delta.partial_json);
                    onUpdate({
                        type: "tool_call_delta",
                        index: chunk.index,
                        argumentsDelta: chunk.delta.partial_json,
                    });
                }
            } else if (chunk.type === "message_delta" && chunk.usage) {
                onUpdate({
                    type: "usage",
                    usage: {
                        inputTokens: chunk.usage.input_tokens ?? undefined,
                        outputTokens: chunk.usage.output_tokens ?? undefined,
                        totalTokens: (chunk.usage.input_tokens ?? 0) + (chunk.usage.output_tokens ?? 0),
                    }
                });
            }
        }

        const endTime = Date.now();
        onUpdate({ type: "run_completed", timestamp: endTime, durationMs: endTime - startTime });

        // Join array buffers into final strings
        const fullContent = contentBuffer.join('');
        const finalToolUses = Object.values(toolCalls).map(tc => ({
            id: tc.id,
            name: tc.name,
            input: JsonUtils.safeParseJson(tc.inputParts.join(''))
        }));

        return {
            role: "assistant",
            content: fullContent,
            tool_uses: finalToolUses.length > 0 ? finalToolUses : undefined,
        };
    }

    /**
     * Efficiently estimates tokens via character count.
     * Uses ConfigService.getTokensPerChar() (default 0.25 tokens/char).
     */
    estimateTokens(text: string): number {
        const tokensPerChar = ConfigService.getTokensPerChar();
        return Math.ceil(text.length * tokensPerChar);
    }

    async listModels(): Promise<{ id: string, name: string }[]> {
        return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
        ];
    }
}
