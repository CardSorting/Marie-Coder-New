import * as fs from "fs/promises";
import * as path from "path";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { getStringArg } from "../infrastructure/tools/ToolUtils.js";
import { exec } from "child_process";
import { promisify } from "util";
import { RuntimeAutomationPort } from "../runtime/types.js";
import { registerSharedToolDefinitions } from "../infrastructure/tools/SharedToolDefinitions.js";

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

export function registerMarieToolsCLI(registry: ToolRegistry, _automationService: RuntimeAutomationPort, workingDir: string) {
    registerSharedToolDefinitions(registry, {
        resolvePath: (p: string) => path.isAbsolute(p) ? p : path.join(workingDir, p),
        writeFile: async (p, content) => await writeFile(p, content),
        readFile: async (p, start, end) => await readFile(p, start, end),
        listDir: async (p) => await listFiles(p),
        grepSearch: async (q, p) => await searchFiles(q, p),
        getGitContext: async () => {
            const [status, staged, unstaged] = await Promise.all([
                getGitStatus(workingDir),
                getGitDiff(workingDir, true),
                getGitDiff(workingDir, false)
            ]);
            return `# Git Context\n\n## Status\n\`\`\`\n${status}\n\`\`\`\n\n## Staged Changes\n\`\`\`\n${staged}\n\`\`\`\n\n## Unstaged Changes\n\`\`\`\n${unstaged}\n\`\`\``;
        },
        runCommand: async (cmd) => await runCommand(cmd, workingDir),
        getFolderStructure: async (p, depth) => await getFolderTree(p, depth),
        replaceInFile: async (p, s, r) => {
            const content = await fs.readFile(p, 'utf-8');
            if (!content.includes(s)) {
                return `Error: Search text not found in file`;
            }
            const newContent = content.split(s).join(r);
            await fs.writeFile(p, newContent, 'utf-8');
            return `Replaced ${content.split(s).length - 1} occurrence(s) in ${p}`;
        }
    }, { includeExtended: true });

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
        execute: async (args) => {
            const p = getStringArg(args, 'path');
            const fullPath = path.isAbsolute(p) ? p : path.join(workingDir, p);
            await deleteFile(fullPath);
            return `Deleted ${fullPath}`;
        }
    });
}