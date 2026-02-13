import { StringUtils } from "../../../plumbing/utils/StringUtils.js";

/**
 * Normalizes AI message content (string | block[]) into a stable interface.
 * This prevents TypeError breakdowns like "e.trim is not a function".
 */
export class MarieResponse {
    private readonly content: any;
    private readonly cachedText: string;

    constructor(content: any) {
        this.content = content;
        this.cachedText = StringUtils.extractText(content);
    }

    /**
     * Returns the full text content as a single string.
     */
    public getText(): string {
        return this.cachedText;
    }

    /**
     * Returns the text trimmed for one-liners or headers.
     */
    public getTrimmed(): string {
        return this.cachedText.trim();
    }

    /**
     * Returns the raw content (string or block array).
     */
    public getRaw(): any {
        return this.content;
    }

    /**
     * Extracts tool calls from the response if they exist.
     */
    public hasText(): boolean {
        return this.getText().length > 0;
    }

    public isShaky(): boolean {
        const text = this.getTrimmed();
        const reasoning = this.getReasoning();
        // A response is shaky if it's dead empty and has no reasoning or tools
        if (text.length === 0 && reasoning.length === 0 && !this.hasToolCalls()) return true;

        // Short text is shaky ONLY if there's also no reasoning and no tools
        return text.length < 10 && reasoning.length < 10 && !this.hasToolCalls();
    }

    public getReasoning(): string {
        if (!Array.isArray(this.content)) return '';
        let reasoning = '';
        const blocks = this.content as any[];
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (block && (block.type === 'thought' || block.type === 'reasoning')) {
                const text = block.text || block.reasoning || '';
                if (reasoning) reasoning += '\n' + text;
                else reasoning = text;
            }
        }
        return reasoning;
    }

    public getTools(name?: string): any[] {
        const tools = this.getToolCalls();
        if (name) {
            return tools.filter(t => t.name === name);
        }
        return tools;
    }

    public getToolCalls(): any[] {
        if (!Array.isArray(this.content)) return [];
        const tools: any[] = [];
        const blocks = this.content as any[];
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].type === 'tool_use') {
                tools.push(blocks[i]);
            }
        }
        return tools;
    }

    /**
     * Checks if the response contains any tool calls.
     */
    public hasToolCalls(): boolean {
        if (!Array.isArray(this.content)) return false;
        for (let i = 0; i < this.content.length; i++) {
            if (this.content[i].type === 'tool_use') return true;
        }
        return false;
    }

    /**
     * Helper to wrap any possible AI message content safely.
     */
    public static wrap(content: any): MarieResponse {
        return new MarieResponse(content);
    }
}
