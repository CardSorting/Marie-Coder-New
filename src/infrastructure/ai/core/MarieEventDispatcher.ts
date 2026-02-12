import * as vscode from "vscode";
import { ProgressUpdate } from "../../../domain/marie/MarieTypes.js";
import { AIStreamEvent } from "../providers/AIProvider.js";
import { MarieProgressTracker } from "./MarieProgressTracker.js";
import { MarieGhostService } from "../../../services/MarieGhostService.js";

/**
 * Routes raw AI events to the appropriate domain and UI handlers.
 */
export class MarieEventDispatcher {
    private toolNames = new Map<string, string>();
    private pendingContent: string = '';
    private pendingToolDeltas: Map<string, string> = new Map();
    private throttleTimer: NodeJS.Timeout | null = null;
    private toolThrottleTimer: NodeJS.Timeout | null = null;
    private readonly THROTTLE_MS = 50;
    private readonly TOOL_THROTTLE_MS = 100;

    constructor(private tracker: MarieProgressTracker) { }

    public dispatch(event: AIStreamEvent) {
        const run = this.tracker.getRun();

        switch (event.type) {
            case 'stage_change':
                this.flushContent(); // Flush any pending content before stage change
                this.updateStage(event);
                break;

            case 'content_delta':
                this.handleContentDelta(event, run);
                break;

            case 'tool_call_delta':
                this.handleToolDelta(event, run);
                break;

            case 'usage':
                this.flushContent();
                run.usage = event.usage;
                this.tracker.emitEvent({
                    type: 'usage',
                    runId: run.runId,
                    usage: event.usage,
                    elapsedMs: this.tracker.elapsedMs(),
                });
                break;
        }
    }

    private handleContentDelta(event: any, run: any) {
        this.pendingContent += event.text;

        if (!this.throttleTimer) {
            this.throttleTimer = setTimeout(() => {
                this.flushContent();
            }, this.THROTTLE_MS);
        }
    }

    private flushContent() {
        if (!this.pendingContent) return;

        const text = this.pendingContent;
        this.pendingContent = '';
        this.throttleTimer = null;

        const run = this.tracker.getRun(); // Re-fetch run to be safe
        this.tracker.emitStream(text);
        this.tracker.emitEvent({
            type: 'content_delta',
            runId: run.runId,
            text: text,
            elapsedMs: this.tracker.elapsedMs(),
        });
    }

    private activeToolDelta(event: any, run: any) {
        this.flushContent(); // Flush content before tool activity

        if (event.argumentsDelta) {
            const id = event.id || 'default';
            if (event.name) {
                if (!this.toolNames.has(id)) {
                    this.toolNames.set(id, event.name);
                }
            }
            const name = this.toolNames.get(id) || '';

            this.tracker.emitEvent({
                type: 'tool_delta',
                runId: run.runId,
                name: name,
                inputDelta: event.argumentsDelta,
                elapsedMs: this.tracker.elapsedMs(),
            });

            MarieGhostService.handleDelta(id, name, event.argumentsDelta);

            // Optimization: Only run regex if keywords are present
            if (event.argumentsDelta.includes('path') || event.argumentsDelta.includes('file')) {
                const pathMatch = event.argumentsDelta.match(/"path"\s*:\s*"([^"]*)"/);
                if (pathMatch) {
                    run.activeFilePath = pathMatch[1];
                    this.tracker.emitProgressUpdate();
                }
            }
        }
    }

    public clear() {
        this.toolNames.clear();
        this.flushContent();
        this.flushToolDeltas();
    }

    private handleToolDelta(event: any, run: any) {
        if (!event.argumentsDelta) return;

        const id = event.id || 'default';
        if (event.name && !this.toolNames.has(id)) {
            this.toolNames.set(id, event.name);
        }

        const current = this.pendingToolDeltas.get(id) || '';
        this.pendingToolDeltas.set(id, current + event.argumentsDelta);

        if (!this.toolThrottleTimer) {
            this.toolThrottleTimer = setTimeout(() => {
                this.flushToolDeltas();
            }, this.TOOL_THROTTLE_MS);
        }
    }

    private flushToolDeltas() {
        const run = this.tracker.getRun();
        for (const [id, delta] of this.pendingToolDeltas.entries()) {
            const name = this.toolNames.get(id) || '';

            this.tracker.emitEvent({
                type: 'tool_delta',
                runId: run.runId,
                name: name,
                inputDelta: delta,
                elapsedMs: this.tracker.elapsedMs(),
            });

            MarieGhostService.handleDelta(id, name, delta);

            if (delta.includes('path') || delta.includes('file')) {
                const pathMatch = delta.match(/"path"\s*:\s*"([^"]*)"/);
                if (pathMatch) {
                    run.activeFilePath = pathMatch[1];
                    this.tracker.emitProgressUpdate();
                }
            }
        }
        this.pendingToolDeltas.clear();
        this.toolThrottleTimer = null;
    }

    private updateStage(event: any) {
        const run = this.tracker.getRun();
        const stage = event.stage;
        run.steps += 1;

        if (['responding', 'calling_tool', 'editing'].includes(stage)) {
            this.tracker.setObjectiveStatus('understand_request', 'completed');
            this.tracker.setObjectiveStatus('execute_plan', 'in_progress', event.label || 'Executing...');
            run.activeObjectiveId = 'execute_plan';
        }

        this.tracker.emitEvent({
            type: 'stage',
            runId: run.runId,
            stage,
            label: event.label || stage,
            elapsedMs: this.tracker.elapsedMs(),
        });
        this.tracker.emitProgressUpdate(event.label || `Stage: ${stage}`);
    }
}
