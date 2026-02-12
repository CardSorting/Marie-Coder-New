import * as vscode from "vscode"
import * as path from 'path';
import { Marie } from "./Marie.js"
import { SidebarProvider } from "./providers/SidebarProvider.js"
import { JoyService } from "./services/JoyService.js"
import { JoyLogService } from './services/JoyLogService.js'
import { MarieGhostService } from './services/MarieGhostService.js'
import { MarieSCMProvider } from './services/MarieSCMProvider.js'
import { TerminalService } from './plumbing/terminal/TerminalService.js';
import { HealthService } from './services/HealthService.js';
import { MarieStabilityMonitor } from "./infrastructure/ai/core/MarieStabilityMonitor.js";
import { ContextArchiveService } from "./infrastructure/ai/context/ContextArchiveService.js";
import { ProcessRegistry } from './plumbing/terminal/ProcessRegistry.js';

export function activate(context: vscode.ExtensionContext) {
    console.log('Marie is waking up... ✨');

    // PLANETARY STABILITY: Pre-flight checks
    HealthService.checkDependencies().catch(e => console.error('Health Check failed', e));
    MarieStabilityMonitor.start();

    const joyLogService = new JoyLogService(context);
    ContextArchiveService.init(context);

    // SUB-ATOMIC INTEGRITY: Global Exception Handlers with Diagnostic Context
    // Track latest run state for enriched crash diagnostics
    let latestRunContext: { runId?: string; activeToolName?: string; lastToolName?: string; activeObjectiveId?: string; currentContext?: string } = {};

    const uncaughtHandler = (error: Error) => {
        const ctx = latestRunContext;
        console.error('[MarieCritical] Uncaught Exception:', {
            error: error.message,
            stack: error.stack,
            runId: ctx.runId,
            activeTool: ctx.activeToolName,
            lastTool: ctx.lastToolName,
            activeObjective: ctx.activeObjectiveId,
            context: ctx.currentContext
        });
        joyLogService.addAchievement(`🚨 CRITICAL FAULT: ${error.message || 'Unknown exception'}`, -100);
        vscode.window.showErrorMessage(`Marie: A critical fault occurred. Checking logs... 🛠️`);
    };
    const unhandledHandler = (reason: any) => {
        const ctx = latestRunContext;
        console.error('[MarieCritical] Unhandled Rejection:', {
            reason,
            runId: ctx.runId,
            activeTool: ctx.activeToolName,
            lastTool: ctx.lastToolName,
            activeObjective: ctx.activeObjectiveId,
            context: ctx.currentContext
        });
        joyLogService.addAchievement(`⚠️ UNHANDLED REJECTION: ${reason}`, -50);
    };

    process.on('uncaughtException', uncaughtHandler);
    process.on('unhandledRejection', unhandledHandler);

    context.subscriptions.push({
        dispose: () => {
            process.removeListener('uncaughtException', uncaughtHandler);
            process.removeListener('unhandledRejection', unhandledHandler);
        }
    });

    const joyService = new JoyService(context, joyLogService);
    const marie = new Marie(context, joyService)
    const sidebarProvider = new SidebarProvider(context.extensionUri, marie, context)

    // Update global exception context when progress updates occur
    context.subscriptions.push(
        joyService.onRunProgress((progress) => {
            latestRunContext = {
                runId: progress.runId,
                activeToolName: progress.activeToolName,
                lastToolName: progress.lastToolName,
                activeObjectiveId: progress.activeObjectiveId,
                currentContext: progress.context
            };
        })
    );

    context.subscriptions.push(joyService, marie, sidebarProvider);

    // Init stability-critical services
    MarieGhostService.init(context);

    // Register Native SCM-based QuickDiff (Gutter Markers)
    const scmProvider = new MarieSCMProvider(context);

    // Pipe JoyService events to Sidebar
    context.subscriptions.push(
        joyService.onJoyScoreChange(event => {
            sidebarProvider.postMessage({ type: 'onJoyScore', value: event });
        })
    );

    context.subscriptions.push(
        joyService.onLettingGoRequest(event => {
            sidebarProvider.postMessage({
                type: 'requestLettingGo',
                value: { fileName: vscode.workspace.asRelativePath(event.path), lines: event.lines, fullPath: event.path }
            });
        })
    );

    // Pipe JoyLogService achievements to Sidebar
    context.subscriptions.push(
        joyLogService.onAchievementAdded(achievement => {
            sidebarProvider.postMessage({ type: 'onToast', value: achievement.description });
        })
    );

    // Marie Status Bar Companion
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mariecoder.focusMarie';
    statusBarItem.text = "$(sparkle) Marie";
    statusBarItem.tooltip = "Click to focus Marie chat";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Give SidebarProvider access to status bar to reflect AI state
    sidebarProvider.setStatusBar(statusBarItem);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "mariecoder.SidebarProvider",
            sidebarProvider
        )
    );

    // SUB-ATOMIC INTEGRITY: Global Command Safety Wrapper
    const safeRegisterCommand = (commandId: string, callback: (...args: any[]) => any) => {
        return vscode.commands.registerCommand(commandId, async (...args: any[]) => {
            try {
                return await callback(...args);
            } catch (error: any) {
                console.error(`[MarieCommandError] Fault in ${commandId}:`, error);
                joyLogService.addAchievement(`🚨 COMMAND FAULT: ${commandId}`, -25);
                vscode.window.showErrorMessage(`Marie: Failed to execute ${commandId.split('.').pop()}. Checking stability... 🛠️`);
            }
        });
    };

    context.subscriptions.push(
        safeRegisterCommand("mariecoder.helloWorld", () => {
            vscode.window.showInformationMessage("Hello World from MarieCoder!")
        })
    )

    context.subscriptions.push(
        safeRegisterCommand("mariecoder.clearChat", () => {
            sidebarProvider.clearChat();
        })
    )

    context.subscriptions.push(
        safeRegisterCommand("mariecoder.focusMarie", () => {
            vscode.commands.executeCommand('mariecoder.SidebarProvider.focus');
        })
    );

    context.subscriptions.push(
        safeRegisterCommand("mariecoder.approveEdits", () => {
            vscode.window.showInformationMessage("Marie: Edits can be approved in the sidebar. ✨");
        })
    );

    context.subscriptions.push(
        safeRegisterCommand("mariecoder.discardEdits", () => {
            MarieGhostService.clearAll();
            vscode.window.showInformationMessage("Marie: Previews cleared. 🧘‍♂️");
        })
    );
}

export function deactivate() {
    TerminalService.cleanup();
    ProcessRegistry.killAll();
    MarieGhostService.dispose();
    MarieStabilityMonitor.stop();
}
