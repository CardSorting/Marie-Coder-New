import { StringUtils } from "./src/monolith/plumbing/utils/StringUtils";

async function testPhase5() {
    console.log("🚀 Starting Phase 5 Verification...");

    // 1. Test StringUtils.extractText safety (already tested, but confirming for summaries)
    const complexContent = [
        { type: 'text', text: 'Hello ' },
        { type: 'thought', text: 'Thinking...' },
        { type: 'text', text: 'World' }
    ];
    const extracted = StringUtils.extractText(complexContent);
    console.log(`StringUtils - extractText: "${extracted}" (Expected: "Hello  World")`);
    if (extracted !== "Hello  World") throw new Error("Text extraction failed");

    // 2. Mocking MarieSession-like merging logic
    function mockMerge(content: any, tool_uses: any[]) {
        let final: any = content;
        if (tool_uses && tool_uses.length > 0) {
            const blocks: any[] = [];
            if (Array.isArray(content)) {
                blocks.push(...content);
            } else if (content) {
                blocks.push({ type: 'text', text: content });
            }
            for (const tool of tool_uses) {
                blocks.push({ type: 'tool_use', ...tool });
            }
            final = blocks;
        }
        return final;
    }

    // Case A: String content + tool
    const mergedA = mockMerge("Hello", [{ name: "test_tool" }]);
    console.log(`Session Merge (String) length: ${mergedA.length} (Expected: 2)`);
    if (mergedA[0].type !== 'text' || mergedA[1].type !== 'tool_use') throw new Error("String merge failed");

    // Case B: Array content + tool
    const mergedB = mockMerge([{ type: 'text', text: 'Hi' }], [{ name: "test_tool" }]);
    console.log(`Session Merge (Array) length: ${mergedB.length} (Expected: 2)`);
    if (mergedB[0].type !== 'text' || mergedB[1].type !== 'tool_use') throw new Error("Array merge failed");

    console.log("✅ Phase 5 Verification PASSED!");
}

testPhase5().catch(e => {
    console.error("❌ Phase 5 Verification FAILED!");
    console.error(e);
    process.exit(1);
});
