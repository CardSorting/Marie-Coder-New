import * as assert from 'assert';
import { JoyServiceCLI, JoyScoreEvent, RunProgressEvent, LettingGoRequest } from '../../src/monolith/cli/services/JoyServiceCLI.js';
import { JoyAutomationServiceCLI } from '../../src/monolith/cli/services/JoyAutomationServiceCLI.js';
import { RunTelemetry } from '../../src/monolith/domain/marie/MarieTypes.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, '..', '..', '.marie-joy-test');

async function testJoyServiceCLIConstruction() {
    console.log('🧪 Testing JoyServiceCLI Construction...');

    const joyService = new JoyServiceCLI();

    assert.ok(joyService, 'JoyServiceCLI should be created');
    assert.ok(joyService.onJoyScoreChange, 'Should have onJoyScoreChange event emitter');
    assert.ok(joyService.onRunProgress, 'Should have onRunProgress event emitter');
    assert.ok(joyService.onLettingGoRequest, 'Should have onLettingGoRequest event emitter');

    joyService.dispose();
    console.log('✅ JoyServiceCLI Construction Test Passed!');
}

async function testAddAchievement() {
    console.log('🧪 Testing Add Achievement...');

    const joyService = new JoyServiceCLI();

    // Test adding achievement (in debug mode, it would log)
    const originalDebug = process.env.MARIE_DEBUG;
    process.env.MARIE_DEBUG = 'true';

    // Should not throw
    await joyService.addAchievement('Test achievement', 10);
    await joyService.addAchievement('Another achievement'); // Default points

    process.env.MARIE_DEBUG = originalDebug;

    joyService.dispose();
    console.log('✅ Add Achievement Test Passed!');
}

async function testSetIntention() {
    console.log('🧪 Testing Set Intention...');

    const joyService = new JoyServiceCLI();

    // Test setting intention
    await joyService.setIntention('Refactor the codebase');

    // Intention is private, but we can verify it doesn't throw
    // In a real scenario, we might expose a getter or spy on the value

    joyService.dispose();
    console.log('✅ Set Intention Test Passed!');
}

async function testGetProjectHealth() {
    console.log('🧪 Testing Get Project Health...');

    const joyService = new JoyServiceCLI();

    const health = await joyService.getProjectHealth();

    assert.ok(health, 'Should return health object');
    assert.strictEqual(health.average, 100, 'Default average should be 100');
    assert.strictEqual(health.fileCount, 0, 'Default file count should be 0');
    assert.strictEqual(health.zoningViolations, 0, 'Default zoning violations should be 0');
    assert.strictEqual(health.joyfulFiles, 0, 'Default joyful files should be 0');
    assert.strictEqual(health.plumbingFiles, 0, 'Default plumbing files should be 0');
    assert.strictEqual(health.isJoyful, true, 'Default isJoyful should be true');
    assert.ok(Array.isArray(health.log), 'Log should be an array');
    assert.ok(Array.isArray(health.migrationAlerts), 'Migration alerts should be an array');
    assert.ok(Array.isArray(health.clusteringAlerts), 'Clustering alerts should be an array');

    joyService.dispose();
    console.log('✅ Get Project Health Test Passed!');
}

async function testRequestLettingGo() {
    console.log('🧪 Testing Request Letting Go...');

    const joyService = new JoyServiceCLI();

    let receivedRequest: LettingGoRequest | null = null;

    // Listen for letting go request
    joyService.onLettingGoRequest.once('request', (request: any) => {
        receivedRequest = request as LettingGoRequest;
    });

    // Create a test file
    const fs = await import('fs');
    const testFile = path.join(TEST_DIR, 'test_file.txt');
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

    // Request letting go
    await joyService.requestLettingGo(testFile);

    // Wait a bit for event
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(receivedRequest, 'Should receive letting go request');
    assert.strictEqual((receivedRequest as LettingGoRequest).path, testFile, 'Path should match');
    assert.strictEqual((receivedRequest as LettingGoRequest).lines, 5, 'Should have 5 lines');

    // Cleanup
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    joyService.dispose();
    console.log('✅ Request Letting Go Test Passed!');
}

async function testRequestLettingGoNonExistentFile() {
    console.log('🧪 Testing Request Letting Go (Non-existent File)...');

    const joyService = new JoyServiceCLI();

    let receivedRequest: LettingGoRequest | null = null;

    // Listen for letting go request
    joyService.onLettingGoRequest.once('request', (request: any) => {
        receivedRequest = request as LettingGoRequest;
    });

    // Request letting go for non-existent file
    const nonExistentFile = path.join(TEST_DIR, 'non_existent.txt');
    await joyService.requestLettingGo(nonExistentFile);

    // Wait a bit for event
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(receivedRequest, 'Should receive letting go request even for non-existent file');
    assert.strictEqual((receivedRequest as LettingGoRequest).path, nonExistentFile, 'Path should match');
    assert.strictEqual((receivedRequest as LettingGoRequest).lines, 0, 'Should have 0 lines for non-existent file');

    joyService.dispose();
    console.log('✅ Request Letting Go (Non-existent File) Test Passed!');
}

