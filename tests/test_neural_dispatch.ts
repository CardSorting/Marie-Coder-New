import * as assert from 'assert';
import { MarieEngine } from '../src/monolith/infrastructure/ai/core/MarieEngine';
import { MarieProgressTracker } from '../src/monolith/infrastructure/ai/core/MarieProgressTracker';
import { AIProvider, AIStreamEvent } from '../src/monolith/infrastructure/ai/providers/AIProvider';
import { ToolRegistry } from '../src/monolith/infrastructure/tools/ToolRegistry';

class MockStreamingProvider implements Partial<AIProvider> {
    public createMessageStream(params: any, onUpdate: (event: AIStreamEvent) => void): Promise<any> {
        return (async () => {
            // Simulating a stream that yields a tool call delta by delta
            onUpdate({ type: 'content_delta', text: 'I will read the file now.' });
            await new Promise(r => setTimeout(r, 10));

            onUpdate({
                type: 'tool_call_delta',
                index: 0,
                id: 'call_1',
                name: 'read_file'
            });

            onUpdate({
                type: 'tool_call_delta',
                index: 0,
                argumentsDelta: '{"path": "te'
            });
            await new Promise(r => setTimeout(r, 50)); // Slow cadence should trigger hesitation

            onUpdate({
                type: 'tool_call_delta',
                index: 0,
                argumentsDelta: 'st.ts"}'
            });

            // Wait a bit to ensure engine had time to process the completed JSON
            await new Promise(r => setTimeout(r, 100));

            return { content: [], role: 'assistant' } as any;
        })();
    }

    estimateTokens(text: string) { return 0; }
    async listModels() { return []; }
    async createMessage() { return {} as any; }
}

async function testNeuralDispatch() {
    console.log('🧪 STRESS TEST: Neural Streaming Dispatch...');

    const registry = new ToolRegistry();
    let toolExecuted = false;

    registry.register({
        name: 'read_file',
        description: 'Read a file',
        input_schema: { type: 'object' } as any,
        execute: async (input: any) => {
            console.log(`📡 REAL-TIME EXECUTION DETECTED: read_file(${input.path})`);
            toolExecuted = true;
            return 'File content';
        }
    });

    const provider = new MockStreamingProvider() as any;
    const engine = new MarieEngine(provider, registry, async () => true);

    const mockRun: any = {
        runId: 'test-run',
        status: 'running',
        steps: 0,
        startedAt: Date.now(),
        objectives: [],
        achieved: [],
        isResuming: false,
        activeFilePath: 'test.ts',
        usage: {}
    };

    const tracker = new MarieProgressTracker(undefined, mockRun);

    console.log('🚀 Starting chatLoop...');
    await engine.chatLoop([], tracker, async () => { });

    if (!toolExecuted) {
        throw new Error('❌ Test Failed: tool was not executed during stream!');
    }

    console.log('✅ Neural Dispatch Test Passed!');
}

testNeuralDispatch().catch(err => {
    console.error(err);
    process.exit(1);
});
