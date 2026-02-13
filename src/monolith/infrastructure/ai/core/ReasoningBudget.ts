/**
 * REASONING BUDGET - Clean Fix Pattern
 * 
 * Principles:
 * 1. Unlimited internal reasoning depth
 * 2. Hard output schema enforcement
 * 3. Max 3 self-reflection iterations
 * 4. Separate thinking from acting
 */

export interface ReasoningIteration {
    iteration: number;
    thought: string;
    proposedAction?: string;
}

export interface ReasoningResult {
    iterations: ReasoningIteration[];
    finalOutput: unknown;
    schemaValidated: boolean;
    actionFrozen: boolean;
}

export class ReasoningBudget {
    private iterations: ReasoningIteration[] = [];
    private static readonly MAX_SELF_REFLECTIONS = 3;
    private actionFrozen = false;

    /**
     * Add a reasoning iteration.
     * Returns false if max iterations reached.
     */
    public think(thought: string, proposedAction?: string): boolean {
        if (this.iterations.length >= ReasoningBudget.MAX_SELF_REFLECTIONS) {
            return false;
        }

        this.iterations.push({
            iteration: this.iterations.length + 1,
            thought,
            proposedAction
        });

        return true;
    }

    /**
     * Freeze the proposed action.
     * No more mutations allowed after this.
     */
    public freezeAction(): void {
        this.actionFrozen = true;
    }

    /**
     * Check if action is frozen (thinking phase complete).
     */
    public isActionFrozen(): boolean {
        return this.actionFrozen;
    }

    /**
     * Validate output against expected schema.
     * If invalid, reject - no negotiation.
     */
    public validateOutput<T>(output: unknown, validator: (o: unknown) => o is T): output is T {
        return validator(output);
    }

    /**
     * Get all reasoning iterations for logging/debugging.
     */
    public getIterations(): ReadonlyArray<ReasoningIteration> {
        return this.iterations;
    }

    /**
     * Get current iteration count.
     */
    public getIterationCount(): number {
        return this.iterations.length;
    }

    /**
     * Check if budget is exhausted.
     */
    public isExhausted(): boolean {
        return this.iterations.length >= ReasoningBudget.MAX_SELF_REFLECTIONS;
    }

    /**
     * Produce final result with schema validation.
     */
    public produceResult<T>(
        output: unknown,
        validator: (o: unknown) => o is T
    ): ReasoningResult {
        const schemaValidated = this.validateOutput(output, validator);

        return {
            iterations: this.iterations,
            finalOutput: output,
            schemaValidated,
            actionFrozen: this.actionFrozen
        };
    }

    /**
     * Reset for new reasoning session.
     */
    public reset(): void {
        this.iterations = [];
        this.actionFrozen = false;
    }
}

/**
 * Schema validators for common outputs.
 */
export const SchemaValidators = {
    /**
     * Validate tool call schema.
     */
    isToolCall: (o: unknown): o is { name: string; input: Record<string, unknown> } => {
        if (typeof o !== 'object' || o === null) return false;
        const obj = o as Record<string, unknown>;
        return typeof obj.name === 'string' &&
            typeof obj.input === 'object' &&
            obj.input !== null;
    },

    /**
     * Validate patch proposal schema.
     */
    isPatchProposal: (o: unknown): o is {
        targetFile: string;
        operation: 'write' | 'replace' | 'delete';
        content?: string;
        reason: string;
    } => {
        if (typeof o !== 'object' || o === null) return false;
        const obj = o as Record<string, unknown>;
        return typeof obj.targetFile === 'string' &&
            ['write', 'replace', 'delete'].includes(obj.operation as string) &&
            typeof obj.reason === 'string';
    },

    /**
     * Validate analysis result schema.
     */
    isAnalysisResult: (o: unknown): o is {
        findings: string[];
        recommendations: string[];
        confidence: number;
    } => {
        if (typeof o !== 'object' || o === null) return false;
        const obj = o as Record<string, unknown>;
        return Array.isArray(obj.findings) &&
            Array.isArray(obj.recommendations) &&
            typeof obj.confidence === 'number';
    }
};
