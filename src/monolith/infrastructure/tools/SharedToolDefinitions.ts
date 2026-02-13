import { getStringArg } from "./ToolUtils.js";
import { ToolRegistry } from "./ToolRegistry.js";

export interface SharedToolRuntime {
    resolvePath(path: string): string;
    writeFile(path: string, content: string, signal?: AbortSignal): Promise<void>;
    readFile(path: string, startLine?: number, endLine?: number, signal?: AbortSignal): Promise<string>;
    listDir(path: string, signal?: AbortSignal): Promise<string>;
    grepSearch(query: string, path: string, signal?: AbortSignal): Promise<string>;
    getGitContext(): Promise<string>;
    runCommand?(command: string, signal?: AbortSignal): Promise<string>;
    getFolderStructure?(path: string, depth?: number, signal?: AbortSignal): Promise<string>;
    replaceInFile?(path: string, search: string, replace: string, signal?: AbortSignal): Promise<string>;
}

export function registerSharedToolDefinitions(
    registry: ToolRegistry,
    runtime: SharedToolRuntime,
    options?: { includeExtended?: boolean }
) {
    registry.register({
        name: "write_file",
        description: "Write content to a file.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file" },
                content: { type: "string", description: "The content to write" },
            },
            required: ["path", "content"],
        },
        execute: async (args, onProgress, signal) => {
            const p = runtime.resolvePath(getStringArg(args, 'path'));
            const c = getStringArg(args, 'content');
            await runtime.writeFile(p, c, signal);
            return `File written to ${p}`;
        }
    });

    registry.register({
        name: "read_file",
        description: "Read the content of a file.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file" },
                startLine: { type: "number", description: "First line to read (1-indexed)" },
                endLine: { type: "number", description: "Last line to read (1-indexed)" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = runtime.resolvePath(getStringArg(args, 'path'));
            const start = args.startLine as number | undefined;
            const end = args.endLine as number | undefined;
            return await runtime.readFile(p, start, end, signal);
        }
    });

    registry.register({
        name: "list_dir",
        description: "List files and directories in a path.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = runtime.resolvePath(getStringArg(args, 'path'));
            return await runtime.listDir(p, signal);
        }
    });

    registry.register({
        name: "grep_search",
        description: "Search for text patterns in files.",
        input_schema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search pattern" },
                path: { type: "string", description: "Path to search in" },
            },
            required: ["query"],
        },
        execute: async (args, onProgress, signal) => {
            const q = getStringArg(args, 'query');
            const rawPath = getStringArg(args, 'path') || process.cwd();
            const p = runtime.resolvePath(rawPath);
            return await runtime.grepSearch(q, p, signal);
        }
    });

    registry.register({
        name: "get_git_context",
        description: "Get git status and diffs.",
        input_schema: { type: "object", properties: {} },
        execute: async () => await runtime.getGitContext()
    });

    if (!options?.includeExtended) return;

    if (runtime.runCommand) {
        registry.register({
            name: "run_command",
            description: "Execute a shell command.",
            isDestructive: true,
            input_schema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Shell command to execute" },
                },
                required: ["command"],
            },
            execute: async (args, onProgress, signal) => {
                const cmd = getStringArg(args, 'command');
                return await runtime.runCommand!(cmd, signal);
            }
        });
    }

    if (runtime.getFolderStructure) {
        registry.register({
            name: "get_folder_structure",
            description: "Get a tree view of a directory structure.",
            input_schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path" },
                    depth: { type: "number", description: "Maximum depth" }
                },
                required: ["path"],
            },
            execute: async (args, onProgress, signal) => {
                const p = runtime.resolvePath(getStringArg(args, 'path'));
                const depth = args.depth as number | undefined;
                return await runtime.getFolderStructure!(p, depth, signal);
            }
        });
    }

    if (runtime.replaceInFile) {
        registry.register({
            name: "replace_in_file",
            description: "Replace text in a file.",
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
                const p = runtime.resolvePath(getStringArg(args, 'path'));
                const s = getStringArg(args, 'search');
                const r = getStringArg(args, 'replace');
                return await runtime.replaceInFile!(p, s, r, signal);
            }
        });
    }
}
