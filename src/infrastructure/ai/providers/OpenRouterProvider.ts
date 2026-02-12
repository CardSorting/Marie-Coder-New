import { AIProvider, AIRequestParams, AIResponse, AIStreamEvent } from "./AIProvider.js";
import { ConfigService } from "../../config/ConfigService.js";
import { getErrorMessage } from "../../../plumbing/utils/ErrorUtils.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";
import { OpenRouterStreamParser } from "./OpenRouterStreamParser.js";

interface OpenRouterMessage {
    role: string;
    content: string | null;
    tool_calls?: {
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }[];
    tool_call_id?: string;
}

interface OpenRouterResponse {
    choices: {
        message: {
            content: string | null;
            tool_calls?: {
                id: string;
                type: "function";
                function: {
                    name: string;
                    arguments: string;
                };
            }[];
        };
        delta: {
            content?: string;
            tool_calls?: {
                index: number;
                id?: string;
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }[];
        };
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        reasoning_tokens?: number;
    };
    error?: {
        message: string;
        code?: string;
    };
}

export class OpenRouterProvider implements AIProvider {
    private apiKey: string;
    private baseUrl = "https://openrouter.ai/api/v1";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async createMessage(params: AIRequestParams): Promise<AIResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "HTTP-Referer": "https://github.com/bozoegg/MarieCoder",
                "X-Title": "MarieCoder VS Code Extension",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                model: params.model,
                messages: this.getOpenAiMessages(params),
                tools: this.getOpenAiTools(params),
                max_tokens: params.max_tokens || 1024,
            })
        });

        if (!response.ok) {
            let errorMsg = `OpenRouter API error: ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json() as any;
                if (errorJson.error?.message) errorMsg = `OpenRouter API error: ${errorJson.error.message}`;
            } catch (e) {
                const text = await response.text().catch(() => "");
                if (text) errorMsg += ` - ${text}`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json() as OpenRouterResponse;
        if (!data.choices || data.choices.length === 0) throw new Error("OpenRouter API returned no choices.");

        const choice = data.choices[0].message;

        if (choice.tool_calls && choice.tool_calls.length > 0) {
            try {
                const toolUses = choice.tool_calls.map(tc => ({
                    id: tc.id,
                    name: tc.function.name,
                    input: JsonUtils.safeParseJson(tc.function.arguments),
                }));
                return {
                    role: "assistant",
                    content: choice.content || "",
                    tool_uses: toolUses,
                };
            } catch (error: unknown) {
                console.error("Failed to parse tool arguments from OpenRouter:", getErrorMessage(error));
                return {
                    role: "assistant",
                    content: choice.content || `(Message error: Malformed tool arguments)`,
                };
            }
        }

        return {
            role: "assistant",
            content: choice.content || "",
        };
    }

    async createMessageStream(params: AIRequestParams, onUpdate: (event: AIStreamEvent) => void, signal?: AbortSignal): Promise<AIResponse> {
        const controller = new AbortController();
        let isTimeout = false;
        const timeoutId = setTimeout(() => {
            isTimeout = true;
            controller.abort();
        }, 120000);

        let isUserAbort = false;
        const onAbort = () => {
            isUserAbort = true;
            controller.abort();
        };
        if (signal) signal.addEventListener('abort', onAbort);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "HTTP-Referer": "https://github.com/bozoegg/MarieCoder",
                    "X-Title": "MarieCoder VS Code Extension",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive"
                },
                body: JSON.stringify({
                    model: params.model,
                    messages: this.getOpenAiMessages(params),
                    tools: this.getOpenAiTools(params),
                    max_tokens: params.max_tokens || 1024,
                    stream: true,
                    include_reasoning: true
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            if (!response.body) throw new Error("OpenRouter API returned no body.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const contentParts: string[] = [];
            const reasoningParts: string[] = [];
            const bufferParts: string[] = [];
            let toolCalls: Record<number, { id: string; name: string; argumentsParts: string[] }> = {};
            const startTime = Date.now();

            onUpdate({ type: "run_started", timestamp: startTime });
            onUpdate({ type: "stage_change", stage: "thinking", label: "Processing request..." });

            const streamParser = new OpenRouterStreamParser();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    bufferParts.push(chunk);
                    const buffer = bufferParts.join('');
                    const lines = buffer.split('\n');
                    const remainder = lines.pop() || "";
                    bufferParts.length = 0;
                    if (remainder) bufferParts.push(remainder);

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine.startsWith(':')) continue;

                        if (trimmedLine.startsWith('data: ')) {
                            const dataStr = trimmedLine.slice(6);
                            if (dataStr === '[DONE]') continue;

                            try {
                                const data = JSON.parse(dataStr);
                                const choice = data.choices?.[0];
                                if (!choice) continue;

                                const delta = choice.delta;
                                if (delta?.content) {
                                    const events = streamParser.processContent(delta.content);
                                    for (const event of events) {
                                        if (event.type === 'content_delta') contentParts.push(event.text);
                                        if (event.type === 'reasoning_delta') reasoningParts.push(event.text);
                                        onUpdate(event);
                                    }
                                }

                                if (delta?.tool_calls) {
                                    onUpdate({ type: "stage_change", stage: "calling_tool", label: "Using tool..." });
                                    for (const tc of delta.tool_calls) {
                                        const idx = tc.index;
                                        if (!toolCalls[idx]) {
                                            toolCalls[idx] = { id: tc.id || "", name: tc.function?.name || "", argumentsParts: [] };
                                        } else {
                                            if (tc.id) toolCalls[idx].id = tc.id;
                                            if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                                        }
                                        if (tc.function?.arguments) {
                                            toolCalls[idx].argumentsParts.push(tc.function.arguments);
                                            onUpdate({ type: "tool_call_delta", index: idx, id: tc.id, name: tc.function?.name, argumentsDelta: tc.function.arguments });
                                        }
                                    }
                                }

                                if (data.usage) {
                                    onUpdate({
                                        type: "usage",
                                        usage: {
                                            inputTokens: data.usage.prompt_tokens,
                                            outputTokens: data.usage.completion_tokens,
                                            totalTokens: data.usage.total_tokens,
                                            reasoningTokens: data.usage.reasoning_tokens
                                        }
                                    });
                                }
                            } catch (e) { }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // Join all array buffers into final strings
            const fullContent = contentParts.join('');
            const fullReasoning = reasoningParts.join('');

            const finalEvents = streamParser.finalize(fullContent);
            for (const event of finalEvents) onUpdate(event);

            const endTime = Date.now();
            onUpdate({ type: "run_completed", timestamp: endTime, durationMs: endTime - startTime });

            const llamaCalls = streamParser.getCollectedToolCalls();
            for (const idx in llamaCalls) {
                const call = llamaCalls[idx];
                toolCalls[parseInt(idx) + 1000] = {
                    id: call.id,
                    name: call.name,
                    argumentsParts: [call.arguments] // Wrap string as array for consistency
                };
            }

            const finalToolUses: any[] = [];
            for (const idx in toolCalls) {
                const tc = toolCalls[idx];
                try {
                    const args = tc.argumentsParts.join('');
                    finalToolUses.push({ id: tc.id, name: tc.name, input: JsonUtils.safeParseJson(args) });
                } catch (e) { }
            }

            const blocks: any[] = [];
            if (fullReasoning) blocks.push({ type: 'thought', text: fullReasoning });
            if (fullContent) blocks.push({ type: 'text', text: fullContent });

            return {
                role: "assistant",
                content: blocks.length > 0 ? blocks : fullContent,
                tool_uses: finalToolUses.length > 0 ? finalToolUses : undefined
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Distinguish between user manual stop and actual timeout
                if (isUserAbort) {
                    throw new Error("Request stopped by user");
                } else if (isTimeout) {
                    throw new Error("OpenRouter timeout");
                } else {
                    throw new Error("Request aborted");
                }
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            if (signal) signal.removeEventListener('abort', onAbort);
        }
    }

    private getOpenAiMessages(params: AIRequestParams): OpenRouterMessage[] {
        const messages: OpenRouterMessage[] = [];
        if (params.system) messages.push({ role: "system", content: params.system });

        for (const msg of params.messages) {
            if (typeof msg.content === 'string') {
                messages.push({ role: msg.role, content: msg.content });
            } else if (Array.isArray(msg.content)) {
                let text = "";
                const tools: any[] = [];
                for (const block of msg.content) {
                    if (block.type === 'text') text += block.text;
                    else if (block.type === 'tool_use') tools.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) } });
                    else if (block.type === 'tool_result') {
                        messages.push({ role: "tool", tool_call_id: block.tool_use_id, content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content) } as any);
                    }
                }
                if (msg.role === 'assistant' && (text || tools.length > 0)) {
                    const m: any = { role: "assistant", content: text || null };
                    if (tools.length > 0) m.tool_calls = tools;
                    messages.push(m);
                } else if (msg.role === 'user' && text) {
                    messages.push({ role: "user", content: text });
                }
            }
        }
        return messages;
    }

    private getOpenAiTools(params: AIRequestParams) {
        if (!params.tools) return undefined;
        return params.tools.map(tool => ({
            type: "function",
            function: { name: tool.name, description: tool.description, parameters: tool.input_schema }
        }));
    }

    estimateTokens(text: string): number {
        return Math.ceil(text.length * ConfigService.getTokensPerChar());
    }

    async listModels(): Promise<{ id: string, name: string }[]> {
        return [
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' }
        ];
    }
}
