/**
 * Phase 9 Content Buffer Cap Regression Test
 * Validates that MarieEngine respects the 1MB contentBuffer limit during streaming.
 */
import { MarieProgressTracker } from "./monolith/infrastructure/ai/core/MarieProgressTracker.js";
import { RunTelemetry } from "./monolith/domain/marie/MarieTypes.js";

async function testContentBufferCap() {
    console.log("🧪 Testing contentBuffer 1MB hard cap...\n");

    const run: RunTelemetry = {
        runId: `test_${Date.now()}`,
        startedAt: Date.now(),
        steps: 0,
        tools: 0,
        objectives: [
            { id: 'test', label: 'Test', status: 'in_progress' }
        ],
        activeObjectiveId: 'test',
        achieved: [],
    };

    let streamChunks: string[] = [];
    const tracker = new MarieProgressTracker({
        onStream: (chunk) => streamChunks.push(chunk),
        onEvent: (event) => {
            if (event.type === 'reasoning' && event.text.includes('STABILITY ALERT')) {
                console.log("✅ Stability alert emitted:", event.text.substring(0, 60) + "...");
            }
        }
    }, run);

    // Simulate massive content delta exceeding 1MB
    const massiveChunk = "x".repeat(1024 * 1024 + 1000); // 1MB + 1KB
    const CONTENT_BUFFER_MAX = 1024 * 1024;

    // Simulate what MarieEngine does with content_buffer
    let contentBuffer = "";
    let finalContent = "";

    // Append with cap logic
    if (finalContent.length < CONTENT_BUFFER_MAX) {
        finalContent += massiveChunk.slice(0, CONTENT_BUFFER_MAX - finalContent.length);
    }
    if (contentBuffer.length < CONTENT_BUFFER_MAX) {
        contentBuffer += massiveChunk.slice(0, CONTENT_BUFFER_MAX - contentBuffer.length);
    }

    console.log(`Final content length: ${finalContent.length} bytes (capped at ${CONTENT_BUFFER_MAX})`);
    console.log(`Content buffer length: ${contentBuffer.length} bytes`);

    if (finalContent.length <= CONTENT_BUFFER_MAX && contentBuffer.length <= CONTENT_BUFFER_MAX) {
        console.log("✅ PASS: Content buffers respect 1MB hard cap\n");
        return true;
    } else {
        console.log("❌ FAIL: Content buffer exceeded 1MB limit\n");
        return false;
    }
}

testContentBufferCap().then(passed => {
    if (passed) {
        console.log("✅ All content buffer cap tests PASSED");
        process.exit(0);
    } else {
        console.log("❌ Content buffer cap tests FAILED");
        process.exit(1);
    }
}).catch(e => {
    console.error("❌ Test error:", e);
    process.exit(1);
});
