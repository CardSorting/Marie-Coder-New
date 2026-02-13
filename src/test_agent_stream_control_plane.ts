import { AgentIntentScheduler } from "./infrastructure/ai/core/AgentIntentScheduler.js";
import { AgentMergeArbiter } from "./infrastructure/ai/core/AgentMergeArbiter.js";
import { AgentStreamPolicyEngine } from "./infrastructure/ai/core/AgentStreamPolicyEngine.js";
import { AgentStreamManager } from "./infrastructure/ai/core/AgentStreamManager.js";
import { ConfigService } from "./infrastructure/config/ConfigService.js";
import { AgentIntentRequest, AgentTurnContext, SpawnPlan } from "./infrastructure/ai/core/AgentStreamContracts.js";

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

class FakePolicy extends AgentStreamPolicyEngine {
    constructor(private readonly enabled: boolean) {
        super();
    }

    public override isEnabled(): boolean {
        return this.enabled;
    }

    public override evaluateIntent(): { score: number; accepted: boolean; reason: string } {
        return { score: 2.0, accepted: true, reason: 'synthetic accept' };
    }
}

function createContext(): AgentTurnContext {
    return {
        runId: 'run_test',
        flowState: 70,
        errorCount: 0,
        hotspotCount: 0,
        objectiveCount: 1,
        pressure: 'LOW',
    };
}

function createIntent(agentId: string = 'QASRE'): AgentIntentRequest {
    return {
        intent: 'QUALITY_REGRESSION_SCAN',
        candidateAgents: [agentId],
        urgency: 1,
        risk: 1,
        expectedValue: 1,
        tokenCostEstimate: 250,
        contentionFactor: 1,
    };
}

function testSchedulerDeterminismAndAcceptanceSemantics(): void {
    const shadowScheduler = new AgentIntentScheduler(new FakePolicy(false));
    const liveScheduler = new AgentIntentScheduler(new FakePolicy(true));
    const context = createContext();

    const shadowPlan = shadowScheduler.plan(context, [createIntent()])[0];
    assert(shadowPlan.mode === 'SHADOW', 'Expected SHADOW mode when policy disabled');
    assert(shadowPlan.policyAccepted === true, 'Expected policyAccepted=true in shadow mode for accepted policy decision');
    assert(shadowPlan.executionAccepted === false, 'Expected executionAccepted=false in shadow mode');
    assert((shadowPlan.executionReason || '').includes('SHADOW mode'), 'Expected explicit SHADOW suppression reason');
    assert(shadowPlan.accepted === false, 'Expected accepted alias to track execution acceptance');
    assert(shadowPlan.streamIdentity.streamId.endsWith('_1'), 'Expected deterministic sequence suffix _1');

    const nextShadowPlan = shadowScheduler.plan(context, [createIntent()])[0];
    assert(nextShadowPlan.streamIdentity.streamId.endsWith('_2'), 'Expected deterministic sequence increment to _2');

    const livePlan = liveScheduler.plan(context, [createIntent()])[0];
    assert(livePlan.mode === 'LIVE', 'Expected LIVE mode when policy enabled');
    assert(livePlan.policyAccepted === true, 'Expected policyAccepted=true in live mode');
    assert(livePlan.executionAccepted === true, 'Expected executionAccepted=true in live mode');
    assert(livePlan.accepted === true, 'Expected accepted alias=true in live mode');
    assert(livePlan.executionReason === 'Execution admitted', 'Expected admitted execution reason in live mode');

    const highPressurePlan = liveScheduler.plan({ ...context, pressure: 'HIGH' }, [{ ...createIntent('ISO9001'), intent: 'READINESS_GATE' }])[0];
    assert(highPressurePlan.executionAccepted === false, 'Expected readiness intent execution suppression under HIGH pressure');
    assert((highPressurePlan.executionReason || '').includes('HIGH pressure'), 'Expected HIGH pressure suppression reason');

    const equalScorePlans = liveScheduler.plan(context, [createIntent('QASRE'), createIntent('ISO9001')]);
    assert(equalScorePlans[0].sequence < equalScorePlans[1].sequence, 'Expected stable tie-break by sequence for equal scores');
}

