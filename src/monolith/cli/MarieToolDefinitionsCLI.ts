import * as fs from "fs/promises";
import * as path from "path";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { getStringArg, getArrayArg } from "../infrastructure/tools/ToolUtils.js";
import { withTimeout } from "../plumbing/utils/TimeoutUtils.js";
import { exec } from "child_process";
import { promisify } from "util";
import { JoyAutomationServiceCLI } from "./services/JoyAutomationServiceCLI.js";

const execAsync = promisify(exec);

async function readFile(filePath: string, startLine?: number, endLine?: number): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    if (startLine && endLine) {
        return lines.slice(startLine - 1, endLine).join('\n');
    }
    return content;
}

async function writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
}

async function deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
}

async function listFiles(dirPath: string): Promise<string> {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files = entries.map(e => {
            const icon = e.isDirectory() ? '📁' : '📄';
            return `${icon} ${e.name}${e.isDirectory() ? '/' : ''}`;
        });
        return files.join('\n') || '(empty directory)';
    } catch (e: any) {
        return `Error: ${e.message}`;
    }
}

async function searchFiles(query: string, searchPath: string): Promise<string> {
    try {
        const { stdout } = await execAsync(
            `grep -rn "${query.replace(/"/g, '\\"')}" "${searchPath}" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.json" --include="*.md" 2>/dev/null | head -50`
        );
        return stdout || 'No matches found';
    } catch {
        return 'No matches found';
    }
}

async function getGitStatus(root: string): Promise<string> {
    try {
        const { stdout } = await execAsync('git status --short', { cwd: root });
        return stdout || 'Working tree clean';
    } catch {
        return 'Not a git repository';
    }
}

async function getGitDiff(root: string, staged: boolean): Promise<string> {
    try {
        const cmd = staged ? 'git diff --staged' : 'git diff';
        const { stdout } = await execAsync(cmd, { cwd: root });
        return stdout || 'No changes';
    } catch {
        return 'Unable to get diff';
    }
}

async function runCommand(command: string, cwd: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout: 60000,
            maxBuffer: 1024 * 1024
        });
        return stdout + (stderr ? `\nstderr: ${stderr}` : '');
    } catch (e: any) {
        return `Error: ${e.message}\n${e.stdout || ''}\n${e.stderr || ''}`;
    }
}

async function getFolderTree(dirPath: string, maxDepth: number = 3): Promise<string> {
    async function buildTree(currentPath: string, depth: number, prefix: string): Promise<string> {
        if (depth > maxDepth) return '';

        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            const visible = entries.filter(e => !e.name.startsWith('.') && !e.name.includes('node_modules'));
            let result = '';

            for (let i = 0; i < visible.length; i++) {
                const e = visible[i];
                const isLast = i === visible.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                result += `${prefix}${connector}${e.name}${e.isDirectory() ? '/' : ''}\n`;

                if (e.isDirectory()) {
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    result += await buildTree(path.join(currentPath, e.name), depth + 1, newPrefix);
                }
            }
            return result;
        } catch {
            return '';
        }
    }

    const name = path.basename(dirPath);
    return `${name}/\n${await buildTree(dirPath, 1, '')}`;
}

export function registerMarieToolsCLI(registry: ToolRegistry, automationService: JoyAutomationServiceCLI, workingDir: string) {
    registry.register({
        name: "write_file",
        description: "Write content to a file. Creates directories if needed.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute or relative path to the file" },
                content: { type: "string", description: "The content to write" },
            },
            required: ["path", "content"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const c = getStringArg(args, 'content');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            await writeFile(fullPath, c);
            return `File written to ${fullPath}`;
        }
    });

    registry.register({
        name: "read_file",
        description: "Read the content of a file. Supports line range selection.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The path to the file" },
                startLine: { type: "number", description: "First line to read (1-indexed)" },
                endLine: { type: "number", description: "Last line to read (1-indexed)" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            const start = args.startLine as number | undefined;
            const end = args.endLine as number | undefined;
            return await readFile(fullPath, start, end);
        }
    });

    registry.register({
        name: "list_dir",
        description: "List files and directories with icons.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The directory path" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            return await listFiles(fullPath);
        }
    });

    registry.register({
        name: "grep_search",
        description: "Search for text patterns in files using grep.",
        input_schema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search pattern" },
                path: { type: "string", description: "Directory to search (defaults to working directory)" },
            },
            required: ["query"],
        },
        execute: async (args, onProgress, signal) => {
            const q = getStringArg(args, 'query');
            const p = getStringArg(args, 'path') || workingDir;
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            return await searchFiles(q, fullPath);
        }
    });

    registry.register({
        name: "delete_file",
        description: "Delete a file.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The file path to delete" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            await deleteFile(fullPath);
            return `Deleted ${fullPath}`;
        }
    });

    registry.register({
        name: "get_git_context",
        description: "Get git status and diffs.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const [status, staged, unstaged] = await Promise.all([
                getGitStatus(workingDir),
                getGitDiff(workingDir, true),
                getGitDiff(workingDir, false)
            ]);

            return `# Git Context\n\n## Status\n\`\`\`\n${status}\n\`\`\`\n\n## Staged Changes\n\`\`\`\n${staged}\n\`\`\`\n\n## Unstaged Changes\n\`\`\`\n${unstaged}\n\`\`\``;
        }
    });

    registry.register({
        name: "run_command",
        description: "Execute a shell command. Requires user approval for destructive commands.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to execute" },
            },
            required: ["command"],
        },
        execute: async (args, onProgress, signal) => {
            const cmd = getStringArg(args, 'command');
            return await runCommand(cmd, workingDir);
        }
    });

    registry.register({
        name: "get_folder_structure",
        description: "Get a tree view of a directory structure.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The directory path" },
                depth: { type: "number", description: "Maximum depth (default: 3)" }
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const depth = args.depth as number | undefined;
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            return await getFolderTree(fullPath, depth);
        }
    });

    registry.register({
        name: "replace_in_file",
        description: "Replace a string with another in a file.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File path" },
                search: { type: "string", description: "Text to find" },
                replace: { type: "string", description: "Replacement text" }
            },
            required: ["path", "search", "replace"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const s = getStringArg(args, 'search');
            const r = getStringArg(args, 'replace');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);

            const content = await fs.readFile(fullPath, 'utf-8');
            if (!content.includes(s)) {
                return `Error: Search text not found in file`;
            }
            const newContent = content.split(s).join(r);
            await fs.writeFile(fullPath, newContent, 'utf-8');
            return `Replaced ${s.split(s).length - 1} occurrence(s) in ${fullPath}`;
        }
    });
}