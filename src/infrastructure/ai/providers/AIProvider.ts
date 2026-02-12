import Anthropic from "@anthropic-ai/sdk";

export interface JsonObjectSchema {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
}

export interface AIProviderTool {
    name: string;
    description: string;
    input_schema: JsonObjectSchema;
}

export interface AIProvider {
    createMessage(params: AIRequestParams): Promise<AIResponse>;
    createMessageStream(params: AIRequestParams, onUpdate: (event: AIStreamEvent) => void, signal?: AbortSignal): Promise<AIResponse>;
    /**
     * Quickly estimate tokens based on character count (heuristic).
     * Not as accurate as a true tokenizer but avoids heavy dependencies.
     */
    estimateTokens(text: string): number;
    listModels(): Promise<{ id: string, name: string }[]>;
}

export interface AIRequestParams {
    model: string;
    system?: string;
    messages: Anthropic.MessageParam[];
    tools?: AIProviderTool[];
    max_tokens?: number;
}

export interface AIResponse {
    content: string | any[];
    role: "assistant";
    tool_uses?: ToolUse[];
}

export interface ToolUse {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export type AIStreamEvent =
    | { type: "content_delta"; text: string }
    | { type: "reasoning_delta"; text: string }
    | {
        type: "tool_call_delta";
        index: number;
        id?: string;
        name?: string;
        argumentsDelta?: string;
    }
    | {
        type: "usage";
        usage: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
            reasoningTokens?: number;
        };
    }
    | { type: "run_started"; timestamp: number }
    | { type: "run_completed"; timestamp: number; durationMs: number }
    | { type: "stage_change"; stage: string; label?: string };

