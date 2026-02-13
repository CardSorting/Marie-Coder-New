import { StreamTagDetector } from "./monolith/plumbing/utils/StreamTagDetector.js";
import { OpenRouterStreamParser } from "./monolith/infrastructure/ai/providers/OpenRouterStreamParser.js";

async function runTests() {
    console.log("Starting Streaming Tests...\n");

    // --- Suite 1: StreamTagDetector ---
    console.log("Suite 1: StreamTagDetector (Component Level)");
    const tests = [
        {
            name: "Normal Content (No Tags)",
            chunks: ["Hello ", "world", "!"],
            expectedTags: []
        },
        {
            name: "Complete Tag in One Chunk",
            chunks: ["Hello <tool>"],
            expectedTags: ["<tool>"]
        },
        {
            name: "Split Tag (<t + ool>)",
            chunks: ["Hello <t", "ool>"],
            expectedTags: ["<tool>"]
        },
        {
            name: "Llama 3 Split Tag",
            chunks: ["Start <|tool_", "call_", "begin|> End"],
            expectedTags: ["<|tool_call_begin|>"]
        }
    ];

    let passed = 0;
    for (const test of tests) {
        console.log(`Test: ${test.name}`);
        const detector = new StreamTagDetector();
        const detectedTags: string[] = [];
        let outputText = "";

        for (const chunk of test.chunks) {
            const result = detector.process(chunk);
            if (result.type === 'tag') detectedTags.push(result.tag!);
            if (result.text) outputText += result.text;
        }

        // Verification
        const expected = test.expectedTags;
        const actual = detectedTags;
        let p = true;
        if (expected.length !== actual.length) p = false;
        else {
            for (let i = 0; i < expected.length; i++) {
                if (expected[i] !== actual[i]) p = false;
            }
        }

        if (p) {
            console.log("  PASS");
            passed++;
        } else {
            console.log(`  FAIL. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }
    console.log(`Suite 1 Results: ${passed}/${tests.length} Passed\n`);

    // --- Suite 2: OpenRouterStreamParser ---
    console.log("Suite 2: OpenRouterStreamParser (Integration Level)");

    // Test Llama 3 Tool Call Parsing
    // Llama 3 format: <|tool_call_begin|> function_name <|tool_call_argument_begin|> {args} <|tool_call_end|>

    const parserTests = [
        {
            name: "Llama 3 Full Tool Call",
            chunks: [
                "Some text ",
                "<|tool_call_begin|> functions.weather_lookup <|tool_call_argument_begin|> ",
                "{\"city\": \"Paris\"}",
                " <|tool_call_end|>"
            ],
            expectTool: "weather_lookup"
        },
        {
            name: "Llama 3 Split Across Chunks",
            chunks: [
                "Text <|tool_call_", "begin|> functions.calculator ",
                "<|tool_call_argument_", "begin|> {\"expression\": \"2+", "2\"} <|tool_call_end|>"
            ],
            expectTool: "calculator"
        },
        {
            name: "Multiple Tags in One Chunk",
            chunks: [
                "<|tool_call_begin|> tool1 <|tool_call_argument_begin|> {} <|tool_call_end|><|tool_call_begin|> tool2 <|tool_call_argument_begin|> {} <|tool_call_end|>"
            ],
            expectTool: "tool2" // The test loop picks the last one or we can check count
        },
        {
            name: "Messy Llama 3 (Plural & Missing Argument Tag)",
            chunks: [
                "<|tool_call_begin|> functions.test_tool <|tool_call_arguments_begin|> {\"key\": \"value\"} <|tool_call_end|>",
                "<|tool_call_begin|> direct_tool {\"foo\": \"bar\"} <|tool_call_end|>"
            ],
            expectTool: "direct_tool"
        },
        {
            name: "Standard Content (No Tools)",
            chunks: ["Just text"],
            expectTool: null
        },
        {
            name: "Markdown JSON (No Tags) - REPRODUCTION",
            chunks: [
                "I will read the file.\n",
                "```json\n",
                "{\"name\": \"read_file\", \"input\": {\"path\": \"foo.ts\"}}\n",
                "```"
            ],
            expectTool: "read_file"
        },
        {
            name: "Non-tool tags shouldn't be swallowed",
            chunks: ["I have a plan:\n", "<Plan>\n", "1. Search\n", "2. Replace\n", "</Plan>\n", "Proceeding now."],
            expectText: "I have a plan:\n<Plan>\n1. Search\n2. Replace\n</Plan>\nProceeding now."
        },
        {
            name: "Truncated buffer should flush as text",
            chunks: ["Starting tool...\n", "<tool>\n", "{\"name\": \"incomplete\""],
            expectText: "Starting tool...\n<tool>\n{\"name\": \"incomplete\""
        }
    ];

    passed = 0;
    for (const test of parserTests) {
        console.log(`Test: ${test.name}`);
        const parser = new OpenRouterStreamParser();
        let foundTools: string[] = [];
        let emittedText = "";

        let fullContent = "";
        for (const chunk of test.chunks) {
            fullContent += chunk;
            const events = parser.processContent(chunk);
            for (const event of events) {
                if (event.type === 'tool_call_delta') {
                    if (event.name && !foundTools.includes(event.name)) {
                        foundTools.push(event.name);
                    }
                }
                if (event.type === 'content_delta') {
                    emittedText += event.text;
                }
            }
        }

        // Finalize parser
        const finalEvents = parser.finalize(fullContent);
        for (const event of finalEvents) {
            if (event.type === 'tool_call_delta') {
                if (event.name && !foundTools.includes(event.name)) {
                    foundTools.push(event.name);
                }
            }
            if (event.type === 'content_delta') {
                emittedText += event.text;
            }
        }

        if (test.expectTool) {
            if (foundTools.includes(test.expectTool)) {
                console.log(`  PASS: Detected tool '${test.expectTool}'`);
                passed++;
            } else {
                console.log(`  FAIL: Expected '${test.expectTool}', found [${foundTools.join(', ')}]`);
            }
        } else if (test.expectText) {
            if (emittedText.trim() === test.expectText.trim()) {
                console.log("  PASS: Text emitted correctly");
                passed++;
            } else {
                console.log(`  FAIL: Text mismatch.\n  Expected: [${test.expectText.trim()}]\n  Got: [${emittedText.trim()}]`);
            }
        } else {
            if (foundTools.length === 0) {
                console.log("  PASS: No tool detected");
                passed++;
            } else {
                console.log(`  FAIL: Unexpected tool(s) found: [${foundTools.join(', ')}]`);
            }
        }
    }
    console.log(`Suite 2 Results: ${passed}/${parserTests.length} Passed\n`);
}

runTests();
