import * as assert from 'assert';
import { MarieEngine } from '../src/infrastructure/ai/core/MarieEngine';
import { MarieProgressTracker } from '../src/infrastructure/ai/core/MarieProgressTracker';
import { AIProvider, AIStreamEvent } from '../src/infrastructure/ai/providers/AIProvider';
import { ToolRegistry } from '../src/infrastructure/tools/ToolRegistry';

class MockOmniProvider implements Partial<AIProvider> {
    public createMessageStream(params: any, onUpdate: (event: AIStreamEvent) => void): Promise<any> {
        return (async () => {
            // 1. Tool A starts
            onUpdate({ type: 'tool_call_delta', index: 0, id: 'A', name: 'write_file' });
            onUpdate({ type: 'tool_call_delta', index: 0, argumentsDelta: '{"path": "file1.ts", "content": "A"}' });

            // 2. Tool B starts almost immediately (independent)
            onUpdate({ type: 'tool_call_delta', index: 1, id: 'B', name: 'write_file' });
            onUpdate({ type: 'tool_call_delta', index: 1, argumentsDelta: '{"path": "file2.ts", "content": "B"}' });

            // 3. Tool C starts (dependent on A)
            onUpdate({ type: 'tool_call_delta', index: 2, id: 'C', name: 'write_file' });
            onUpdate({ type: 'tool_call_delta', index: 2, argumentsDelta: '{"path": "file1.ts", "content": "C"}' });

            await new Promise(r => setTimeout(r, 1000));
            return { content: [], role: 'assistant' } as any;
        })();
    }

    estimateTokens() { return 0; }
    async listModels() { return []; }
    async createMessage() { return {} as any; }
}

async function testOmniMerge() {
    console.log('🧪 STRESS TEST: Omni-Directional Merge (Parallel Dependency Tracker)...');

    const registry = new ToolRegistry();
    const executionTrace: string[] = [];
    const activeTools = new Set<string>();
    let maxParallel = 0;

    registry.register({
        name: 'write_file',
        description: 'Write a file',
        input_schema: { type: 'object' } as any,
        execute: async (input: any) => {
            const id = input.content; // Using content as ID for trace
            const path = input.path;

            console.log(`🚀 [${id}] STARTING (Target: ${path})`);
            executionTrace.push(`${id}_START`);
            activeTools.add(id);
            maxParallel = Math.max(maxParallel, activeTools.size);

            // Simulate work
            await new Promise(r => setTimeout(r, 200));

            console.log(`✅ [${id}] FINISHED`);
            executionTrace.push(`${id}_FINISH`);
            activeTools.delete(id);
            return 'OK';
        }
    });

    const provider = new MockOmniProvider() as any;
    const engine = new MarieEngine(provider, registry, async () => true);

    const mockRun: any = {
        runId: 'omni-test',
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

    await engine.chatLoop([], tracker, async () => { });

    console.log('\n📊 EXECUTION TRACE:', executionTrace.join(' -> '));
    console.log('📈 MAX PARALLELISM:', maxParallel);

    // Assertions:
    // 1. A and B should have been parallel (Max Parallel >= 2)
    assert.ok(maxParallel >= 2, 'Should have executed A and B in parallel');

    // 2. C should have started AFTER A finished because they share 'file1.ts'
    const aFinishIndex = executionTrace.indexOf('A_FINISH');
    const cStartIndex = executionTrace.indexOf('C_START');
    assert.ok(cStartIndex > aFinishIndex, 'C should have waited for A to finish');

    console.log('✅ Omni-Directional Merge Test Passed!');
}

testOmniMerge().catch(err => {
    console.error(err);
    process.exit(1);
});