async function testEmitRunProgress() {
    console.log('🧪 Testing Emit Run Progress...');

    const joyService = new JoyServiceCLI();

    let receivedProgress: RunProgressEvent | null = null;

    // Listen for run progress
    joyService.onRunProgress.once('progress', (progress: any) => {
        receivedProgress = progress as RunProgressEvent;
    });

    const testProgress: RunProgressEvent = {
        runId: 'run_123',
        activeToolName: 'write_file',
        lastToolName: 'read_file',
        activeObjectiveId: 'obj_1',
        context: 'Writing code'
    };

    joyService.emitRunProgress(testProgress);

    // Wait a bit for event
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.ok(receivedProgress, 'Should receive run progress');
    assert.strictEqual((receivedProgress as RunProgressEvent).runId, 'run_123', 'Run ID should match');
    assert.strictEqual((receivedProgress as RunProgressEvent).activeToolName, 'write_file', 'Active tool should match');
    assert.strictEqual((receivedProgress as RunProgressEvent).context, 'Writing code', 'Context should match');

    joyService.dispose();
    console.log('✅ Emit Run Progress Test Passed!');
}

async function testJoyServiceDispose() {
    console.log('🧪 Testing JoyServiceCLI Dispose...');

    const joyService = new JoyServiceCLI();

    // Add some listeners
    joyService.onJoyScoreChange.on('test', () => { });
    joyService.onRunProgress.on('test', () => { });
    joyService.onLettingGoRequest.on('test', () => { });

    // Dispose
    joyService.dispose();

    // Listeners should be removed (no easy way to test this without accessing private state)
    console.log('✅ JoyServiceCLI Dispose Test Passed!');
}

async function testJoyAutomationServiceConstruction() {
    console.log('🧪 Testing JoyAutomationServiceCLI Construction...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    assert.ok(automationService, 'JoyAutomationServiceCLI should be created');

    joyService.dispose();
    console.log('✅ JoyAutomationServiceCLI Construction Test Passed!');
}

async function testSetCurrentRun() {
    console.log('🧪 Testing Set Current Run...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    // Initially no run
    assert.strictEqual(automationService.getCurrentRun(), undefined, 'Should have no current run initially');

    // Set a run
    const testRun: RunTelemetry = {
        runId: 'run_123',
        startedAt: Date.now(),
        steps: 5,
        tools: 3,
        objectives: [],
        achieved: []
    };

    automationService.setCurrentRun(testRun);

    const currentRun = automationService.getCurrentRun();
    assert.ok(currentRun, 'Should have current run');
    assert.strictEqual(currentRun?.runId, 'run_123', 'Run ID should match');

    // Clear run
    automationService.setCurrentRun(undefined);
    assert.strictEqual(automationService.getCurrentRun(), undefined, 'Should clear current run');

    joyService.dispose();
    console.log('✅ Set Current Run Test Passed!');
}

async function testTriggerGenesis() {
    console.log('🧪 Testing Trigger Genesis...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    const result = await automationService.triggerGenesis();

    assert.ok(result.includes('not available'), 'Should return unavailable message in CLI mode');

    joyService.dispose();
    console.log('✅ Trigger Genesis Test Passed!');
}

async function testSowJoyFeature() {
    console.log('🧪 Testing Sow Joy Feature...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    const result = await automationService.sowJoyFeature('MyFeature', 'Test feature intent');

    assert.ok(result.includes('not available'), 'Should return unavailable message in CLI mode');
    assert.ok(result.includes('MyFeature'), 'Should mention feature name');

    joyService.dispose();
    console.log('✅ Sow Joy Feature Test Passed!');
}

async function testPerformGardenPulse() {
    console.log('🧪 Testing Perform Garden Pulse...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    const result = await automationService.performGardenPulse();

    assert.ok(result.includes('not available'), 'Should return unavailable message in CLI mode');

    joyService.dispose();
    console.log('✅ Perform Garden Pulse Test Passed!');
}

async function testAutoScaffold() {
    console.log('🧪 Testing Auto Scaffold...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    // Should not throw (no-op in CLI)
    await automationService.autoScaffold();

    joyService.dispose();
    console.log('✅ Auto Scaffold Test Passed!');
}

async function testJoyAutomationDispose() {
    console.log('🧪 Testing JoyAutomationServiceCLI Dispose...');

    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);

    // Should not throw (no-op in CLI)
    automationService.dispose();

    joyService.dispose();
    console.log('✅ JoyAutomationServiceCLI Dispose Test Passed!');
}

async function runAllTests() {
    try {
        // JoyServiceCLI Tests
        await testJoyServiceCLIConstruction();
        await testAddAchievement();
        await testSetIntention();
        await testGetProjectHealth();
        await testRequestLettingGo();
        await testRequestLettingGoNonExistentFile();
        await testEmitRunProgress();
        await testJoyServiceDispose();

        // JoyAutomationServiceCLI Tests
        await testJoyAutomationServiceConstruction();
        await testSetCurrentRun();
        await testTriggerGenesis();
        await testSowJoyFeature();
        await testPerformGardenPulse();
        await testAutoScaffold();
        await testJoyAutomationDispose();

        console.log('\n🌟 ALL JOY SERVICES TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
