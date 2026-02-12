import { MarieCouncil } from "./src/infrastructure/ai/MarieCouncil";
import { MarieStrategist } from "./src/infrastructure/ai/MarieStrategist";
import { MarieAgentSwarm } from "./src/infrastructure/ai/MarieAgentSwarm";
import { MarieProgressTracker } from "./src/infrastructure/ai/MarieProgressTracker";

class MockAuditor {
    public async audit() { return null; }
    public async runNeuroCritique(tracker: any) { /* mocked if needed elsewhere */ }
}

async function testSentientSwarm() {
    console.log("🧪 Starting Sentient Swarm Stress Test...");

    const council = new MarieCouncil();
    const strategist = new MarieStrategist(council);
    const auditor = new MockAuditor() as any;
    const swarm = new MarieAgentSwarm(council, strategist, auditor);

    const mockRun: any = {
        runId: "sentience-test",
        objectives: [],
        steps: 0,
        recentFiles: ['logic.ts'],
        startedAt: Date.now()
    };
    const tracker = new MarieProgressTracker(undefined, mockRun);

    // 1. Test Adaptive Weights
    console.log("\n--- Testing Adaptive Weights ---");
    council.registerVote('Strategist', 'EXECUTE', 'Let\'s do it', 1.0);
    console.log("Initial Strategist Weight: 2.0");

    council.recordStrategyOutcome(false); // Fail!
    const snapshot = council.getSnapshot();
    const weight = snapshot.agentWeights?.Strategist;
    console.log(`Weight after failure: ${weight}`);
    if (weight < 2.0) {
        console.log("✅ Adaptive Weighting worked: Penalized failure.");
    } else {
        console.log("❌ Adaptive Weighting failed.");
    }

    // 2. Test Emotional Flow (Moods)
    console.log("\n--- Testing Emotional Flow ---");
    council.setMood('FRICTION');
    console.log(`Current Mood: ${council.getMood()}`);
    if (council.getMood() === 'FRICTION') {
        console.log("✅ Mood Transition: FRICTION detected.");
    }

    // 3. Test Collective Intuition
    console.log("\n--- Testing Collective Intuition ---");
    council.recordIntuition('logic.ts', 'Complex regex in line 50');
    const intuition = council.getIntuition('logic.ts');
    console.log(`Recalled Intuition for logic.ts: ${intuition}`);
    if (intuition.includes('Complex regex in line 50')) {
        console.log("✅ Collective Intuition recalled correctly.");
    }

    // 4. Test Neuro-Critique & Semantic Cross-Examination
    console.log("\n--- Testing Semantic Cross-Examination ---");
    // Explicitly seed hotspots and context for Neuro-Critique trigger
    council.recordFileContext('logic.ts');
    council.recordError('logic.ts', 'Fail 1', 'write_file');
    council.recordError('logic.ts', 'Fail 2', 'write_file');
    council.recordError('logic.ts', 'Fail 3', 'write_file');

    // Simulate a risky rush by Strategist
    council.registerVote('Strategist', 'EXECUTE', 'Race Consensus: Rush it!', 2.0);

    await (swarm as any).runNeuroCritique(tracker);
    console.log(`Mood after Neuro-Critique: ${council.getMood()}`);
    if (council.getMood() === 'DOUBT') {
        console.log("✅ Neuro-Critique worked: Auditor flagged risky rush and shifted mood to DOUBT.");
    } else {
        console.log("❌ Neuro-Critique failed to shift mood to DOUBT.");
        console.log("Final Council State:", JSON.stringify(council.getSnapshot(), null, 2));
    }

    console.log("\n✨ PHASE 10 VERIFICATION COMPLETE.");
}

testSentientSwarm().catch(e => {
    console.error("❌ Test Crashed:", e);
    process.exit(1);
});
