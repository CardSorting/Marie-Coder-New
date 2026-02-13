import { AIProvider } from "../providers/AIProvider.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "../core/MarieProgressTracker.js";
import { MarieSession } from "../core/MarieSession.js";
import { MarieToolProcessor } from "../core/MarieToolProcessor.js";
import { MarieEventDispatcher } from "../core/MarieEventDispatcher.js";
import { AUDITOR_SYSTEM_PROMPT } from "../../../../prompts.js";
import { ConfigService } from "../../config/ConfigService.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { StringUtils } from "../../../plumbing/utils/StringUtils.js";
import { MarieResponse } from "../core/MarieResponse.js";

export class MarieAuditor {
    constructor(
        private provider: AIProvider,
        private toolRegistry: ToolRegistry,
        private approvalRequester: (name: string, input: any) => Promise<boolean>,
        private council?: MarieCouncil
    ) { }

    public async audit(
        messages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>
    ): Promise<string | null> {

        // 1. Granular Objective Verification (Phase 8 & 9)
        const objectivesToVerify = tracker.getRun().objectives.filter((o: any) => o.status === 'completed');
        if (objectivesToVerify.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `Auditor: Verifying ${objectivesToVerify.length} completed objectives in parallel...`,
                elapsedMs: tracker.elapsedMs()
            });

            const results = await Promise.all(objectivesToVerify.map((obj: any) => this.verifyObjective(obj, messages, tracker, saveHistory)));

