import * as vscode from 'vscode';
import { TerminalService } from '../terminal/TerminalService';

export interface TriageReport {
    success: boolean;
    totalTests: number;
    failedTests: string[];
    errors: string[];
    rawOutput: string;
}

export class TestService {
    /**
     * Executes a test suite and parses the output into a structured Triage Report.
     */
    public static async runAndTriage(command: string): Promise<string> {
        try {
            const rawOutput = await TerminalService.runCommand(command);
            const report = this.parseOutput(rawOutput);

            let result = `# 🏥 Test Triage Report\n\n`;
            result += `**Status**: ${report.success ? "Success ✨" : "Regressions Detected ⚠️"}\n`;

            if (!report.success) {
                result += `\n## ❌ Failing Tests\n`;
                report.failedTests.forEach(t => result += `- \`${t}\`\n`);

                result += `\n## 🔍 Top Errors\n`;
                report.errors.slice(0, 3).forEach(e => result += `\`\`\`\n${e}\n\`\`\`\n`);
            } else {
                result += `\nAll tests passed across the target suite. The project remains stable. ✨\n`;
            }

            return result;
        } catch (error) {
            return `Failed to execute test suite: ${error}`;
        }
    }

    private static parseOutput(output: string): TriageReport {
        const failedTests: string[] = [];
        const errors: string[] = [];

        // Basic heuristic for common test runners (Vitest/Jest)
        const lines = output.split('\n');
        let capturingError = false;
        let currentError = "";

        for (const line of lines) {
            // Detect failing test labels (e.g., " ❌ src/test/foo.test.ts > some function")
            if (line.includes(' ❌ ') || line.includes(' FAIL ')) {
                failedTests.push(line.trim());
            }

            // Detect error stack/assertion blocks
            if (line.includes('AssertionError') || line.includes('Error: ')) {
                capturingError = true;
                currentError = line.trim() + "\n";
            } else if (capturingError) {
                if (line.trim() === "" || line.startsWith('      at ')) {
                    currentError += line + "\n";
                } else {
                    errors.push(currentError.trim());
                    capturingError = false;
                }
            }
        }

        return {
            success: failedTests.length === 0,
            totalTests: lines.length, // Rough approximation
            failedTests,
            errors,
            rawOutput: output
        };
    }
}
