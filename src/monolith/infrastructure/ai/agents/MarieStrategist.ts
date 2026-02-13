import { MarieProgressTracker } from "../core/MarieProgressTracker.js";
import { MarieCouncil, CouncilStrategy } from "../council/MarieCouncil.js";
import { MarieResponse } from "../core/MarieResponse.js";

export class MarieStrategist {
    private comboCount: number = 0;
    private isYoloMode: boolean = true; // Default to MarieYOLO Mode (Autonomous)
    private writeToolCount: number = 0; // Counts write-class tools for diagnostic pulse
    private lastWrittenFile: string | undefined; // Last file written for diagnostic pulse
    private lastToolTime: number = Date.now(); // For combo decay detection
    private lastToolWasFailure: boolean = false; // For error-aware hype suppression

    constructor(private council: MarieCouncil) { }

    /**
     * Toggles MarieYOLO Mode.
     */
    public setYoloMode(enabled: boolean) {
        this.isYoloMode = enabled;
    }

    /**
     * Checks if MarieYOLO Mode is active.
     */
    public get isYolo() {
        return this.isYoloMode;
    }

    /**
     * The Council convenes. Task execution begins.
     */
    public hypeStart(tracker: MarieProgressTracker) {
        // Council Silence Protocol: One declaration per phase
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: "The Council convenes. Execution begins.",
            elapsedMs: tracker.elapsedMs()
        });
    }

    /**
     * The Council observes tool execution and narrates the action.
     */
    public announceToolStart(tracker: MarieProgressTracker, toolName: string, input?: any) {
        let action = "";
        switch (toolName) {
            case 'write_to_file':
            case 'replace_file_content':
            case 'multi_replace_file_content':
                action = "The Council inscribes changes to the tapestry.";
                break;
            case 'run_command':
                action = "The Council invokes the shell oracle.";
                break;
            case 'search_web':
                action = "The Council seeks knowledge from the external ether.";
                break;
            case 'view_file':
            case 'read_file':
                action = "The Council examines the scrolls.";
                break;
            case 'mcp_stripe_create_customer':
            case 'mcp_stripe_create_product':
                action = "The Council transacts with the merchant spirits.";
                break;
        }

        if (action) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: action,
                elapsedMs: tracker.elapsedMs()
            });
        }
    }

    /**
     * Determines if a tool call should be auto-approved.
     * Uses tiered risk assessment instead of a simple boolean.
     * Safe tools always auto-approve. Moderate tools auto-approve in YOLO.
     * Dangerous tools require high flow state + combo streak.
     */
    public async shouldAutoApprove(toolName: string, input: any): Promise<boolean> {
        // Tier 1: Safe (read-only, analysis) — always auto-approve
        const safeTier = [
            'read_file', 'view_file', 'list_dir', 'grep_search', 'search_web',
            'get_file_diagnostics', 'get_folder_structure', 'find_symbol_references',
            'get_file_dependencies', 'check_code_health', 'get_code_complexity',
            'get_file_history', 'get_symbol_definition', 'list_workspace_symbols',
            'get_workspace_joy_map', 'check_ripple_health', 'trace_data_flow',
            'predict_refactor_ripple', 'check_architectural_rules',
            'analyze_agent_telemetry', 'get_git_context', 'map_project_context',
            'pin_context', 'simulate_semantic_edit', 'extract_component_api',
            'generate_evolution_chronicle', 'audit_architectural_integrity',
            'propose_logic_clustering', 'diagnose_action_failure',
            'perform_strategic_planning', 'update_run_objectives',
            'augment_roadmap', 'checkpoint_pass', 'complete_task_ritual',
            'cherish_file', 'fold_file', 'run_test_suite', 'verify_workspace_health'
        ];
        if (safeTier.includes(toolName)) return true;

        // Not in YOLO mode? All non-safe tools require manual approval.
        if (!this.isYoloMode) return false;

        // Phase 6: Flow-Inhibited YOLO
        // If flow is critically low (< 20), disable auto-approval for non-safe tools.
        // Failure spirals require human huddles/oversight.
        const flow = this.council.getFlowState();
        if (flow < 20) {
            return false;
        }

        // Tier 2: Moderate (writes, commands) — auto-approve in YOLO mode
        const moderateTier = [
            'write_to_file', 'replace_file_content', 'multi_replace_file_content',
            'run_command', 'sprout_new_module', 'execute_semantic_rename',
            'execute_semantic_move', 'generate_migration_plan',
            'generate_architectural_decision'
        ];
        if (moderateTier.includes(toolName)) return true;

        // Tier 3: Dangerous (deletions, destructive) — require high flow + combo + speed
        const memory = this.council.getMemory();
        const avgSpeed = this.council.getAverageToolSpeed();
        const streak = this.council.getSuccessStreak();

        // Speed-weighted trust: fast execution + high streak = maximum trust
        if (memory.flowState > 80 && this.comboCount > 5) {
            return true; // Earned trust through sustained high performance
        }
        // Extra trust path: blazing speed + high streak even at moderate flow
        if (avgSpeed > 0 && avgSpeed < 1000 && streak > 10 && memory.flowState > 50) {
            return true; // Speed-earned trust
        }

        // Default: require manual approval for unknown/dangerous tools
        return false;
    }

    /**
     * Tracks a successful tool execution. The Council records the success.
     */
    public trackSuccess(tracker: MarieProgressTracker, toolName: string, durationMs: number) {
        // Combo Decay: halve combo if > 60s since last tool
        const timeSinceLast = Date.now() - this.lastToolTime;
        if (timeSinceLast > 60000 && this.comboCount > 0) {
            this.comboCount = Math.floor(this.comboCount / 2);
        }
        this.lastToolTime = Date.now();

        this.comboCount++;

        // Record success in Council for momentum detection
        this.council.recordSuccess();

        // Speed-Weighted Flow Delta
        let flowDelta = 10;
        if (durationMs < 500) flowDelta = 15;
        else if (durationMs < 2000) flowDelta = 10;
        else if (durationMs > 5000) flowDelta = 3;
        this.council.updateFlowState(flowDelta);

        // The Council records success in the cosmic ledger
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `The Council confirms success. The weave strengthens.`,
            elapsedMs: tracker.elapsedMs()
        });

        this.lastToolWasFailure = false;
    }

    /**
     * Resets the combo counter on failure. The Council records the stumble.
     */
    public trackFailure(tracker: MarieProgressTracker, toolName?: string, filePath?: string) {
        // Record execution in Council with failure context
        if (toolName) {
            this.council.recordToolExecution(toolName, 0, false, filePath);
        }

        // The Council records the stumble in the cosmic ledger
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `The Council notes a disturbance in the pattern. The weave requires mending.`,
            elapsedMs: tracker.elapsedMs()
        });

        this.comboCount = 0;
        this.lastToolWasFailure = true;
    }

    /**
     * The Council renders judgment on the completed run.
     */
    public celebrateVictory(tracker: MarieProgressTracker) {
        const flow = this.council.getFlowState();
        const streak = this.council.getSuccessStreak();

        // Council Judgment: Single declaration based on flow
        let judgment: string;
        if (flow >= 80 && streak >= 10) {
            judgment = "The Council has spoken. The work is true.";
        } else if (flow >= 50) {
            judgment = "The pattern holds. The system breathes.";
        } else {
            judgment = "The Council acknowledges this work with satisfaction.";
        }

        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: judgment,
            elapsedMs: tracker.elapsedMs()
        });
    }

    private static readonly FILE_PATH_REGEX = /(?:src\/[\w\/\-\.]+\.\w+)/g;

    /**
     * HIVE MIND LOGIC:
     * Analyzes history and memory to inject tools BEFORE the model thinks.
     * This allows the swarm to be proactive (e.g. reading files, fixing errors).
     */
    public async injectProactiveTools(
        tracker: MarieProgressTracker,
        history: any[],
        pendingObjectiveCount: number = 0
    ): Promise<any[]> {
        if (!this.isYoloMode) return [];

        // Cool-down: suppress proactive injection after PANIC recovery
        if (this.council.isInCoolDown()) return [];

        const memory = this.council.getMemory();
        const toolsToInject: any[] = [];

        // Find the last assistant message by scanning backward (avoids copying + reversing the entire array)
        let lastAssistantMsg: any = undefined;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'assistant') { lastAssistantMsg = history[i]; break; }
        }

        // Heuristic 1: Context Recovery
        // If the last assistant message mentions a file path we haven't recently read, pre-read it.
        if (lastAssistantMsg) {
            const response = MarieResponse.wrap(lastAssistantMsg.content);
            const content = response.getText();

            // Extract file paths from the text (simple heuristic: anything that looks like src/...)
            const mentions = content.match(MarieStrategist.FILE_PATH_REGEX) || [];
            for (const filePath of mentions.slice(0, 2)) { // Max 2 pre-reads
                if (!this.council.hasRecentlyRead(filePath)) {
                    toolsToInject.push({
                        name: 'read_file',
                        input: { path: filePath },
                        reason: `Context Recovery: Pre-reading ${filePath}`
                    });
                }
            }
        }

        // Heuristic 2: Error Hotspot Defense
        // If the current active file has error hotspot count >= 2, run diagnostics first.
        const activeFile = tracker.getRun().activeFilePath;
        if (activeFile && this.council.getErrorCount(activeFile) >= 2) {
            toolsToInject.push({
                name: 'get_file_diagnostics',
                input: { path: activeFile },
                reason: `Error Hotspot Defense: ${activeFile} has ${this.council.getErrorCount(activeFile)} recent errors`
            });
        }

        // Heuristic 3: Auto-Checkpoint / Streak Suggestion
        // At combo ≥ 8, suggest checkpointing. At ≥ 15, strongly recommend committing.
        // Council Silence Protocol: No streak announcements. The Council observes.

        // Heuristic 4: Stale Context Guard
        // If the last file context is > 5 tool calls old, suggest re-reading it.
        const recentFiles = this.council.getRecentFiles();
        const toolHistory = this.council.getToolHistory();
        if (recentFiles.length > 0 && toolHistory.length > 5) {
            const lastFile = recentFiles[recentFiles.length - 1];
            // Check if any read tool appeared in the last 5 tool calls
            const last5 = toolHistory.slice(-5);
            const hasRecentRead = last5.some(t => ['read_file', 'view_file'].includes(t));
            if (!hasRecentRead && lastFile) {
                toolsToInject.push({
                    name: 'read_file',
                    input: { path: lastFile },
                    reason: `Stale Context Guard: Re-reading ${lastFile} (no reads in last 5 tools)`
                });
            }
        }

        // Heuristic 5: Diagnostic Pulse
        // After every 5th write-class tool, inject diagnostics on the last written file.
        if (this.writeToolCount > 0 && this.writeToolCount % 5 === 0 && this.lastWrittenFile) {
            toolsToInject.push({
                name: 'get_file_diagnostics',
                input: { path: this.lastWrittenFile },
                reason: `Diagnostic Pulse: Auto-checking ${this.lastWrittenFile} after ${this.writeToolCount} writes`
            });
        }

        // Heuristic 6: Tunnel Vision Detection
        // Council Silence Protocol: No tunnel vision warnings. The Council observes.

        // Heuristic 7: Predictive Failure Guard (ALL write-class tools)
        // Council Silence Protocol: No predictive failure announcements.

        // Heuristic 8: Write-Burst Detection
        // If 3+ writes happened in the last 5 tool calls without any reads, force a read
        const recent5 = this.council.getToolHistory().slice(-5);
        const recentWrites = recent5.filter(t => ['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(t));
        const recentReads = recent5.filter(t => ['read_file', 'view_file', 'get_file_diagnostics'].includes(t));
        if (recentWrites.length >= 3 && recentReads.length === 0 && this.lastWrittenFile) {
            toolsToInject.push({
                name: 'view_file',
                input: { path: this.lastWrittenFile },
                reason: `Write-Burst Guard: ${recentWrites.length} writes without a read. Verifying ${this.lastWrittenFile}`
            });
            // Council Silence Protocol: No write-burst announcements.
        }

        // Heuristic 9: Creative Muse (Stagnation Detection)
        // Council Silence Protocol: No stagnation announcements.

        return toolsToInject;
    }

    /**
     * Phase 6: Objective Ranker
     * Sorts pending objectives by proximity to the current active file path.
     * Encourages logical clustering of work.
     */
    public rankObjectivesByProximity(objectives: any[], activeFile: string | undefined): any[] {
        if (!activeFile) return objectives;

        return [...objectives].sort((a, b) => {
            const getScore = (label: string) => {
                const common = this.getCommonPrefixLength(activeFile, label);
                return common;
            };
            return getScore(b.label) - getScore(a.label);
        });
    }

    private getCommonPrefixLength(s1: string, s2: string): number {
        let i = 0;
        while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++;
        return i;
    }

    /**
     * Assesses the current turn by feeding tool history and error count to the Council.
     * Returns the Council's recommended strategy for the Engine to act on.
     */
    public assessTurn(errorCount: number): CouncilStrategy {
        const toolHistory = this.council.getToolHistory();
        const strategy = this.council.assessHealth(toolHistory, errorCount);

        // Mood auto-correction based on flow
        const flow = this.council.getFlowState();
        if (flow < 30) {
            this.council.setMood('CAUTIOUS');
        } else if (flow > 80) {
            this.council.setMood('AGGRESSIVE');
        } else if (flow >= 30 && flow <= 50) {
            this.council.setMood('INQUISITIVE');
        } else if (flow > 50 && strategy === 'HYPE') {
            this.council.setMood('ZEN'); // HYPE + high flow = zen confidence
        }

        return strategy;
    }

    /**
     * The Council announces its strategic direction.
     */
    public announceStrategy(tracker: MarieProgressTracker, strategy: CouncilStrategy) {
        let proclamation = "";
        switch (strategy) {
            case 'EXECUTE':
                proclamation = "The Council decrees: Execute without hesitation.";
                break;
            case 'RESEARCH':
                proclamation = "The Council decrees: Seek knowledge before action.";
                break;
            case 'DEBUG':
                proclamation = "The Council decrees: Mend the broken threads.";
                break;
            case 'HYPE':
                proclamation = "The Council decrees: Momentum is sacred.";
                break;
            case 'PANIC':
                proclamation = "The Council decrees: Halt. Assess. Recover.";
                break;
        }

        if (proclamation) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: proclamation,
                elapsedMs: tracker.elapsedMs()
            });
        }
    }

    /**
     * Records the last written file for diagnostic pulse tracking.
     */
    public recordWrite(filePath: string) {
        this.lastWrittenFile = filePath;
        this.writeToolCount++;
    }

    /**
     * Gets the current combo count (for external consumers).
     */
    public getComboCount(): number {
        return this.comboCount;
    }
}
