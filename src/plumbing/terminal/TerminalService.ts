import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

import { ProcessRegistry } from './ProcessRegistry';

const execAsync = promisify(exec);

// Patterns that usually indicate an interactive or blocking command
const INTERACTIVE_PATTERNS = [
    /\bnpm\s+init\b(?!.*-y)/,
    /\bgit\s+commit\b(?!.*-m)/,
    /\bgit\s+push\b/, // Might ask for credentials
    /\bnanoid\b/,
    /\bvi(m)?\b/,
    /\bnano\b/,
    /\bpython\b(?!.*-c)/,
    /\bnode\b(?!.*-e)/
];

const MAX_OUTPUT_LENGTH = 10000; // ~10KB limit for context safety

/** Strip ANSI escape codes from terminal output (hoisted to avoid per-call allocation) */
const stripAnsi = (t: string) => t.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

export class TerminalService {
    private static terminal: vscode.Terminal | undefined;
    private static activeProcesses = new Set<any>();

    private static getTerminal(): vscode.Terminal {
        if (this.terminal && !this.terminal.exitStatus) {
            return this.terminal;
        }
        this.terminal = vscode.window.createTerminal("Marie's Workshop");
        return this.terminal;
    }

    public static async runCommand(command: string, signal?: AbortSignal): Promise<string> {
        if (INTERACTIVE_PATTERNS.some(p => p.test(command))) {
            return `Error: Command '${command}' appears to be interactive or potentially blocking. Please use non-interactive flags (e.g., -y, -m) or run it manually.`;
        }

        // 2. Shell Injection Guard (Sub-Atomic Integrity)
        const suspiciousChars = /[;&|`$(){}]/;
        if (suspiciousChars.test(command)) {
            // Check if it's a "known safe" complex command (e.g. npm run build -- --noEmit || npx tsc --noEmit)
            const isSafeHeuristic = command.includes('--noEmit') || command.includes('npm run bloom');
            if (!isSafeHeuristic) {
                return `Security Error: Command '${command}' contains suspicious shell metacharacters. High-order tools reject unvetted complex logic for systemic safety. 🛑`;
            }
        }

        if (signal?.aborted) {
            return "Command aborted before execution.";
        }

        // 2. Show in terminal for user visibility
        const terminal = this.getTerminal();
        terminal.show();
        terminal.sendText(command);

        const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const shell = process.env.SHELL || '/bin/sh';

        let childProcess: any;
        const spawnPromise = new Promise<{ stdout: string, stderr: string, code: number | null }>((resolve, reject) => {
            try {
                // Use shell: true to support command strings with pipes/redirects
                childProcess = require('child_process').spawn(command, {
                    cwd: rootPath,
                    shell: shell,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: true // Spectral Integrity: Detach to allow PGID killing
                });

                ProcessRegistry.register(childProcess);

                let stdout = "";
                let stderr = "";

                childProcess.stdout?.on('data', (data: Buffer) => {
                    stdout += data.toString();
                    if (stdout.length > MAX_OUTPUT_LENGTH * 2) {
                        stdout = stdout.substring(stdout.length - MAX_OUTPUT_LENGTH * 2);
                    }
                });

                childProcess.stderr?.on('data', (data: Buffer) => {
                    stderr += data.toString();
                    if (stderr.length > MAX_OUTPUT_LENGTH * 2) {
                        stderr = stderr.substring(stderr.length - MAX_OUTPUT_LENGTH * 2);
                    }
                });

                childProcess.on('close', (code: number | null) => {
                    resolve({ stdout, stderr, code });
                });

                childProcess.on('error', (err: Error) => {
                    reject(err);
                });

            } catch (err) {
                reject(err);
            }
        });

        const onAbort = () => {
            if (childProcess && childProcess.pid) {
                console.log(`[Terminal] Killing process GROUP for command: ${command}`);
                try {
                    // Kill the entire process group (PGID)
                    process.kill(-childProcess.pid, 'SIGTERM');
                } catch (e) {
                    childProcess.kill('SIGTERM');
                }
                // Definitive Reap: Force kill PG if it doesn't shut down quickly
                setTimeout(() => {
                    try {
                        if (childProcess.pid) {
                            process.kill(-childProcess.pid, 'SIGKILL');
                        }
                    } catch (e) {
                        try { childProcess.kill('SIGKILL'); } catch (e2) { }
                    }
                }, 1000);
            }
        };

        if (signal) {
            signal.addEventListener('abort', onAbort);
        }

        try {
            this.activeProcesses.add(childProcess);
            const { stdout, stderr, code } = await spawnPromise;
            this.activeProcesses.delete(childProcess);

            if (signal?.aborted) {
                return `Command aborted by user. Process cleanup initiated. 🛑`;
            }

            if (code !== 0 && code !== null) {
                let cleanedStderr = stripAnsi(stderr);
                if (cleanedStderr.length > MAX_OUTPUT_LENGTH) {
                    cleanedStderr = `... [Truncated] ...\n` + cleanedStderr.substring(cleanedStderr.length - MAX_OUTPUT_LENGTH);
                }
                return `Command failed (Exit Code: ${code}):\n${cleanedStderr ? `**Error Output:**\n\`\`\`\n${cleanedStderr}\n\`\`\`` : "No error output captured."}`;
            }

            let result = `Command executed successfully (Exit Code: 0). ✨\n\n`;

            const formatOutput = (text: string, label: string) => {
                if (!text) return "";
                let content = stripAnsi(text);
                if (content.length > MAX_OUTPUT_LENGTH) {
                    content = `... [Truncated for brevity] ...\n` + content.substring(content.length - MAX_OUTPUT_LENGTH);
                }
                return `**${label}:**\n\`\`\`\n${content}\n\`\`\`\n`;
            };

            result += formatOutput(stdout, "Output");
            result += formatOutput(stderr, "Errors/Warnings");

            return result || "Command completed with no output.";
        } catch (error: any) {
            if (signal?.aborted) {
                return `Command aborted by user. Process cleanup initiated. 🛑`;
            }
            return `Command execution failed: ${error.message}`;
        } finally {
            this.activeProcesses.delete(childProcess);
            if (signal) {
                signal.removeEventListener('abort', onAbort);
            }
        }
    }

    public static cleanup() {
        console.log(`[Terminal] Cleaning up ${this.activeProcesses.size} active processes...`);
        for (const cp of this.activeProcesses) {
            try {
                cp.kill('SIGKILL');
            } catch (e) { }
        }
        this.activeProcesses.clear();
    }
}
