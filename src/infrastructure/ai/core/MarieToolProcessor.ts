import * as vscode from "vscode";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { RitualService } from "../../../domain/joy/RitualService.js";
import { getStringArg } from "../../tools/ToolUtils.js";
import { getErrorMessage } from "../../../plumbing/utils/ErrorUtils.js";
import { MarieGhostService } from "../../../services/MarieGhostService.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { withRetry, RetryConfig } from "../../../plumbing/utils/RetryUtils.js";
import { backupFile, restoreFile, clearBackups, rollbackAll } from "../../../plumbing/filesystem/FileService.js";

/**
 * Handles the validation and execution of AI tool calls.
 */
export class MarieToolProcessor {
    private static readonly RETRY_CONFIG = new RetryConfig();
    private failureCircuitBreaker: Map<string, { count: number, lastInput: string }> = new Map();
    constructor(
        private toolRegistry: ToolRegistry,
        private tracker: MarieProgressTracker,
        private approvalRequester: (name: string, input: any, diff?: { old: string, new: string }) => Promise<boolean>,
        private council?: MarieCouncil
    ) { }

    public async process(toolCall: { id: string, name: string, input: any, repaired?: boolean }, signal?: AbortSignal): Promise<string> {
        const { name, start_line, end_line, repaired } = toolCall as any;
        const input = toolCall.input;
        const inputStr = JSON.stringify(input);

        if (repaired) {
            this.tracker.recordHeuristicFix(toolCall.name);
        }

        // SUB-ATOMIC INTEGRITY: Tool Circuit Breaker
        const failureState = this.failureCircuitBreaker.get(name);
        if (failureState && failureState.lastInput === inputStr && failureState.count >= 3) {
            this.recordError(name, `CIRCUIT BREAKER: ${name} has failed 3 times with the same input. Possible death spiral.`, true);
            return `HALT: Protocol Violation. Circuit breaker tripped for ${name} after repeated failures. Diversify your approach immediately.`;
        }

        const tool = this.toolRegistry.getTool(toolCall.name);

        if (!tool) {
            this.recordError(toolCall.name, "Tool not found");
            return `Tool ${toolCall.name} not found`;
        }

        try {
            const validationError = this.validate(toolCall.name, input);
            if (validationError) {
                this.recordError(toolCall.name, validationError);
                return `Error: ${validationError}`;
            }

            if (tool.isDestructive) {
                const approved = await this.requestApproval(toolCall.name, input);
                if (!approved) {
                    this.recordError(toolCall.name, "User denied approval");
                    return "User denied this action.";
                }
            }

            const toolStartTime = Date.now();
            console.log(`[Marie] Tool ${toolCall.name} starting. ID: ${toolCall.id}`);

            const sanitizedInput = { ...input };
            // Hygiene: Truncate massive fields to prevent log bloat
            if (typeof sanitizedInput.content === 'string' && sanitizedInput.content.length > 500) {
                sanitizedInput.content = sanitizedInput.content.substring(0, 500) + '...[TRUNCATED]';
            }
            if (typeof sanitizedInput.replacementContent === 'string' && sanitizedInput.replacementContent.length > 500) {
                sanitizedInput.replacementContent = sanitizedInput.replacementContent.substring(0, 500) + '...[TRUNCATED]';
            }

            this.tracker.emitEvent({
                type: 'tool',
                runId: this.tracker.getRun().runId,
                phase: 'start',
                name: toolCall.name,
                input: sanitizedInput,
                elapsedMs: this.tracker.elapsedMs()
            });

            const run = this.tracker.getRun();
            run.activeToolName = toolCall.name;
            run.lastToolName = toolCall.name;
            this.tracker.emitProgressUpdate();

            this.tracker.recordToolUsage(toolCall.name);

            // TRANSACTIONAL INTEGRITY: Backup files before destructive operations
            const impactedFiles: string[] = [];
            if (tool.isDestructive) {
                const p = input.path || input.targetFile || input.file || input.filePath;
                if (p && typeof p === 'string') {
                    impactedFiles.push(p);
                    await backupFile(p);
                }
                // Custom handling for multi-file tools
                if (name === 'execute_semantic_move' && input.dest) {
                    impactedFiles.push(input.dest);
                    await backupFile(input.dest);
                }
            }

            let result = await withRetry(
                () => tool.execute(input, undefined, signal),
                MarieToolProcessor.RETRY_CONFIG,
                `Tool: ${toolCall.name}`,
                signal
            );

            // PROACTIVE TRUNCATION: Source-level safety cap (512KB)
            if (typeof result === 'string' && result.length > 512 * 1024) {
                console.warn(`[MarieStability] Tool ${toolCall.name} output exceeded 512KB. Truncating at source.`);
                result = result.substring(0, 512 * 1024) + "\n\n🚨 STABILITY ALERT: Output truncated at 512KB to prevent Extension Host lag.";
            } else if (result && typeof result === 'object') {
                const json = JSON.stringify(result);
                if (json.length > 512 * 1024) {
                    console.warn(`[MarieStability] Tool ${toolCall.name} JSON output exceeded 512KB. Truncating at source.`);
                    // We can't easily truncate an object without potentially breaking downstream logic, 
                    // so we convert to a truncated string if it's too massive.
                    result = json.substring(0, 512 * 1024) + "\n\n🚨 STABILITY ALERT: JSON output truncated at 512KB.";
                }
            }

            // TRANSACTIONAL SUCCESS: Clear backups for this tool/turn
            clearBackups();

            // CIRCUIT BREAKER FLUSH: Tool succeeded
            this.failureCircuitBreaker.delete(name);

            const toolDurationMs = Date.now() - toolStartTime;
            console.log(`[Marie] Tool ${toolCall.name} completed in ${toolDurationMs}ms.`);

            this.tracker.emitEvent({
                type: 'tool',
                runId: this.tracker.getRun().runId,
                phase: 'complete',
                name: toolCall.name,
                message: typeof result === 'string' ? result.substring(0, 100) : 'Completed',
                elapsedMs: this.tracker.elapsedMs()
            });

            run.activeToolName = undefined;
            run.lastToolName = toolCall.name;
            this.tracker.emitProgressUpdate();

            if (result && typeof result === 'object') {
                this.applyUpdate(result, toolCall.name);
            }

            // Phase 11: Code Impact Analysis
            this.recordCodeStats(toolCall.name, input);

            // Council: Record execution with duration for global analytics
            if (this.council) {
                const execFile = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;
                this.council.recordToolExecution(toolCall.name, toolDurationMs, true, execFile);
            }

            // Phase 7: Track sentimental metrics
            const runMetrics = this.tracker.getRun();
            if (!runMetrics.metrics) runMetrics.metrics = { cherishedFiles: [], releasedDebtCount: 0 };

            if (toolCall.name === 'cherish_file' && input && typeof input === 'object') {
                try {
                    const p = getStringArg(input, 'path');
                    if (p && !runMetrics.metrics.cherishedFiles.includes(p)) {
                        runMetrics.metrics.cherishedFiles.push(p);
                        this.tracker.emitProgressUpdate(`File cherished: ${p.split('/').pop()}`);
                    }
                } catch (e) {
                    console.warn("Failed to extract path for cherish_file metric", e);
                }
            } else if (toolCall.name === 'discard_file') {
                runMetrics.metrics.releasedDebtCount++;
                this.tracker.emitProgressUpdate('Technical debt released 🍂');
            }

            return typeof result === 'string' ? result : JSON.stringify(result);

        } catch (error) {
            const rawMsg = getErrorMessage(error);
            const isTerminal = this.isTerminalError(name, rawMsg);
            const run = this.tracker.getRun();
            run.activeToolName = undefined;
            run.lastToolName = name;
            this.tracker.emitProgressUpdate();

            // TRANSACTIONAL RECOVERY: Restore state on failure
            try {
                console.log(`[Marie] Initiating systemic rollback for tool failure: ${name}`);
                await rollbackAll();
            } catch (restoreError) {
                console.error(`[Marie] Transactional recovery failed: ${restoreError}`);
            }

            // CIRCUIT BREAKER RECORD: Increment failure count for same tool/input
            const state = this.failureCircuitBreaker.get(name) || { count: 0, lastInput: inputStr };
            if (state.lastInput === inputStr) {
                state.count++;
            } else {
                state.count = 1;
                state.lastInput = inputStr;
            }
            this.failureCircuitBreaker.set(name, state);

            this.recordError(name, rawMsg, isTerminal);
            console.error(`[Marie] Tool ${name} failed: ${rawMsg}`);

            if (isTerminal || state.count >= 3) {
                // Council: Record failed execution for tracking
                if (this.council) {
                    const failFile = toolCall.input?.path || toolCall.input?.targetFile || toolCall.input?.file;
                    this.council.recordToolExecution(name, 0, false, failFile);
                }
                const circuitBreakerSuffix = state.count >= 3 ? " [CIRCUIT BREAKER TRIPPED]" : "";
                return `HALT: Critical protocol or parsing failure in ${name}: ${rawMsg}${circuitBreakerSuffix}`;
            }

            // Constructive Feedback Layer
            const msgParts: string[] = [`Error executing ${name}: ${rawMsg}`];

            // Council-Aware Error Hotspot Hint (with Error Memory)
            if (this.council) {
                const toolInput = toolCall.input;
                const filePath = toolInput?.path || toolInput?.targetFile || toolInput?.file;
                if (filePath) {
                    const hotspotCount = this.council.getErrorCount(filePath);
                    if (hotspotCount >= 2) {
                        msgParts.push(`\n\n🔥 ERROR HOTSPOT: This file (${filePath}) has failed ${hotspotCount} times. Strongly consider a DIFFERENT approach or file.`);

                        // Include recent error messages for diagnostic context
                        const recentErrors = this.council.getErrorMessages(filePath);
                        if (recentErrors.length > 0) {
                            msgParts.push(`\n📋 Previous errors on this file:`);
                            for (const err of recentErrors.slice(-2)) {
                                msgParts.push(`\n  - ${err}`);
                            }
                        }
                    }
                }
                const flow = this.council.getFlowState();
                if (flow < 30) {
                    msgParts.push(`\n⚠️ Low flow state (${flow}/100). Simplify your next action.`);
                }

                // Mood-aware hint
                const mood = this.council.getMood();
                if (mood === 'CAUTIOUS') {
                    msgParts.push(`\n🛡️ Council mood: CAUTIOUS. Read before writing. Verify before acting.`);
                }
            }

            if (rawMsg.includes("ENOENT") || rawMsg.includes("no such file")) {
                msgParts.push(`\n\n💡 Reflection Hint: The file or directory does not exist. Use 'list_dir' to verify the path or 'grep_search' to locate it.`);
            } else if (rawMsg.includes("target content not found")) {
                msgParts.push(`\n\n💡 Reflection Hint: The content you tried to replace wasn't found. Use 'read_file' (without line numbers) to verify the current file content before retrying.`);
            } else if (rawMsg.includes("Input is required")) {
                msgParts.push(`\n\n💡 Reflection Hint: You missed a required argument. Check the tool schema.`);
            } else {
                msgParts.push(`\n\n💡 Reflection Hint: Please analyze why this failed and propose a diverse alternative strategy.`);
            }

            if (state.count > 1) {
                msgParts.push(`\n\n⚠️ REPEATED FAILURE: This exact tool call has failed ${state.count} times. If it fails again, the circuit breaker will trip and you will be forced to change strategy.`);
            }

            return msgParts.join('');
        }
    }

