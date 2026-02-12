import { PrefixTree } from "./plumbing/utils/PrefixTree.js";

console.log("Starting PrefixTree Tests...\n");

// Test Suite 1: Basic Tag Detection
function testBasicDetection() {
    console.log("Suite 1: Basic Tag Detection");
    const tree = new PrefixTree(["<tool>", "</tool>", "<|start|>", "<|end|>"]);

    // Test 1: Empty text
    const result1 = tree.findEarliestTag("");
    console.log(`Test: Empty text - ${result1 === null ? 'PASS' : 'FAIL'}`);

    // Test 2: Single tag
    const result2 = tree.findEarliestTag("Hello <tool> world");
    console.log(`Test: Single tag - ${result2?.tag === '<tool>' && result2?.index === 6 ? 'PASS' : 'FAIL'}`);

    // Test 3: Multiple tags (earliest wins)
    const result3 = tree.findEarliestTag("Text </tool> more <tool> stuff");
    console.log(`Test: Multiple tags (earliest) - ${result3?.tag === '</tool>' && result3?.index === 5 ? 'PASS' : 'FAIL'}`);

    // Test 4: Overlapping tags
    const result4 = tree.findEarliestTag("<<tool>>");
    console.log(`Test: Overlapping tags - ${result4?.tag === '<tool>' && result4?.index === 1 ? 'PASS' : 'FAIL'}`);

    // Test 5: No tags
    const result5 = tree.findEarliestTag("Just plain text here");
    console.log(`Test: No tags - ${result5 === null ? 'PASS' : 'FAIL'}`);
}

// Test Suite 2: Partial Tag Detection
function testPartialDetection() {
    console.log("\nSuite 2: Partial Tag Detection");
    const tree = new PrefixTree(["<tool>", "<|start|>", "<|end|>"]);

    // Test 1: Complete partial at end
    const result1 = tree.findLongestPartialAtEnd("Text <too");
    console.log(`Test: Partial '<too' - ${result1 === 4 ? 'PASS' : 'FAIL (got ' + result1 + ')'}`);

    // Test 2: Longer partial
    const result2 = tree.findLongestPartialAtEnd("Text <|star");
    console.log(`Test: Partial '<|star' - ${result2 === 6 ? 'PASS' : 'FAIL (got ' + result2 + ')'}`);

    // Test 3: No partial
    const result3 = tree.findLongestPartialAtEnd("No partial here");
    console.log(`Test: No partial - ${result3 === 0 ? 'PASS' : 'FAIL'}`);

    // Test 4: Complete tag (not a partial)
    const result4 = tree.findLongestPartialAtEnd("Complete <tool>");
    console.log(`Test: Complete tag (not partial) - ${result4 === 0 ? 'PASS' : 'FAIL'}`);

    // Test 5: Single char partial
    const result5 = tree.findLongestPartialAtEnd("End with <");
    console.log(`Test: Single char partial '<' - ${result5 === 1 ? 'PASS' : 'FAIL (got ' + result5 + ')'}`);
}

// Test Suite 3: Fuzzy Matching
function testFuzzyMatching() {
    console.log("\nSuite 3: Fuzzy Matching");
    const tree = new PrefixTree(["<|tool_call_begin|>", "<|tool_call_end|>", "<tool>"]);

    // Test 1: Exact match (distance 0)
    const result1 = tree.findSimilarTags("<tool>", 2);
    console.log(`Test: Exact match - ${result1.includes('<tool>') && result1.length === 1 ? 'PASS' : 'FAIL'}`);

    // Test 2: Distance 1 (one char off)
    const result2 = tree.findSimilarTags("<tol>", 2);
    console.log(`Test: Distance 1 - ${result2.includes('<tool>') ? 'PASS' : 'FAIL'}`);

    // Test 3: Distance 2 (two chars off)
    const result3 = tree.findSimilarTags("<|tool_call_begi|>", 2);
    console.log(`Test: Distance 2 - ${result3.includes('<|tool_call_begin|>') ? 'PASS' : 'FAIL'}`);

    // Test 4: Too far (distance > 2)
    const result4 = tree.findSimilarTags("<toolz>", 1);
    console.log(`Test: Distance > max - ${result4.length === 0 ? 'PASS' : 'FAIL'}`);

    // Test 5: Multiple matches
    const result5 = tree.findSimilarTags("<|tool_call_en|>", 2);
    console.log(`Test: Multiple fuzzy matches - ${result5.length >= 1 ? 'PASS' : 'FAIL'}`);
}

// Test Suite 4: Performance with Large Tag Sets
function testPerformance() {
    console.log("\nSuite 4: Performance");

    // Create a large tag set
    const tags: string[] = [];
    for (let i = 0; i < 100; i++) {
        tags.push(`<tag_${i}>`);
        tags.push(`<|llama_tag_${i}|>`);
    }

    const tree = new PrefixTree(tags);
    const text = "Some text content ".repeat(10) + "<tag_50>" + " more text".repeat(10);

    const startTime = Date.now();
    const result = tree.findEarliestTag(text);
    const duration = Date.now() - startTime;

    console.log(`Test: Large tag set (200 tags) - ${result?.tag === '<tag_50>' && duration < 50 ? 'PASS' : 'FAIL'} (${duration}ms)`);

    // Test partial detection performance
    const partialText = "x".repeat(1000) + "<tag_9";
    const startTime2 = Date.now();
    const partial = tree.findLongestPartialAtEnd(partialText);
    const duration2 = Date.now() - startTime2;

    console.log(`Test: Partial detection perf - ${partial === 7 && duration2 < 100 ? 'PASS' : 'FAIL'} (${duration2}ms)`);
}

// Test Suite 5: Edge Cases
function testEdgeCases() {
    console.log("\nSuite 5: Edge Cases");
    const tree = new PrefixTree(["<a>", "<ab>", "<abc>"]);

    // Test 1: Nested overlapping tags
    const result1 = tree.findEarliestTag("<a<ab>>");
    console.log(`Test: Nested tags - ${result1?.tag === '<a>' && result1?.index === 0 ? 'PASS' : 'FAIL'}`);

    // Test 2: Tag prefix of another
    const result2 = tree.findEarliestTag("Text <abc> end");
    console.log(`Test: Tag prefix - ${result2?.tag === '<a>' && result2?.index === 5 ? 'PASS' : 'FAIL'}`);

    // Test 3: Special characters
    const tree2 = new PrefixTree(["<|tag|>", "<tag\\n>"]);
    const result3 = tree2.findEarliestTag("Start <|tag|> end");
    console.log(`Test: Special chars - ${result3?.tag === '<|tag|>' ? 'PASS' : 'FAIL'}`);

    // Test 4: Very long tag
    const longTag = "<" + "x".repeat(100) + ">";
    const tree3 = new PrefixTree([longTag]);
    const result4 = tree3.findEarliestTag("Text " + longTag + " end");
    console.log(`Test: Long tag (102 chars) - ${result4?.tag === longTag ? 'PASS' : 'FAIL'}`);

    // Test 5: Unicode characters
    const tree4 = new PrefixTree(["<🔧>", "<emoji>"]);
    const result5 = tree4.findEarliestTag("Start <🔧> end");
    console.log(`Test: Unicode - ${result5?.tag === '<🔧>' ? 'PASS' : 'FAIL'}`);
}

// Run all tests
testBasicDetection();
testPartialDetection();
testFuzzyMatching();
testPerformance();
testEdgeCases();

console.log("\nAll PrefixTree tests completed!");
