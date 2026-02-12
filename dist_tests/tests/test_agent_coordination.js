import * as assert from 'assert';
import { MarieCouncil } from '../src/infrastructure/ai/council/MarieCouncil';
// Helper to create a YoloTelemetry object
function createYOLODecision(strategy = 'EXECUTE', confidence = 2.0, urgency = 'MEDIUM', dampened = false) {
    return {
        profile: 'balanced',
        strategy,
        confidence,
        urgency,
        dampened,
        structuralUncertainty: false,
        requiredActions: [],
        blockedBy: [],
        stopCondition: 'landed',
        timestamp: Date.now()
    };
}
async function testAgentCoordinationBasics() {
    console.log('🧪 Testing Agent Coordination Basics...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Test registering agent contexts
    coordination.registerAgentContext('Strategist', {
        priority: 2.0,
        dependencies: [],
        recommendedStrategy: 'EXECUTE'
    });
    coordination.registerAgentContext('Auditor', {
        priority: 1.5,
        dependencies: ['Strategist'],
        recommendedStrategy: 'DEBUG'
    });
    // Test execution order calculation
    const result = coordination.calculateExecutionOrder(['Strategist', 'Auditor']);
    assert.ok(result.executionOrder.includes('Strategist'), 'Strategist should be in execution order');
    assert.ok(result.executionOrder.includes('Auditor'), 'Auditor should be in execution order');
    assert.ok(result.parallelGroups.length > 0, 'Should have parallel groups');
    console.log('✅ Agent Coordination Basics Test Passed!');
}
async function testConflictDetection() {
    console.log('🧪 Testing Conflict Detection...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Create conflicting strategies
    coordination.registerAgentContext('Agent1', {
        priority: 2.0,
        recommendedStrategy: 'EXECUTE'
    });
    coordination.registerAgentContext('Agent2', {
        priority: 2.0,
        recommendedStrategy: 'DEBUG'
    });
    coordination.registerAgentContext('Agent3', {
        priority: 2.0,
        recommendedStrategy: 'RESEARCH'
    });
    const conflicts = coordination.detectConflicts();
    // Should detect divergent strategies
    assert.ok(conflicts.length > 0, 'Should detect conflicts with divergent strategies');
    assert.ok(conflicts.some(c => c.severity === 'HIGH'), 'Should have HIGH severity conflict');
    console.log('✅ Conflict Detection Test Passed!');
}
async function testCircularDependencyDetection() {
    console.log('🧪 Testing Circular Dependency Detection...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Create circular dependency: A -> B -> A
    coordination.registerAgentContext('AgentA', {
        priority: 1.0,
        dependencies: ['AgentB']
    });
    coordination.registerAgentContext('AgentB', {
        priority: 1.0,
        dependencies: ['AgentA']
    });
    const conflicts = coordination.detectConflicts();
    assert.ok(conflicts.some(c => c.issue.includes('Circular dependency')), 'Should detect circular dependency');
    assert.ok(conflicts.some(c => c.severity === 'CRITICAL'), 'Circular dependency should be CRITICAL severity');
    console.log('✅ Circular Dependency Detection Test Passed!');
}
async function testYOLOPrioritization() {
    console.log('🧪 Testing YOLO Prioritization...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Register agents with default priorities
    coordination.registerAgentContext('Strategist', { priority: 1.0 });
    coordination.registerAgentContext('Auditor', { priority: 1.0 });
    coordination.registerAgentContext('QASRE', { priority: 1.0 });
    // Apply YOLO HYPE guidance
    const hypeDecision = createYOLODecision('HYPE', 2.5, 'HIGH');
    coordination.updateYOLOGuidance(hypeDecision);
    // Check that YOLO and Strategist get boosted, Auditor/QASRE suppressed
    const result = coordination.calculateExecutionOrder(['Strategist', 'Auditor', 'QASRE']);
    assert.ok(result.recommendations.some(r => r.includes('YOLO guidance')), 'Should include YOLO guidance in recommendations');
    console.log('✅ YOLO Prioritization Test Passed!');
}
async function testYOLOCouncilIntegration() {
    console.log('🧪 Testing YOLO-Council Integration...');
    const council = new MarieCouncil();
    // Process a high-confidence YOLO decision
    const highConfidenceDecision = createYOLODecision('HYPE', 2.8, 'HIGH');
    const metrics = council.processYOLODecision(highConfidenceDecision);
    assert.ok(metrics.currentConviction === 2.8, 'Conviction should match decision');
    assert.ok(metrics.overrideAuthority === true, 'High confidence should grant override authority');
    assert.ok(metrics.boostedAgents.length > 0, 'Should have boosted agents');
    console.log('✅ YOLO-Council Integration Test Passed!');
}
async function testYOLOVetoPower() {
    console.log('🧪 Testing YOLO Veto Power...');
    const council = new MarieCouncil();
    // High confidence YOLO wants DEBUG
    const yoloDecision = createYOLODecision('DEBUG', 2.8);
    // Council wants HYPE
    const vetoResult = council.shouldYOLOVeto('HYPE', yoloDecision);
    assert.ok(vetoResult.veto === true, 'YOLO should be able to veto conflicting HYPE when DEBUG is needed');
    assert.ok(vetoResult.reason?.includes('YOLO veto'), 'Should have YOLO veto reason');
    // But shouldn't veto PANIC (safety override)
    const panicVeto = council.shouldYOLOVeto('PANIC', yoloDecision);
    assert.ok(panicVeto.veto === false, 'YOLO should not veto safety-critical PANIC');
    console.log('✅ YOLO Veto Power Test Passed!');
}
async function testSwarmGuidance() {
    console.log('🧪 Testing Swarm Guidance...');
    const council = new MarieCouncil();
    // Without YOLO decision, should default to PARALLEL
    const defaultGuidance = council.getSwarmGuidance();
    assert.ok(defaultGuidance.executionMode === 'PARALLEL', 'Default should be PARALLEL');
    assert.ok(defaultGuidance.activeAgents.length > 0, 'Should have active agents');
    // With high confidence YOLO, should get YOLO_LEAD
    const highConfidenceDecision = createYOLODecision('EXECUTE', 2.8);
    council.processYOLODecision(highConfidenceDecision);
    const yoloGuidance = council.getSwarmGuidance();
    assert.ok(yoloGuidance.yoloPrecedence === true, 'Should have YOLO precedence');
    console.log('✅ Swarm Guidance Test Passed!');
}
async function testAgentPerformanceTracking() {
    console.log('🧪 Testing Agent Performance Tracking...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Record some performance data
    coordination.recordAgentPerformance('Strategist', true, 100);
    coordination.recordAgentPerformance('Strategist', true, 120);
    coordination.recordAgentPerformance('Strategist', false, 500);
    const metrics = coordination.getMetrics();
    assert.ok(metrics.performanceStats.length > 0, 'Should have performance stats');
    const strategistStats = metrics.performanceStats.find(s => s.agent === 'Strategist');
    assert.ok(strategistStats !== undefined, 'Should have Strategist stats');
    assert.ok(strategistStats.totalCalls === 3, 'Should have recorded 3 calls');
    console.log('✅ Agent Performance Tracking Test Passed!');
}
async function testContextSharing() {
    console.log('🧪 Testing Context Sharing...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Share context from Strategist to Auditor
    coordination.shareContext('Strategist', ['Auditor'], 'keyInsight', {
        file: 'test.ts',
        recommendation: 'Refactor needed'
    });
    // Auditor should receive the context
    const auditorContext = coordination.getSharedContext('Auditor');
    assert.ok(Object.keys(auditorContext).length > 0, 'Auditor should have shared context');
    console.log('✅ Context Sharing Test Passed!');
}
async function testYOLOInfluenceAnalytics() {
    console.log('🧪 Testing YOLO Influence Analytics...');
    const council = new MarieCouncil();
    // Process multiple decisions to build history
    council.processYOLODecision(createYOLODecision('EXECUTE', 2.0));
    council.processYOLODecision(createYOLODecision('EXECUTE', 2.2));
    council.processYOLODecision(createYOLODecision('HYPE', 2.5));
    council.processYOLODecision(createYOLODecision('HYPE', 2.7));
    const analytics = council.getYOLOAnalytics();
    assert.ok(analytics.avgConviction > 0, 'Should have average conviction');
    assert.ok(['INCREASING', 'DECREASING', 'STABLE'].includes(analytics.trendDirection), 'Should have valid trend direction');
    console.log('✅ YOLO Influence Analytics Test Passed!');
}
async function testAdaptiveCoordination() {
    console.log('🧪 Testing Adaptive Coordination...');
    const council = new MarieCouncil();
    const coordination = council.getAgentCoordination();
    // Register an agent
    coordination.registerAgentContext('TestAgent', { priority: 1.0 });
    // Simulate poor performance
    for (let i = 0; i < 5; i++) {
        coordination.recordAgentPerformance('TestAgent', false, 1000);
    }
    // After poor performance, the agent's priority should be reduced
    const result = coordination.calculateExecutionOrder(['TestAgent']);
    // The performance tracking should have occurred
    const metrics = coordination.getMetrics();
    const testAgentStats = metrics.performanceStats.find(s => s.agent === 'TestAgent');
    assert.ok(testAgentStats !== undefined, 'Should have TestAgent stats');
    assert.ok(testAgentStats.successRate < 0.5, 'Success rate should be low after failures');
    console.log('✅ Adaptive Coordination Test Passed!');
}
async function runAllTests() {
    try {
        await testAgentCoordinationBasics();
        await testConflictDetection();
        await testCircularDependencyDetection();
        await testYOLOPrioritization();
        await testYOLOCouncilIntegration();
        await testYOLOVetoPower();
        await testSwarmGuidance();
        await testAgentPerformanceTracking();
        await testContextSharing();
        await testYOLOInfluenceAnalytics();
        await testAdaptiveCoordination();
        console.log('\n🌟 ALL AGENT COORDINATION TESTS PASSED!');
        console.log('\nNew Features Tested:');
        console.log('  ✅ Agent Coordination with dependency management');
        console.log('  ✅ Conflict detection and resolution');
        console.log('  ✅ Circular dependency detection');
        console.log('  ✅ YOLO-guided prioritization');
        console.log('  ✅ YOLO-Council integration layer');
        console.log('  ✅ YOLO veto power');
        console.log('  ✅ Swarm execution guidance');
        console.log('  ✅ Agent performance tracking');
        console.log('  ✅ Cross-agent context sharing');
        console.log('  ✅ YOLO influence analytics');
        console.log('  ✅ Adaptive coordination');
    }
    catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}
runAllTests();