    private isTerminalError(toolName: string, message: string): boolean {
        // Critical ritual failures are terminal
        if (toolName === 'checkpoint_pass' && message.includes('failed')) return true;

        // Repeated parsing failures (marked by provider) are terminal
        if (message.includes('Failed to parse tool arguments')) return true;

        return false;
    }

    private validate(name: string, input: any): string | null {
        if (!input || typeof input !== 'object') return "Input must be a valid object";

        const tool = this.toolRegistry.getTool(name);
        if (!tool) return `Tool "${name}" not found in registry`;

        // Check required fields from schema
        const schema = tool.input_schema;
        if (schema.required && Array.isArray(schema.required)) {
            const missing = schema.required.filter(field => !(field in input));
            if (missing.length > 0) {
                return `Missing required fields: ${missing.join(', ')}`;
            }
        }

        // Security: Workspace Boundary Enforcement
        const pathFields = ['path', 'targetFile', 'file', 'sourcePath', 'targetPath', 'directoryPath'];
        for (const field of pathFields) {
            if (input[field] && typeof input[field] === 'string') {
                const pathError = this.validatePath(input[field]);
                if (pathError) return pathError;
            }
        }

        return null;
    }

    private validatePath(p: string): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return null; // No workspace, no boundary to enforce

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        // Basic check for drive-letter-relative or absolute paths that bypass the root
        const normalized = p.startsWith('~') ? p : (p.includes(':') ? p : p); // PathResolver handles ~ expansion

