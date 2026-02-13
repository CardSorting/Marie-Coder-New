import { AIProvider } from "../providers/AIProvider.js";
import { MARIE_ISO_9001_SYSTEM_PROMPT } from "../../../../prompts.js";
import { ConfigService } from "../../config/ConfigService.js";
import { MarieResponse } from "../core/MarieResponse.js";

export class MarieISO9001 {
    constructor(private provider: AIProvider) { }

    /**
     * Determines whether the current work is release-stable enough to stop.
     * Identifies missing wiring, glue code, or blocking issues.
     */
    public async verifyReadiness(messages: any[], councilContext: string): Promise<string> {
        try {
            const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || "";
            const localAuditFlags = this.localAudit(lastUserMessage);
            const auditContext = localAuditFlags.length > 0 ? `\n[LOCAL AUDIT FLAGS]: ${localAuditFlags.join('; ')}` : "";

            const contextPrompt = `\n\n[STRICT PROTOCOL: ISO9001]\nREADINESS CONTEXT FROM COUNCIL:\n${councilContext}${auditContext}\n\nYOU MUST:\n1. Determine if the work is stable enough to stop (Stop Signal: YES/NO).\n2. Highlight build risks or missing glue code.\n3. If Stop Signal is YES, provide a short justification.`;

            const providerResponse = await this.provider.createMessage({
                model: ConfigService.getModel(),
                system: MARIE_ISO_9001_SYSTEM_PROMPT,
                messages: [
                    ...messages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: contextPrompt }
                ],
                max_tokens: 1024,
            });

            const text = MarieResponse.wrap(providerResponse.content).getText();
            return text.substring(0, 800); // Guard against runaway responses
        } catch (error) {
            console.error("MarieISO9001 verification error", error);
            return "Error during readiness verification. Build risk may be high.";
        }
    }

    /**
     * Performs a lightweight scan for obvious release blockers.
     */
    private localAudit(text: string): string[] {
        const flags: string[] = [];
        if (text.includes('TODO') || text.includes('FIXME')) flags.push("Unresolved TODO/FIXME detected");
        if (text.match(/\{[\s\n]*\}/)) flags.push("Empty code block detected");
        if (text.includes('// placeholder') || text.includes('/* placeholder */')) flags.push("Placeholder comment detected");
        return flags;
    }
}