function testManagerConcurrencyAndReasonPropagation(): void {
    const manager = new AgentStreamManager();
    const originalMaxConcurrent = (ConfigService as any).getAgentStreamMaxConcurrent;
    (ConfigService as any).getAgentStreamMaxConcurrent = () => 1;

    try {
        const mkPlan = (streamId: string): SpawnPlan => ({
            streamIdentity: { streamId, origin: 'agent', agentId: 'QASRE', parentRunId: 'run_test', intent: 'QUALITY_REGRESSION_SCAN' },
            intent: 'QUALITY_REGRESSION_SCAN',
            agentId: 'QASRE',
            sequence: 1,
            score: 2,
            policyAccepted: true,
            executionAccepted: true,
            accepted: true,
            reason: 'test',
            tokenBudget: 300,
            timeoutMs: 5000,
            mode: 'LIVE',
        });

        const first = manager.spawn(mkPlan('stream_1'));
        const second = manager.spawn(mkPlan('stream_2'));
        assert(Boolean(first), 'Expected first stream to spawn');
        assert(second === null, 'Expected second stream to be rejected by manager concurrency guard');

        manager.cancel('stream_1', 'pressure_shed');
        const terminal = manager.consumeTerminalState('stream_1');
        assert(terminal?.status === 'cancelled', 'Expected cancelled terminal status');
        assert(terminal?.reason === 'pressure_shed', 'Expected propagated pressure_shed reason');

        const quality = manager.spawn(mkPlan('stream_quality'));
        const readiness = manager.spawn({ ...mkPlan('stream_readiness'), intent: 'READINESS_GATE', streamIdentity: { streamId: 'stream_readiness', origin: 'agent', agentId: 'ISO9001' } });
        assert(Boolean(quality), 'Expected quality stream to spawn');
        assert(readiness === null, 'Expected readiness stream blocked by max concurrency cap in this test setup');

        manager.complete('stream_quality');
        manager.consumeTerminalState('stream_quality');

        const readiness2 = manager.spawn({ ...mkPlan('stream_readiness2'), intent: 'READINESS_GATE', streamIdentity: { streamId: 'stream_readiness2', origin: 'agent', agentId: 'ISO9001' } });
        assert(Boolean(readiness2), 'Expected readiness stream to spawn after slot clears');
        const shed = manager.shedNonCriticalStreams();
        assert(shed.includes('stream_readiness2'), 'Expected non-critical stream to be shed under pressure policy');
        const shedTerminal = manager.consumeTerminalState('stream_readiness2');
        assert(shedTerminal?.reason === 'pressure_shed', 'Expected shed stream to carry pressure_shed reason');

        for (let i = 0; i < 270; i++) {
            const id = `stream_gc_${i}`;
            const stream = manager.spawn(mkPlan(id));
            if (!stream) continue;
            manager.complete(id);
        }

        const oldestTerminal = manager.consumeTerminalState('stream_gc_0');
        assert(!oldestTerminal, 'Expected oldest terminal states to be evicted by bounded terminal-state cache');
    } finally {
        (ConfigService as any).getAgentStreamMaxConcurrent = originalMaxConcurrent;
    }
}

function testArbiterConflictAndBlockingDominance(): void {
    const arbiter = new AgentMergeArbiter();

    arbiter.stage({
        streamIdentity: { streamId: 's1', origin: 'agent', agentId: 'QASRE' },
        intent: 'QUALITY_REGRESSION_SCAN',
        decision: 'QASRE_CRITICAL',
        confidence: 1.8,
        evidenceRefs: ['stream:s1'],
        recommendedActions: [],
        blockingConditions: ['critical_quality_risk'],
        summary: 'Critical risk',
        createdAt: 1,
    });

    arbiter.stage({
        streamIdentity: { streamId: 's2', origin: 'agent', agentId: 'ISO9001' },
        intent: 'READINESS_GATE',
        decision: 'READY',
        confidence: 1.5,
        evidenceRefs: ['stream:s2'],
        recommendedActions: [],
        blockingConditions: [],
        summary: 'Ready to ship',
        createdAt: 2,
    });

    arbiter.stage({
        streamIdentity: { streamId: 's3', origin: 'agent', agentId: 'QASRE' },
        intent: 'QUALITY_REGRESSION_SCAN',
        decision: 'QASRE_DEBUG',
        confidence: 1.4,
        evidenceRefs: ['stream:s3'],
        recommendedActions: [],
        blockingConditions: [],
        summary: 'Duplicate same agent+intent',
        createdAt: 3,
    });

    const decision = arbiter.evaluate();
    assert(decision.accepted.length === 1, 'Expected only blocking envelope to remain accepted');
    assert(decision.accepted[0].streamIdentity.streamId === 's1', 'Expected blocking envelope to dominate');
    assert(decision.rejected.length === 2, 'Expected two rejections from dominance + collision');
}

function run(): void {
    console.log('🧪 Agent stream control-plane tests starting...');
    testSchedulerDeterminismAndAcceptanceSemantics();
    testManagerConcurrencyAndReasonPropagation();
    testArbiterConflictAndBlockingDominance();
    console.log('✅ Agent stream control-plane tests passed');
}

run();
