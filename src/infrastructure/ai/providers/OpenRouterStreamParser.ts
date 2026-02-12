import { AIStreamEvent } from "./AIProvider.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";
import { StreamTagDetector } from "../../../plumbing/utils/StreamTagDetector.js";

export class OpenRouterStreamParser {
    private tagDetector: StreamTagDetector;
    private llamaToolMode: boolean = false;
    private thinkingMode: boolean = false;
    private llamaBufferParts: string[] = [];
    private toolCalls: Record<number, { id: string; name: string; arguments: string }> = {};
    private indexCount: number = 0;

    constructor() {
        this.tagDetector = new StreamTagDetector();
    }

    public processContent(chunk: string): AIStreamEvent[] {
        const events: AIStreamEvent[] = [];
        let currentChunk = chunk;

        while (true) {
            const detection = this.tagDetector.process(currentChunk);
            currentChunk = ""; // Clear chunk so subsequent loops pull from detector buffer

            // 1. Process leading text (if any)
            if (detection.text) {
                if (this.llamaToolMode) {
                    this.llamaBufferParts.push(detection.text);
                } else if (this.thinkingMode) {
                    events.push({ type: "reasoning_delta", text: detection.text });
                } else {
                    events.push({ type: "content_delta", text: detection.text });
                }
            }

            // 2. Process Tag (if any)
            if (detection.type === 'tag') {
                const tag = detection.tag!;

                // --- 2a. Thought Transitions ---
                if (tag === '<thought>') {
                    this.thinkingMode = true;
                    events.push({ type: "stage_change", stage: "thinking", label: "Thinking..." });
                    continue;
                } else if (tag === '</thought>') {
                    this.thinkingMode = false;
                    events.push({ type: "stage_change", stage: "responding", label: "Generating response..." });
                    continue;
                }

                // --- 2b. Tool Transitions ---
                // Tightened: Avoid matching loose word-tags like <Plan> or <Thought>
                const isExplicitToolTag = tag === '<tool>' || tag === '<|tool_call_begin|>' || tag === '<|tool_calls_section_begin|>' || tag === '<function_calls>' || tag === '<invoke' || tag === '<tool_code>' || tag === '<tool_call>';
                const isDynamicToolTag = /<\|(?!.*_end)[\w_]{3,}\|>/.test(tag) || /^call:\d+>$/.test(tag);
                const isStartTag = isExplicitToolTag || isDynamicToolTag;

                const isEndTag = tag === '</tool>' || tag === '<|tool_call_end|>' || tag === '<|tool_calls_section_end|>' || tag === '</invoke>' || tag === '</function_calls>' || tag === '</tool_code>' || tag === '</tool_call>' || tag === '</call>';

                if (isEndTag) {
                    this.llamaBufferParts.push(tag);

                    // Validate: Check if we have actual content between section markers
                    const bufferContent = this.llamaBufferParts.join('');

                    // Check for empty tool section (begin/end with nothing useful between)
                    const hasBeginMarker = bufferContent.includes('<|tool_calls_section_begin|>') ||
                        bufferContent.includes('<|tool_call_begin|>');
                    const hasContentBetween = bufferContent.length > tag.length + 10; // Minimal content check

                    if (hasBeginMarker && !hasContentBetween) {
                        console.warn('[Marie] Empty tool section detected - no tool content between markers');
                        // Emit the buffer as content so user sees what happened
                        events.push({ type: "content_delta", text: bufferContent });
                    } else {
                        // Use robust extraction from JsonUtils
                        const extracted = JsonUtils.extractToolCall(bufferContent);

                        if (extracted) {
                            const id = extracted.id || `call_${Date.now()}_${this.indexCount}`;

                            events.push({
                                type: "tool_call_delta",
                                index: this.indexCount,
                                id: id,
                                name: extracted.name,
                                argumentsDelta: JSON.stringify(extracted.input)
                            });

                            this.toolCalls[this.indexCount] = {
                                id: id,
                                name: extracted.name,
                                arguments: JSON.stringify(extracted.input)
                            };

                            this.indexCount++;
                            this.llamaToolMode = false; // Successfully extracted
                        } else {
                            // Extraction failed - emit as content so nothing is lost
                            console.warn('[Marie] Tool extraction failed, emitting as content');
                            events.push({ type: "content_delta", text: bufferContent });
                        }
                    }

                    this.llamaBufferParts = [];
                } else if (isStartTag) {
                    this.llamaToolMode = true;
                    events.push({ type: "stage_change", stage: "calling_tool", label: "Using tool..." });
                    this.llamaBufferParts.push(tag);
                } else if (this.llamaToolMode) {
                    // Preservation: If we are in tool mode, ANY detected tag that isn't a transition
                    // must be preserved in the buffer (e.g. <parameter>)
                    this.llamaBufferParts.push(tag);
                } else {
                    // Unknown/non-transition tag: emit back as content delta
                    events.push({ type: "content_delta", text: tag });
                }

                // Continue loop to see if there are more tags in the detector buffer
                continue;
            }

            // 3. No more tags in this iteration
            break;
        }

        return events;
    }

    /**
     * Returns any tools collected during the stream.
     */
    public getCollectedToolCalls(): Record<number, { id: string; name: string; arguments: string }> {
        return this.toolCalls;
    }

    /**
     * Finalizes the parser, attempting to extract any last-minute tool calls 
     * from the remaining buffer, especially useful for truncated streams.
     */
    public finalize(fullContent: string): AIStreamEvent[] {
        const events: AIStreamEvent[] = [];

        // 1. If we are in tool mode, try to extract from buffer
        let extracted = JsonUtils.extractToolCall(this.llamaBufferParts.join(''));

        // 2. If buffer fails or wasn't applicable, attempt extraction from full content as a last resort
        // This catches models that output raw JSON without any tags at all.
        if (!extracted) {
            extracted = JsonUtils.extractToolCall(fullContent);
        }

        if (extracted) {
            const id = extracted.id || `call_${Date.now()}_${this.indexCount}_final`;
            console.log(`[Marie] Parser: Finalized extraction SUCCESS: ${extracted.name} (ID: ${id})`);

            // Avoid duplicate events if this tool was already emitted during the stream
            const alreadyCollected = Object.values(this.toolCalls).some(tc =>
                tc.name === extracted!.name &&
                (tc.arguments === JSON.stringify(extracted!.input) || tc.arguments.includes(JSON.stringify(extracted!.input)))
            );

            if (!alreadyCollected) {
                events.push({
                    type: "tool_call_delta",
                    index: this.indexCount,
                    id: id,
                    name: extracted.name,
                    argumentsDelta: JSON.stringify(extracted.input)
                });

                this.toolCalls[this.indexCount] = {
                    id: id,
                    name: extracted.name,
                    arguments: JSON.stringify(extracted.input)
                };
                this.indexCount++;
            }
        } else {
            // CRITICAL: If we were swallowing text but failed to extract a tool,
            // we MUST flush the swallowed text as content so the user doesn't lose it.
            const llamaBuffer = this.llamaBufferParts.join('');
            if (llamaBuffer.trim()) {
                events.push({ type: "content_delta", text: llamaBuffer });
            }
        }

        this.llamaToolMode = false;
        this.llamaBufferParts = [];

        return events;
    }
}
