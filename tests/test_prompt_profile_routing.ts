import * as assert from 'assert';
import { SYSTEM_CONTINUATION_PROMPT, SYSTEM_PROMPT } from '../src/prompts.ts';
import { MarieSession } from '../src/infrastructure/ai/core/MarieSession.ts';
import { getPromptProfileForDepth } from '../src/infrastructure/ai/core/MarieEngine.ts';
import { ToolRegistry } from '../src/infrastructure/tools/ToolRegistry.ts';
import type { AIProvider, AIRequestParams, AIResponse, AIStreamEvent } from '../src/infrastructure/ai/providers/AIProvider.ts';

class CaptureProvider implements AIProvider {
    public capturedSystems: string[] = [];

    async createMessage(_params: AIRequestParams): Promise<AIResponse> {
        return { role: 'assistant', content: '' };
    }

    async createMessageStream(params: AIRequestParams, onUpdate: (event: AIStreamEvent) => void): Promise<AIResponse> {
        this.capturedSystems.push(params.system || '');
        onUpdate({ type: 'run_started', timestamp: Date.now() });
        onUpdate({ type: 'run_completed', timestamp: Date.now(), durationMs: 0 });
        return { role: 'assistant', content: 'ok' };
    }

    estimateTokens(text: string): number {
        return text.length;
    }

    async listModels(): Promise<{ id: string; name: string; }[]> {
        return [];
    }
}

async function run(): Promise<void> {
    assert.strictEqual(getPromptProfileForDepth(0), 'full');
    assert.strictEqual(getPromptProfileForDepth(1), 'continuation');
    assert.strictEqual(getPromptProfileForDepth(5), 'continuation');

    const registry = new ToolRegistry();
    const saveHistory = async (): Promise<void> => { };

    const providerFull = new CaptureProvider();
    const sessionFull = new MarieSession(providerFull, registry, saveHistory, [], undefined, undefined, 'full');
    await sessionFull.generate();
    assert.strictEqual(providerFull.capturedSystems[0], SYSTEM_PROMPT, 'full profile should use SYSTEM_PROMPT');

    const providerContinuation = new CaptureProvider();
    const sessionContinuation = new MarieSession(providerContinuation, registry, saveHistory, [], undefined, undefined, 'continuation');
    await sessionContinuation.generate();
    assert.strictEqual(providerContinuation.capturedSystems[0], SYSTEM_CONTINUATION_PROMPT, 'continuation profile should use SYSTEM_CONTINUATION_PROMPT');

    console.log('✅ Prompt profile routing tests passed');
}

run().catch((err) => {
    console.error('❌ Prompt profile routing tests failed');
    console.error(err);
    process.exit(1);
});
