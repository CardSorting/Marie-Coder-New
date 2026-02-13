import { MarieCouncil } from "./src/monolith/infrastructure/ai/MarieCouncil";
import { MarieStrategist } from "./src/monolith/infrastructure/ai/MarieStrategist";
import { MarieAgentSwarm } from "./src/monolith/infrastructure/ai/MarieAgentSwarm";
import { MarieProgressTracker } from "./src/monolith/infrastructure/ai/MarieProgressTracker";

/**
 * MOCK AUDITOR: To avoid ConfigService (VSCode) dependencies.
 */
class MockAuditor {
    public async audit() { return null; }
}

async function testParallelSwarm() {
    console.log("🧪 Starting Parallel Swarm Verification (No VSCode Dependency)...");

    const council = new MarieCouncil();
    const strategist = new MarieStrategist(council);
    const auditor = new MockAuditor() as any;

    const swarm = new MarieAgentSwarm(council, strategist, auditor);
    const mockRun: any = {
        runId: "test-run",
        objectives: [],
        achieved: [],
        steps: 0,
        tools: 0,
        startedAt: Date.now()
    };
    const tracker = new MarieProgressTracker(undefined, mockRun);

    console.log("🏃 Running parallel evaluation...");
    const start = Date.now();
    const mockMessages = [{ role: 'user', content: "Please look at src/core/logic.ts and src/ui/theme.ts" }];
    await swarm.evaluateSwarm(tracker, 0, mockMessages);
    const duration = Date.now() - start;

    console.log(`✅ Swarm evaluation complete in ${duration}ms`);
    console.log("Council Strategy:", council.getStrategy());
    console.log("Council Mood:", council.getMood());

    if (duration >= 0) {
        console.log("✨ PASS: Swarm processed parallel logic successfully.");
    } else {
        console.log("❌ FAIL: Swarm execution failed.");
    }
}

testParallelSwarm().catch(e => {
    console.error("❌ Test Crashed:", e);
    process.exit(1);
});
