import * as assert from 'assert';
import { MarieCouncil, CouncilStrategy, CouncilMood } from '../src/infrastructure/ai/council/MarieCouncil';
import { MarieYOLO } from '../src/infrastructure/ai/agents/MarieYOLO';
import { AIProvider } from '../src/infrastructure/ai/providers/AIProvider';

async function testConsensus() {
    console.log('🧪 Testing Council Consensus...');
    const council = new MarieCouncil();

    // Engine votes EXECUTE
    council.registerVote('Engine', 'EXECUTE', 'Normal flow', 1.0);
    assert.strictEqual(council.getStrategy(), 'EXECUTE');

    // Strategist votes RESEARCH with high confidence
    council.registerVote('Strategist', 'RESEARCH', 'Need more context', 2.0); // High confidence should override
    assert.strictEqual(council.getStrategy(), 'RESEARCH');
    assert.strictEqual(council.getMood(), 'INQUISITIVE');

    console.log('✅ Consensus Test Passed!');
}

async function testMoodTransitions() {
    console.log('🧪 Testing Mood Transitions...');
    const council = new MarieCouncil();

    // Test EUPHORIA via flow
    for (let i = 0; i < 15; i++) {
        council.recordToolExecution('test_tool', 100, true);
    }
    const flow = council.getFlowState();
    console.log(`Current flow: ${flow}`);
    assert.ok(flow > 85);
    assert.strictEqual(council.getMood(), 'EUPHORIA');

    // Test FRICTION via failures
    for (let i = 0; i < 10; i++) {
        council.recordToolExecution('test_tool', 100, false, 'broken.ts');
    }
    console.log(`Flow after failures: ${council.getFlowState()}`);
    assert.ok(council.getFlowState() < 20);
    assert.strictEqual(council.getMood(), 'FRICTION');

    console.log('✅ Mood Transitions Test Passed!');
}

async function testFailurePrediction() {
    console.log('🧪 Testing Failure Prediction...');
    const council = new MarieCouncil();

    // Record some failures on a specific file
    for (let i = 0; i < 2; i++) {
        council.recordToolExecution('write_file', 500, false, 'readonly.ts');
    }

    const prediction = council.predictFailure('write_file', 'readonly.ts');
    console.log(`Prediction: ${prediction}`);
    assert.ok(prediction && prediction.includes('PREDICTED FAILURE'));

    // Register a vote for write_file strategy and see if it's penalized
    council.registerVote('Engine', 'EXECUTE', 'Want to write', 1.0);
    // (Note: we can't easily check the internal weights without exposing lastConsensus or similar)

    console.log('✅ Failure Prediction Test Passed!');
}

async function testRecoveryPatterns() {
    console.log('🧪 Testing Recovery Patterns...');
    const council = new MarieCouncil();

    // Simulate failure followed by success (recovery)
    council.recordToolExecution('write_file', 500, false, 'target.ts');
    council.recordToolExecution('chmod', 100, true, 'target.ts'); // Successful recovery tool

    const patterns = council.getRecoveryPatterns();
    console.log(`Recovery Patterns: ${JSON.stringify(patterns)}`);
    assert.ok(patterns.some(p => p.recoveryTool === 'chmod'));

    const hint = council.getRecoveryHint('write_file', 'target.ts');
    assert.ok(hint && hint.includes('chmod'));

    console.log('✅ Recovery Patterns Test Passed!');
}

async function testYoloConsensusDampening() {
    console.log('🧪 Testing YOLO consensus dampening...');

    const healthy = new MarieCouncil();
    healthy.registerVote('Strategist', 'RESEARCH', 'Need broad context', 1.2);
    healthy.registerVote('YOLO', 'HYPE', 'Push momentum hard', 1.5);
    assert.strictEqual(healthy.getStrategy(), 'HYPE', 'YOLO should win in healthy state');

    const risky = new MarieCouncil();
    for (let i = 0; i < 9; i++) {
        risky.recordError('TOOL_FAILURE', `simulated_error_${i}`, `file_${i}.ts`);
    }
    risky.registerVote('Strategist', 'RESEARCH', 'Need broad context', 1.2);
    risky.registerVote('YOLO', 'HYPE', 'Push momentum hard', 1.5);
    assert.strictEqual(risky.getStrategy(), 'RESEARCH', 'YOLO should be dampened in risky state');

    console.log('✅ YOLO Consensus Dampening Test Passed!');
}

class MockProvider implements AIProvider {
    async createMessage(): Promise<any> {
        return {
            role: 'assistant',
            content: `Strategy: EXECUTE
Urgency: HIGH
Confidence: 2.3
Structural Uncertainty: NO
Continue Directive: YES
Required Actions: wire engine | update council | validate compile
Blocked By: none
Stop Condition: landed
Reason: Founder arc is coherent and ready to ship.`
        };
    }

    async createMessageStream(): Promise<any> {
        throw new Error('Not used in this test');
    }

    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    async listModels(): Promise<{ id: string; name: string; }[]> {
        return [];
    }
}

async function testYoloDecisionParsing() {
    console.log('🧪 Testing YOLO decision parsing...');

    const yolo = new MarieYOLO(new MockProvider());
    const decision = await yolo.evaluate(
        [{ role: 'user', content: 'continue and ship it' }],
        'readiness context',
        { profile: 'demo_day', aggression: 1.0, maxRequiredActions: 2 }
    );

    assert.strictEqual(decision.strategy, 'EXECUTE');
    assert.strictEqual(decision.urgency, 'HIGH');
    assert.strictEqual(decision.isContinueDirective, true);
    assert.strictEqual(decision.stopCondition, 'landed');
    assert.ok(decision.requiredActions.length <= 2, 'Required actions must respect max cap');

    console.log('✅ YOLO Decision Parsing Test Passed!');
}

async function runAllTests() {
    try {
        await testConsensus();
        await testMoodTransitions();
        await testFailurePrediction();
        await testRecoveryPatterns();
        await testYoloConsensusDampening();
        await testYoloDecisionParsing();
        console.log('\n🌟 ALL COUNCIL TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
