import { MarieResponse } from "./src/monolith/infrastructure/ai/MarieResponse";
import { MarieToolProcessor } from "./src/monolith/infrastructure/ai/MarieToolProcessor";

// Simplified Tool Registry Mock
const mockToolRegistry = {
    getTool: (name: string) => {
        if (name === 'write_to_file') {
            return {
                name: 'write_to_file',
                input_schema: {
                    type: 'object',
                    properties: {
                        TargetFile: { type: 'string' },
                        CodeContent: { type: 'string' },
                        Overwrite: { type: 'boolean' }
                    },
                    required: ['TargetFile', 'CodeContent', 'Overwrite']
                }
            };
        }
        return null;
    }
} as any;

// Simplified Tracker Mock
const mockTracker = {
    recordHeuristicFix: () => { },
    emitEvent: () => { },
    recordToolUsage: () => { },
    elapsedMs: () => 0,
    getRun: () => ({ runId: 'test-run', metrics: { cherishedFiles: [], releasedDebtCount: 0 } }),
    emitProgressUpdate: () => { }
} as any;

async function testPhase4() {
    console.log("🚀 Starting Phase 4 Verification...");

    // 1. Test MarieResponse.getReasoning()
    const structuredContent = [
        { type: 'thought', text: 'I should analyze the file first.' },
        { type: 'text', text: 'Here is the analysis.' }
    ];
    // Correctly call constructor with 1 argument
    const response = new MarieResponse(structuredContent as any);
    const reasoning = response.getReasoning();
    console.log(`MarieResponse - getReasoning(): "${reasoning}" (Expected: "I should analyze the file first.")`);
    if (reasoning !== "I should analyze the file first.") throw new Error("Reasoning extraction failed");

    // 2. Test MarieToolProcessor validation
    // Correctly call constructor with 3 arguments
    const processor = new MarieToolProcessor(
        mockToolRegistry,
        mockTracker,
        async () => true // approvalRequester
    );

    // Test valid input (validate is private, using any cast to access)
    const validResult = (processor as any).validate('write_to_file', { TargetFile: 'test.ts', CodeContent: 'hello', Overwrite: true });
    console.log(`ToolProcessor - Valid validation: ${validResult === null ? 'PASSED' : 'FAILED (' + validResult + ')'}`);
    if (validResult !== null) throw new Error("Valid tool rejected");

    // Test missing required field
    const invalidResult = (processor as any).validate('write_to_file', { TargetFile: 'test.ts', CodeContent: 'hello' });
    console.log(`ToolProcessor - Invalid validation (missing Overwrite): "${invalidResult}" (Expected: "Missing required fields: Overwrite")`);
    if (!invalidResult || !invalidResult.includes('Overwrite')) throw new Error("Invalid tool accepted or wrong error message");

    console.log("✅ Phase 4 Verification PASSED!");
}

testPhase4().catch(e => {
    console.error("❌ Phase 4 Verification FAILED!");
    console.error(e);
    process.exit(1);
});
