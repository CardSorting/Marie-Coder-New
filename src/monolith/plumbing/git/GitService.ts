import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getErrorMessage } from "../utils/ErrorUtils.js";

const execAsync = promisify(exec);

export async function gitStatus(cwd: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git status --short", { cwd });
        return stdout || "Clean workspace (no modifications).";
    } catch (error: unknown) {
        return `Error getting git status: ${getErrorMessage(error)}`;
    }
}

export async function getStagedDiff(cwd: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git diff --cached", { cwd });
        if (!stdout.trim()) {
            return "No staged changes found. Use 'git add' to stage files.";
        }
        return stdout;
    } catch (error: unknown) {
        return `Error getting staged diff: ${getErrorMessage(error)}`;
    }
}

export async function getUnstagedDiff(cwd: string): Promise<string> {
    try {
        const { stdout } = await execAsync("git diff", { cwd });
        if (!stdout.trim()) {
            return "No unstaged changes found.";
        }
        return stdout;
    } catch (error: unknown) {
        return `Error getting unstaged diff: ${getErrorMessage(error)}`;
    }
}

export async function getFileHistory(cwd: string, filePath: string): Promise<string> {
    try {
        // Get last 5 commits for the file
        const { stdout } = await execAsync(`git log -n 5 --pretty=format:"%h | %as | %an | %s" -- "${filePath}"`, { cwd });
        if (!stdout.trim()) {
            return "No git history found for this file.";
        }
        return `# File History: ${path.basename(filePath)}\n\n\`\`\`\n${stdout}\n\`\`\``;
    } catch (error: unknown) {
        return `Error getting file history: ${getErrorMessage(error)}`;
    }
}

export async function logReflection(message: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const journalPath = path.join(workspaceFolders[0].uri.fsPath, "JOURNAL.md");
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString();

    const entry = `\n### ${date} ${time}\n${message}\n`;

    try {
        await fs.appendFile(journalPath, entry, "utf-8");
    } catch (e) {
        // If file doesn't exist, create it with header
        const header = "# Code Journal 📓\n\nA space for reflection, ideas, and mindfulness.\n";
        await fs.writeFile(journalPath, header + entry, "utf-8");
    }
}
