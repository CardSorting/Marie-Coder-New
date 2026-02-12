import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { AIProvider, AIRequestParams, AIResponse, AIStreamEvent } from "./AIProvider.js";
import { ConfigService } from "../../config/ConfigService.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";
import { getErrorMessage } from "../../../plumbing/utils/ErrorUtils.js";

export class CerebrasProvider implements AIProvider {
    private client: Cerebras;

    constructor(apiKey: string) {
        this.client = new Cerebras({ apiKey });
    }

    async createMessage(params: AIRequestParams): Promise<AIResponse> {
        try {
            const response = await this.client.chat.completions.create({
                model: params.model,
                messages: this.convertMessages(params.messages),
                tools: this.convertTools(params.tools),
                max_tokens: params.max_tokens || 1024,
            });

            const completion = response as any;
            const choice = completion.choices[0].message;

            if (choice.tool_calls && choice.tool_calls.length > 0) {
                return {
                    role: "assistant",
                    content: choice.content || "",
                    tool_uses: choice.tool_calls.map((tc: any) => ({
                        id: tc.id,
                        name: tc.function.name,
                        input: JsonUtils.safeParseJson(tc.function.arguments),
                    })),
                };
            }

            return {
                role: "assistant",
                content: choice.content || "",
            };
        } catch (error) {
            throw new Error(`Cerebras API Error: ${getErrorMessage(error)}`);
        }
    }

    async createMessageStream(params: AIRequestParams, onUpdate: (event: AIStreamEvent) => void, signal?: AbortSignal): Promise<AIResponse> {
        const startTime = Date.now();
        onUpdate({ type: "run_started", timestamp: startTime });
        onUpdate({ type: "stage_change", stage: "thinking", label: "Processing request..." });

        try {
            // Cerebras SDK does not natively support AbortSignal in the create method yet, 
            // but we can handle the stream consumption loop and break if aborted.
            const stream = await this.client.chat.completions.create({
                model: params.model,
                messages: this.convertMessages(params.messages),
                tools: this.convertTools(params.tools),
                max_tokens: params.max_tokens || 1024,
                stream: true,
            }, { abortSignal: signal } as any);

            // Use array buffers to avoid string concatenation overhead
            const contentBuffer: string[] = [];
            const toolCalls: Record<number, { id: string; name: string; inputParts: string[] }> = {};
            let hasStartedContent = false;

            for await (const chunk of stream) {
                if (signal?.aborted) {
                    throw new Error("Cerebras request aborted by user.");
                }

                const chunkData = chunk as any;
                const delta = chunkData.choices[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                    if (!hasStartedContent) {
                        hasStartedContent = true;
                        onUpdate({ type: "stage_change", stage: "responding", label: "Generating response..." });
                    }
                    contentBuffer.push(delta.content);
                    onUpdate({ type: "content_delta", text: delta.content });
                }

                if (delta.tool_calls) {
                    onUpdate({ type: "stage_change", stage: "calling_tool", label: "Using tool..." });
                    for (const tc of delta.tool_calls) {
                        const index = tc.index;
                        if (tc.id) {
                            toolCalls[index] = {
                                id: tc.id,
                                name: tc.function?.name || "",
                                inputParts: [],
                            };
                            onUpdate({
                                type: "tool_call_delta",
                                index: index,
                                id: tc.id,
                                name: tc.function?.name,
                            });
                        }

                        if (tc.function?.arguments) {
                            if (toolCalls[index]) {
                                toolCalls[index].inputParts.push(tc.function.arguments);
                            }
                            onUpdate({
                                type: "tool_call_delta",
                                index: index,
                                argumentsDelta: tc.function.arguments,
                            });
                        }
                    }
                }

                if (chunk.usage) {
                    const usage = (chunk as any).usage;
                    onUpdate({
                        type: "usage",
                        usage: {
                            inputTokens: usage.prompt_tokens,
                            outputTokens: usage.completion_tokens,
                            totalTokens: usage.total_tokens,
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

            const blocks: any[] = [];
            if (fullContent) blocks.push({ type: 'text', text: fullContent });

            return {
                role: "assistant",
                content: blocks.length > 0 ? blocks : fullContent,
                tool_uses: finalToolUses.length > 0 ? finalToolUses : undefined,
            };

        } catch (error) {
            throw new Error(`Cerebras Stream Error: ${getErrorMessage(error)}`);
        }
    }

    estimateTokens(text: string): number {
        return Math.ceil(text.length * ConfigService.getTokensPerChar());
    }

    async listModels(): Promise<{ id: string, name: string }[]> {
        // Hardcoded list for now as Cerebras is compatible with Llama models
        return [
            { id: "llama3.1-8b", name: "Llama 3.1 8B" },
            { id: "llama3.1-70b", name: "Llama 3.1 70B" },
        ];
    }

    private convertMessages(messages: any[]): any[] {
        // Convert Anthropic-style messages to OpenAI/Cerebras format
        return messages.map(msg => {
            if (Array.isArray(msg.content)) {
                // Handle tools/text blocks
                const content = msg.content.map((block: any) => {
                    if (block.type === 'text') return { type: 'text', text: block.text };
                    // ... other block conversions if necessary, Cerebras expects standard OpenAI format usually
                    return block;
                });
                // Simplification: join text parts if valid
                const textParts = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');

                // Check for tool result
                const toolResult = msg.content.find((c: any) => c.type === 'tool_result');
                if (toolResult) {
                    return {
                        role: 'tool',
                        tool_call_id: toolResult.tool_use_id,
                        content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content)
                    };
                }

                return { role: msg.role, content: textParts };
            }
            return { role: msg.role, content: msg.content };
        });
    }

    private convertTools(tools?: any[]): any[] | undefined {
        if (!tools) return undefined;
        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema
            }
        }));
    }
}
