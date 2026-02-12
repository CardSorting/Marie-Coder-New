import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from "../../config/ConfigService.js";
import { SUMMARIZATION_SYSTEM_PROMPT, SUMMARIZATION_USER_PROMPT } from "../../../prompts.js";
import { AIProvider } from "../providers/AIProvider.js";
import { getErrorMessage } from "../../../plumbing/utils/ErrorUtils.js";
import { StringUtils } from "../../../plumbing/utils/StringUtils.js";

export class ContextManager {
    private static estimateTokens(text: string, tokensPerChar: number): number {
        return Math.ceil(text.length * tokensPerChar);
    }

    /**
     * Recursively estimates tokens in an object without JSON.stringify serialization.
     * Prevents massive GC spikes for large objects (e.g. file content).
     */
    private static estimateObjectTokens(obj: any, tokensPerChar: number, depth: number = 0): number {
        if (!obj || depth > 10) return 0;
        if (typeof obj === 'string') return this.estimateTokens(obj, tokensPerChar);
        if (typeof obj === 'number' || typeof obj === 'boolean') return 1;

        let total = 0;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                total += this.estimateObjectTokens(item, tokensPerChar, depth + 1);
            }
        } else if (typeof obj === 'object') {
            for (const key in obj) {
                total += this.estimateTokens(key, tokensPerChar); // Key tokens
                total += this.estimateObjectTokens(obj[key], tokensPerChar, depth + 1); // Value tokens
            }
        }
        return total;
    }

    private static getMessageTokens(message: Anthropic.MessageParam, tokensPerChar: number): number {
        if (typeof message.content === 'string') {
            return this.estimateTokens(message.content, tokensPerChar);
        } else if (Array.isArray(message.content)) {
            return message.content.reduce((acc, block) => {
                if (block.type === 'text') {
                    return acc + this.estimateTokens(block.text, tokensPerChar);
                }
                if (block.type === 'tool_use') {
                    return acc + this.estimateObjectTokens(block.input, tokensPerChar, 0);
                }
                if (block.type === 'tool_result') {
                    // optimized: avoid JSON.stringify if content is string
                    if (typeof block.content === 'string') {
                        return acc + this.estimateTokens(block.content, tokensPerChar);
                    }
                    return acc + this.estimateObjectTokens(block.content, tokensPerChar, 0);
                }
                return acc;
            }, 0);
        }
        return 0;
    }

    private static getTotalTokens(messages: Anthropic.MessageParam[], tokensPerChar: number): number {
        return messages.reduce((acc, msg) => acc + this.getMessageTokens(msg, tokensPerChar), 0);
    }

    static async manage(
        messages: Anthropic.MessageParam[],
        provider: AIProvider,
        councilSnapshot?: {
            strategy: string; mood: string; flowState: number;
            errorHotspots: Record<string, number>;
            successStreak?: number;
            strategyTimeline?: Array<{ strategy: string, reason: string, ago: string }>;
            recoveryPatterns?: Array<{ failedTool: string, recoveryTool: string, count: number }>;
            sessionScore?: { score: number, grade: string };
            comboPeak?: number;
            moodHistory?: string[];
        }
    ): Promise<Anthropic.MessageParam[]> {
        const maxTokens = ConfigService.getMaxContextTokens();
        const tokensPerChar = ConfigService.getTokensPerChar(); // Hoisted config access
        const currentTokens = this.getTotalTokens(messages, tokensPerChar);

        // PROACTIVE PRUNING: Summarize at 90% capacity to ensure zero 400 errors
        if (currentTokens < maxTokens * 0.9) {
            return messages;
        }

        vscode.window.showInformationMessage(`Marie is tidying up conversation history (${currentTokens} tokens)...`);

        const keepRecent = ConfigService.getKeepRecentMessages();

        if (messages.length <= keepRecent) {
            return messages;
        }

        const olderMessages = messages.slice(0, messages.length - keepRecent);
        const recentMessages = messages.slice(messages.length - keepRecent);

        try {
            const summaryResponse = await provider.createMessage({
                model: ConfigService.getModel(),
                max_tokens: 1024,
                messages: olderMessages.concat({
                    role: "user",
                    content: SUMMARIZATION_USER_PROMPT
                }),
                system: SUMMARIZATION_SYSTEM_PROMPT
            });

            const summaryText = StringUtils.extractText(summaryResponse.content) || "Summary unavailable.";

            // Council Preservation: Prepend Council state to the summary so it survives compression
            let councilNote = '';
            if (councilSnapshot) {
                const hotspots = Object.entries(councilSnapshot.errorHotspots)
                    .filter(([_, c]) => c >= 2)
                    .map(([f, c]) => `${f}(${c}x)`)
                    .join(', ');

                // Extended preservation: timeline, streak, recovery patterns, session score
                const timeline = councilSnapshot.strategyTimeline?.slice(-2)
                    .map(s => `${s.strategy}(${s.ago})`).join('→') || '';
                const recoveries = councilSnapshot.recoveryPatterns
                    ?.map(r => `${r.failedTool}→${r.recoveryTool}`).join(', ') || '';
                const scoreStr = councilSnapshot.sessionScore
                    ? `, Session: ${councilSnapshot.sessionScore.grade}(${councilSnapshot.sessionScore.score})` : '';

                councilNote = `[COUNCIL STATE] Strategy: ${councilSnapshot.strategy}, Mood: ${councilSnapshot.mood}, Flow: ${councilSnapshot.flowState}/100, Streak: ${councilSnapshot.successStreak || 0}${scoreStr}${hotspots ? `, Hotspots: ${hotspots}` : ''}${timeline ? `, Timeline: ${timeline}` : ''}${recoveries ? `, Recoveries: ${recoveries}` : ''}\n\n`;
            }

            const newHistory: Anthropic.MessageParam[] = [
                {
                    role: "user",
                    content: `[System Note: Previous conversation summary]\n${councilNote}${summaryText}`
                },
                ...recentMessages
            ];

            vscode.window.showInformationMessage(`Marie finished tidying. Tokens reduced from ${currentTokens} to ${this.getTotalTokens(newHistory, tokensPerChar)}.`);
            return newHistory;

        } catch (error: unknown) {
            const message = getErrorMessage(error);
            console.error("Context summarization failed:", message);
            vscode.window.showErrorMessage(`Failed to summarize conversation: ${message}. Continuing with full history.`);
            return messages;
        }
    }
}