        // We'll trust resolvePath but check the result against workspace root if possible
        // Since ToolProcessor doesn't have easy access to resolvePath without importing, 
        // we'll do a simple string check for now, matching FileService's logic.
        // If the path starts with / or \ but NOT workspaceRoot, it's a breach.

        if (p.startsWith('/') || (p.length > 1 && p[1] === ':')) {
            if (!p.startsWith(workspaceRoot)) {
                return `Security Error: Path ${p} is outside the workspace boundary (${workspaceRoot}). Access denied. 🛑`;
            }
        }

        return null;
    }

    private async requestApproval(name: string, input: any): Promise<boolean> {
        const run = this.tracker.getRun();
        run.waitingForApproval = true;
        this.tracker.emitProgressUpdate(`Awaiting approval for ${name}`);

        // Try to construct a diff for preview
        let diff: { old: string, new: string } | undefined;
        if (name === 'replace_in_file' && input.targetContent && input.replacementContent) {
            diff = { old: input.targetContent, new: input.replacementContent };
        } else if (name === 'write_file' && input.content) {
            diff = { old: '', new: input.content };
        }

        // Use the callback to request approval via the frontend
        const approved = await this.approvalRequester(name, input, diff);

        run.waitingForApproval = false;
        return approved;
    }

    private applyUpdate(update: any, toolName: string) {
        const run = this.tracker.getRun();
        if (update.context) run.currentContext = update.context;
        if (update.activeObjectiveId) run.activeObjectiveId = update.activeObjectiveId;
        if (update.lifecycleStage) run.lifecycleStage = update.lifecycleStage;
        if (update.totalPasses !== undefined) run.totalPasses = update.totalPasses;
        if (update.currentPass !== undefined) run.currentPass = update.currentPass === null ? undefined : update.currentPass;
        if (update.passFocus !== undefined) run.passFocus = update.passFocus;
        if (update.passHistory) {
            run.passHistory = [...(run.passHistory || []), ...update.passHistory];
        }
        if (update.metrics) {
            run.metrics = {
                cherishedFiles: Array.from(new Set([...(run.metrics?.cherishedFiles || []), ...(update.metrics.cherishedFiles || [])])),
                releasedDebtCount: (run.metrics?.releasedDebtCount || 0) + (update.metrics.releasedDebtCount || 0)
            };
        }

        // Auto-increment currentPass on checkpoint_pass or if specifically requested
        if (toolName === 'checkpoint_pass' && run.currentPass !== undefined) {
            run.currentPass++;
        }

        if (run.currentPass !== undefined && run.totalPasses !== undefined && run.passFocus) {
            this.tracker.emitPassTransition(run.currentPass, run.totalPasses, run.passFocus);
        } else {
            this.tracker.emitProgressUpdate();
        }

        // Handle Roadmap Augmentation
        if (toolName === 'augment_roadmap' && update.totalPasses !== undefined) {
            run.totalPasses = (run.totalPasses || 0) + update.totalPasses;
            this.tracker.emitProgressUpdate(`Roadmap calibrated: ${run.totalPasses} total passes.`);
        }
    }

    private countLines(str: string): number {
        if (!str) return 0;
        let count = 1; // Start at 1 for single line
        let pos = -1;
        while ((pos = str.indexOf('\n', pos + 1)) !== -1) {
            count++;
        }
        return count;
    }

    private recordCodeStats(toolName: string, input: any) {
        try {
            if (toolName === 'write_to_file') {
                // Counts as strict addition
                const lines = this.countLines(input.content);
                const path = input.targetFile || input.file; // Handle varying schemas
                if (path) this.tracker.recordFileChange(path, lines, 0);
            } else if (toolName === 'replace_file_content') {
                const added = this.countLines(input.replacementContent);
                const removed = this.countLines(input.targetContent);
                const path = input.targetFile || input.file;
                if (path) this.tracker.recordFileChange(path, added, removed);
            } else if (toolName === 'multi_replace_file_content' && Array.isArray(input.replacementChunks)) {
                let added = 0;
                let removed = 0;
                for (const chunk of input.replacementChunks) {
                    added += this.countLines(chunk.replacementContent);
                    removed += this.countLines(chunk.targetContent);
                }
                const path = input.targetFile || input.file;
                if (path) this.tracker.recordFileChange(path, added, removed);
            }
        } catch (e) {
            console.warn("Failed to record code stats", e);
        }
    }

    private recordError(name: string, message: string, isTerminal: boolean = false) {
        this.tracker.emitEvent({
            type: 'tool',
            runId: this.tracker.getRun().runId,
            phase: 'error',
            name,
            message: (isTerminal ? "[TERMINAL] " : "") + message,
            elapsedMs: this.tracker.elapsedMs()
        });
    }
}
