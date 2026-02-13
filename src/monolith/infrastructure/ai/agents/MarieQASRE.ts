import { AIProvider } from "../providers/AIProvider.js";
import { MARIE_QA_SRE_SYSTEM_PROMPT } from "../../../../prompts.js";
import { ConfigService } from "../../config/ConfigService.js";
import { MarieResponse } from "../core/MarieResponse.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { AIStreamEvent } from "../providers/AIProvider.js";

export class MarieQASRE {
    constructor(
        private provider: AIProvider,
        private council: MarieCouncil
    ) { }

    /**
     * Performs a Quality Assurance + Sanity Regression Evaluation on recent changes.
     * Flags concrete risks and suggests at most 2 fixes.
     */
    public async evaluate(messages: any[], councilContext: string): Promise<string> {
        try {
            const contextPrompt = `\n\n[STRICT PROTOCOL: QASRE]\nCONTEXT FROM COUNCIL:\n${councilContext}\n\nAnalyze the recent changes. YOU MUST:\n1. Identify CONCRETE RISKS only.\n2. Suggest AT MOST 2 low-risk fixes.\n3. Be extremely concise. TERMINATE immediately after the suggestions.`;

            const providerResponse = await this.provider.createMessage({
                model: ConfigService.getModel(),
                system: MARIE_QA_SRE_SYSTEM_PROMPT,
                messages: [
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: contextPrompt }
                ],
                max_tokens: 1024,
            });

            const text = MarieResponse.wrap(providerResponse.content).getText();

            // Phase 20: Fix Extraction
            this.extractFixesToBlackboard(text);

            return text.substring(0, 800); // Guard against runaway responses
        } catch (error) {
            console.error("MarieQASRE evaluation error", error);
            return "Error during QA evaluation. Proceed with caution.";
        }
    }

    /**
     * Pilot path for isolated token-stream execution.
     * Uses the provider's streaming API with an independent abort signal and event hook.
     */
    public async evaluateIsolatedStream(
        messages: any[],
        councilContext: string,
        signal?: AbortSignal,
        onUpdate?: (event: AIStreamEvent) => void
    ): Promise<string> {
        try {
            const contextPrompt = `\n\n[STRICT PROTOCOL: QASRE]\nCONTEXT FROM COUNCIL:\n${councilContext}\n\nAnalyze the recent changes. YOU MUST:\n1. Identify CONCRETE RISKS only.\n2. Suggest AT MOST 2 low-risk fixes.\n3. Be extremely concise. TERMINATE immediately after the suggestions.`;

            const providerResponse = await this.provider.createMessageStream({
                model: ConfigService.getModel(),
                system: MARIE_QA_SRE_SYSTEM_PROMPT,
                messages: [
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: contextPrompt }
                ],
                max_tokens: 1024,
            }, (event) => {
                onUpdate?.(event);
            }, signal);

            const text = MarieResponse.wrap(providerResponse.content).getText();
            this.extractFixesToBlackboard(text);
            return text.substring(0, 800);
        } catch (error) {
            console.error("MarieQASRE isolated stream evaluation error", error);
            return "Error during isolated QA stream evaluation. Proceed with caution.";
        }
    }

    /**
     * Parses the AI response for suggested fixes and saves them to the council blackboard.
     */
    private extractFixesToBlackboard(text: string) {
        // Look for pattern: FIX: [Description] (FILE: path)
        const fixRegex = /FIX:\s*(.*?)\s*\(FILE:\s*(.*?)\)/gi;
        let match;
        while ((match = fixRegex.exec(text)) !== null) {
            const description = match[1].trim();
            const filePath = match[2].trim();
            this.council.blackboard.write(`fix:${filePath}`, description);
        }
    }
}