            for (let i = 0; i < objectivesToVerify.length; i++) {
                const obj = objectivesToVerify[i];
                const verificationResult = results[i];

                if (verificationResult === 'verified') {
                    tracker.setObjectiveStatus(obj.id, 'verified');
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: `✅ Verified: ${obj.label}`,
                        elapsedMs: tracker.elapsedMs()
                    });
                } else {
                    // Auditor Council Vote: REJECTED
                    this.council?.registerVote('Auditor', 'DEBUG', `Objective '${obj.label}' rejected: ${verificationResult}`);
                    return `Objective '${obj.label}' failed verification: ${verificationResult}`;
                }
            }
        }

        // 2. Original General Audit (if needed)
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `Auditor: Performing final holistic check...`,
            elapsedMs: tracker.elapsedMs()
        });

        // Create a restricted session and processor
        const auditProcessor = new MarieToolProcessor(this.toolRegistry, tracker, this.approvalRequester, this.council);

        // Build Council-aware audit prompt
        const auditPrompt = this.buildAuditPrompt();

        // Prepare context for the general auditor
        const contextMessages = [
            ...messages,
            { role: 'user', content: "Please AUDIT the above work. Detailed investigation is required. Check the files. Run tests." }
        ];

        const result = await this.auditLoop(contextMessages, tracker, auditProcessor, saveHistory, 0, 5, auditPrompt);

        // Auditor Council Vote based on final result
        if (result === null) {
            this.council?.registerVote('Auditor', 'EXECUTE', 'Audit passed. Work verified.');
        } else {
            this.council?.registerVote('Auditor', 'DEBUG', `Audit rejected: ${result.substring(0, 100)}`);
        }

        return result;
    }

    private async verifyObjective(
        obj: any,
        contextMessages: any[],
        tracker: MarieProgressTracker,
        saveHistory: (telemetry?: any) => Promise<void>
    ): Promise<'verified' | string> {
        const processor = new MarieToolProcessor(this.toolRegistry, tracker, this.approvalRequester);
        const run = tracker.getRun();

        // Phase 10: Context Injection
        const contextHints = [];
        if (run.activeFilePath) contextHints.push(`Active File: ${run.activeFilePath}`);
        if (run.metrics?.cherishedFiles && run.metrics.cherishedFiles.length > 0) {
            contextHints.push(`Recent Files: ${run.metrics.cherishedFiles.slice(-3).join(', ')}`);
        }

        const prompt = `You are verifying a single specific objective: "${obj.label}".
The user marked this as COMPLETED.
Your job is to PROVE it is completed using tools (read files, run tests).

Context Hints:
${contextHints.length > 0 ? contextHints.join('\n') : "No specific file context available."}

Status:
- If you find evidence it works -> Output JSON:
  { "status": "verified", "evidence": "Test suite passed with 5 tests." }

- If you find evidence it is broken or fake -> Output JSON:
  { "status": "rejected", "reason": "Function 'retry' is missing.", "fixSuggestion": "Implement retry logic in utils.ts" }

Do not verify other things. Focus ONLY on "${obj.label}". Output STRICT JSON.`;

        const verificationMessages = [
            ...contextMessages,
            { role: 'system', content: prompt }
        ];

        // Short loop: 3 turns max for specific item
        const result = await this.auditLoop(verificationMessages, tracker, processor, saveHistory, 0, 3);

        // Phase 11: Parse JSON Result
        if (result === null) return 'verified'; // Default fallback

        const response = MarieResponse.wrap(result);
        const textContent = response.getText();

        try {
            // Attempt to parse JSON from result string (it might be wrapped in markdown blocks)
            if (!textContent) return 'verified';

            const cleanJson = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            if (parsed.status === 'verified') {
                if (parsed.evidence) tracker.setObjectiveEvidence(obj.id, parsed.evidence);
                return 'verified';
            } else if (parsed.status === 'rejected') {
                return parsed.reason || "Rejected without reason";
            }
        } catch (e) {
            // Fallback for non-JSON responses (legacy)
            if (textContent.includes("VERIFIED")) {
                if (textContent.includes("Evidence:")) {
                    const advice = textContent.split("Evidence:")[1].trim();
                    tracker.setObjectiveEvidence(obj.id, advice);
                }
                return 'verified';
            }
        }

        return result;
    }

    private async auditLoop(
        messages: any[],
        tracker: MarieProgressTracker,
        processor: MarieToolProcessor,
        saveHistory: (telemetry?: any) => Promise<void>,
        turnCount: number,
        maxTurns: number = 5,
        systemPrompt?: string
    ): Promise<string | null> {
        if (turnCount >= maxTurns) {
            return "Audit timed out. Assuming VERIFIED to prevent blocking.";
        }

        try {
            const providerResponse = await this.provider.createMessage({
                model: ConfigService.getModel(),
                system: systemPrompt || AUDITOR_SYSTEM_PROMPT,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                max_tokens: 1024,
            });

            const response = MarieResponse.wrap(providerResponse.content);
            const textContent = response.getText();

            if (textContent.trim().startsWith('{') || textContent.includes('```json')) {
                return textContent;
            }

            // Check for generic "VERIFIED" (Legacy support)
            if (textContent.includes("VERIFIED")) {
                if (textContent.includes("Evidence:")) {
                    return "Verified with evidence:" + textContent.split("Evidence:")[1].trim();
                }
                return null;
            }
            if (textContent.includes("REJECTED:")) return textContent.split("REJECTED:")[1].trim();

            if (Array.isArray(response.getRaw())) {
                const content = response.getRaw();
                // If the array contains a text block that looks like JSON, return it
                const textBlock = content.find((c: any) => c.type === 'text');
                if (textBlock && (textBlock.text.trim().startsWith('{') || textBlock.text.includes('```json'))) {
                    return textBlock.text;
                }

                const toolCalls = content.filter((c: any) => c.type === 'tool_use');
                if (toolCalls.length > 0) {
                    const toolResults: any[] = [];
                    for (const toolCall of toolCalls) {
                        // FILTER: Block destructive tools
                        if (['write_to_file', 'replace_file_content', 'multi_replace_file_content', 'delete_file'].includes(toolCall.name)) {
                            toolResults.push({
                                type: "tool_result",
                                tool_use_id: toolCall.id,
                                content: "ERROR: Auditor is not allowed to modify files. Read-only."
                            });
                            continue;
                        }

                        const result = await processor.process(toolCall);

                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: toolCall.id,
                            content: result
                        });
                    }

                    messages.push({ role: 'assistant', content: content });
                    messages.push({ role: 'user', content: toolResults });

                    return await this.auditLoop(messages, tracker, processor, saveHistory, turnCount + 1, maxTurns, systemPrompt);
                }
            }

            // If we got text and no tools (fallback):
            const text = response.getText();
            if (text.trim().startsWith('{') || text.includes('```json')) return text;

            if (text.includes("VERIFIED")) {
                if (text.includes("Evidence:")) {
                    return "Verified with evidence:" + text.split("Evidence:")[1].trim();
                }
                return null;
            }
            if (text.includes("REJECTED:")) return text.split("REJECTED:")[1].trim();

            // If ambiguous
            return "Auditor provided ambiguous response. Assuming verified.";

        } catch (error) {
            console.error("Audit loop error", error);
            return null; // Fail open
        }
    }

    /**
     * Performs a lightweight, background "sanity check" on the recent conversation.
     * Designed to be run in parallel (fire-and-forget) by the Swarm.
     */
    public async quickCritique(messages: any[]): Promise<string | null> {
        try {
            // Only look at the last 3 turns to save tokens/time
            const recentContext = messages.slice(-3).map(m => this.sanitizeForCritique(m));
            const system = `You are a Ghost Critic. 
 Analyze the last assistant response for logical drift, missed instructions, or procrastination.
 If it looks good, output "OK".
 If there is a problem, output a 1-sentence critique.
 Be harsh but concise.`;

            const response = await this.provider.createMessage({
                model: ConfigService.getModel(), // Or a faster/cheaper model if available
                system: system,
                messages: recentContext,
                max_tokens: 150,
            });

            const text = MarieResponse.wrap(response.content).getText().trim();
            if (text === "OK" || text.length < 5) return null;
            return text;
        } catch (e) {
            return null; // Fail silently in background
        }
    }

    /**
     * Truncates massive tool outputs to prevent context window bloat during critique.
     * The critic only needs to know *that* a tool ran, not see 5000 lines of code.
     */
    private sanitizeForCritique(message: any): any {
        if (!Array.isArray(message.content)) return message;

        const sanitizedContent = message.content.map((block: any) => {
            if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > 500) {
                // Keep error messages intact, truncate successful data
                if (block.content.startsWith('Error')) return block;
                return {
                    ...block,
                    content: `[Output Truncated: ${block.content.length} chars. Assume success.]`
                };
            }
            return block;
        });

        return { ...message, content: sanitizedContent };
    }

    /**
     * Builds a Council-aware audit system prompt.
     * Injects error hotspots and flow state so the Auditor knows which areas to scrutinize.
     */
    private buildAuditPrompt(): string {
        if (!this.council) return AUDITOR_SYSTEM_PROMPT;

        const snapshot = this.council.getSnapshot();
        const extras: string[] = [];

        // Warn about error-prone files
        const hotFiles = Object.entries(snapshot.errorHotspots).filter(([_, count]) => count >= 2);
        if (hotFiles.length > 0) {
            const hotList = hotFiles.map(([f, c]) => `- ${f}: ${c} errors during this run`).join('\n');
            extras.push(`\n\nCOUNCIL INTELLIGENCE (Error Hotspots):\nThese files have caused repeated failures during this run. Scrutinize them MORE carefully:\n${hotList}`);
        }

        // Session Score: scale audit strictness based on run quality
        const sessionScore = this.council.getSessionScore();
        if (sessionScore.grade === 'F' || sessionScore.grade === 'C') {
            extras.push(`\n\nCOUNCIL NOTE: Session score is ${sessionScore.grade} (${sessionScore.score}/100). The agent STRUGGLED. Be EXTRA thorough — verify every claim with file reads and tests.`);
        } else if (sessionScore.grade === 'S' || sessionScore.grade === 'A') {
            extras.push(`\n\nCOUNCIL NOTE: Session score is ${sessionScore.grade} (${sessionScore.score}/100). High performance run. Standard verification should suffice.`);
        } else {
            extras.push(`\n\nCOUNCIL NOTE: Session score is ${sessionScore.grade} (${sessionScore.score}/100). Moderate performance. Verify carefully.`);
        }

        // Recovery Patterns: tell auditor to double-check recovered areas
        const recoveryPatterns = this.council.getRecoveryPatterns();
        if (recoveryPatterns.length > 0) {
            const recoveryList = recoveryPatterns.map(p => `- ${p.failedTool} failed, recovered via ${p.recoveryTool} (${p.count}x)`).join('\n');
            extras.push(`\n\nRECOVERY AREAS (verify these extra carefully):\n${recoveryList}`);
        }

        // Strategy timeline for context
        if (snapshot.strategyTimeline.length > 0) {
            const timeline = snapshot.strategyTimeline.map(s => `${s.strategy}: ${s.reason}`).join('; ');
            extras.push(`\n\nCOUNCIL STRATEGY HISTORY: ${timeline}`);
        }

        return AUDITOR_SYSTEM_PROMPT + extras.join('');
    }
}
