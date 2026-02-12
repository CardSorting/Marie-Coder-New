import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieToolProcessor } from "./MarieToolProcessor.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { StringUtils } from "../../../plumbing/utils/StringUtils.js";
import { JsonUtils } from "../../../plumbing/utils/JsonUtils.js";

/**
 * ATMOSPHERIC SEPARATION: MarieToolMender
 * Handles fuzzy hallucination repair for tool names and file paths.
 */
export class MarieToolMender {
    constructor(
        private toolRegistry: ToolRegistry,
        private council: MarieCouncil
    ) { }

    /**
     * Attempts to automatically correct minor typos in tool calls using Levenshtein similarity.
     */
    public async performFuzzyRepair(
        toolCall: any,
        error: string,
        tracker: MarieProgressTracker,
        processor: MarieToolProcessor,
        cachedSnapshot?: any,
        signal?: AbortSignal
    ): Promise<string | null> {
        // 1. Tool Name Repair
        const registeredTools = this.toolRegistry.getTools();
        let bestToolName = '';
        let bestToolSim = 0;

        for (const t of registeredTools) {
            const sim = StringUtils.similarity(toolCall.name, t.name);
            if (sim > bestToolSim) {
                bestToolSim = sim;
                bestToolName = t.name;
            }
        }

        const bestToolMatch = bestToolName ? { name: bestToolName, similarity: bestToolSim } : null;

        if (bestToolMatch && bestToolMatch.similarity > 0.8 && bestToolMatch.name !== toolCall.name) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🩹 FUZZY REPAIR: Fixing tool name hallucination: ${toolCall.name} -> ${bestToolMatch.name}`,
                elapsedMs: tracker.elapsedMs()
            });
            toolCall.name = bestToolMatch.name;
            return await processor.process(toolCall, signal);
        }

        // 2. Path Repair (if "File not found")
        if (error.includes('ENOENT') || error.includes('not found')) {
            const problematicPath = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;
            if (problematicPath && typeof problematicPath === 'string') {
                const recentFiles = (cachedSnapshot || this.council.getSnapshot()).recentFiles || [];
                let bestPathName = '';
                let bestPathSim = 0;

                for (const f of recentFiles) {
                    const sim = StringUtils.similarity(problematicPath, f);
                    if (sim > bestPathSim) {
                        bestPathSim = sim;
                        bestPathName = f;
                    }
                }

                const bestPathMatch = bestPathName ? { path: bestPathName, similarity: bestPathSim } : null;

                if (bestPathMatch && bestPathMatch.similarity > 0.85 && bestPathMatch.path !== problematicPath) {
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: `🩹 FUZZY REPAIR: Fixing path hallucination: ${problematicPath} -> ${bestPathMatch.path}`,
                        elapsedMs: tracker.elapsedMs()
                    });

                    if (toolCall.input.path) toolCall.input.path = bestPathMatch.path;
                    if (toolCall.input.targetFile) toolCall.input.targetFile = bestPathMatch.path;
                    if (toolCall.input.file) toolCall.input.file = bestPathMatch.path;

                    return await processor.process(toolCall, signal);
                }
            }
        }

        return null;
    }

    /**
     * ATMOSPHERIC REPAIR: Fixes malformed JSON strings from the model (e.g. missing commas, unquoted keys).
     */
    public repairJsonString(json: string): string {
        const { repaired } = JsonUtils.repairJsonDetailed(json);
        try {
            JSON.parse(repaired);
            return repaired;
        } catch {
            // Failed to repair, return original so caller can handle error paths explicitly.
            return json;
        }
    }
}
