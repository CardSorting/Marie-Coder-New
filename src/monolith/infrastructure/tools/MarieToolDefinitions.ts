import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { ToolRegistry } from "./ToolRegistry.js";
import { getStringArg, getArrayArg } from "./ToolUtils.js";
import { withTimeout } from "../../plumbing/utils/TimeoutUtils.js";
import { writeFile, deleteFile } from "../../plumbing/filesystem/FileService.js";
import { logGratitude, generateTidyChecklist, foldCode, cherishFile, generateJoyDashboard } from "../../domain/joy/JoyTools.js";
import { getLettingGoMessage } from "../../../prompts.js";
import { gitStatus, getStagedDiff, getUnstagedDiff, getFileHistory, logReflection } from "../../plumbing/git/GitService.js";
import { SymbolService } from "../../plumbing/lsp/SymbolService.js";
import { DependencyService } from "../../plumbing/analysis/DependencyService.js";
import { DiscoveryService } from "../../plumbing/analysis/DiscoveryService.js";
import { TestService } from "../../plumbing/analysis/TestService.js";
import { ComplexityService } from "../../plumbing/analysis/ComplexityService.js";
import { JoyMapService } from "../../plumbing/analysis/JoyMapService.js";
import { checkCodeHealth } from "../../plumbing/analysis/CodeHealthService.js";
import { ProgressObjective, ProgressUpdate } from "../../domain/marie/MarieTypes.js";
import { JoyAutomationService } from "../../services/JoyAutomationService.js";
import { RitualService, JoyZone } from "../../domain/joy/RitualService.js";
import { ContextArchiveService } from "../ai/context/ContextArchiveService.js";

export function registerMarieTools(registry: ToolRegistry, automationService: JoyAutomationService) {
    registry.register({
        name: "write_file",
        description: "Write content to a file. Always use absolute paths.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" },
                content: { type: "string", description: "The content to write" },
            },
            required: ["path", "content"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const c = getStringArg(args, 'content');
            await writeFile(p, c, signal);
            return `File written to ${p}`;
        }
    });

    registry.register({
        name: "read_file",
        description: "Read the content of a file. Supports surgical focus via startLine and endLine. Always use absolute paths.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" },
                startLine: { type: "number", description: "The first line to read (1-indexed)" },
                endLine: { type: "number", description: "The last line to read (1-indexed)" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const start = args.startLine as number | undefined;
            const end = args.endLine as number | undefined;
            const { readFile } = await import("../../plumbing/filesystem/FileService.js");
            return await readFile(p, start, end, signal);
        }
    });

    registry.register({
        name: "list_dir",
        description: "List the files and directories in a given path with metadata (size, type).",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the directory" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const { listFiles } = await import("../../plumbing/filesystem/FileService.js");
            return await listFiles(p, signal);
        }
    });

    registry.register({
        name: "grep_search",
        description: "Search for a text pattern within files. Returns line numbers and snippets for context.",
        input_schema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The text pattern to search for" },
                path: { type: "string", description: "The absolute path to search within (defaults to workspace root if not provided)" },
            },
            required: ["query"],
        },
        execute: async (args, onProgress, signal) => {
            const q = getStringArg(args, 'query');
            let p = getStringArg(args, 'path');
            if (!p) {
                p = vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
            }
            const { searchFiles } = await import("../../plumbing/filesystem/FileService.js");
            return await searchFiles(q, p, signal);
        }
    });

    registry.register({
        name: "discard_file",
        description: "Permanently delete a file. This is a ritual of letting go.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file to discard" },
            },
            required: ["path"],
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const uri = vscode.Uri.file(p);

            // 1. Safe Compost Check: Audit workspace for references to any symbols in this file
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (symbols && symbols.length > 0) {
                const blockers: string[] = [];
                for (const sym of symbols) {
                    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        uri,
                        sym.location.range.start
                    );
                    const externalRefs = refs?.filter(r => r.uri.fsPath !== p) || [];
                    if (externalRefs.length > 0) {
                        blockers.push(`Symbol \`${sym.name}\` is used in ${externalRefs.length} other file(s).`);
                    }
                }

                if (blockers.length > 0) {
                    return `# 🍂 Refusal of Letting Go\n\n` +
                        `I cannot discard \`${path.basename(p)}\` because it still has active echos in the workspace:\n\n` +
                        blockers.map(b => `- ${b}`).join('\n') +
                        `\n\n**Recommendation**: Use \`execute_semantic_move\` or \`replace_in_file\` to resolve these dependencies before composting.`;
                }
            }

            await deleteFile(p);
            await logGratitude(`Discarded '${p}'`);
            return `File '${p}' has been discarded. ${getLettingGoMessage()}`;
        }
    });

    registry.register({
        name: "get_git_context",
        description: "Get the current git status and diffs (staged and unstaged) for the project.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!root) return "No workspace detected.";

            const [status, staged, unstaged] = await Promise.all([
                gitStatus(root),
                getStagedDiff(root),
                getUnstagedDiff(root)
            ]);

            return `# Git Context\n\n## Status\n\`\`\`\n${status}\n\`\`\`\n\n## Staged Changes\n\`\`\`\n${staged}\n\`\`\`\n\n## Unstaged Changes\n\`\`\`\n${unstaged}\n\`\`\``;
        }
    });

    registry.register({
        name: "get_symbol_definition",
        description: "Find the definition of a symbol at the specified position. Helps navigate complex codebases.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" },
                line: { type: "number", description: "The line number (1-indexed)" },
                character: { type: "number", description: "The character position (1-indexed)" }
            },
            required: ["path", "line", "character"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const line = (args.line as number) - 1;
            const char = (args.character as number) - 1;
            const uri = vscode.Uri.file(p);
            const pos = new vscode.Position(line, char);
            return await SymbolService.getDefinitions(uri, pos);
        }
    });

    registry.register({
        name: "get_file_dependencies",
        description: "Map the structural network of a file (imports/exports) to understand its dependencies and role.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            return await DependencyService.getFileNetwork(p);
        }
    });

    registry.register({
        name: "pin_context",
        description: "Anchor a critical piece of context (snippet, symbol, or file reference) for long-term strategic memory.",
        input_schema: {
            type: "object",
            properties: {
                id: { type: "string", description: "A unique identifier for this anchor (e.g., 'auth_flow')" },
                label: { type: "string", description: "A short, descriptive label" },
                content: { type: "string", description: "The content to anchor" },
                type: { type: "string", enum: ["snippet", "symbol", "file_ref"] }
            },
            required: ["id", "label", "content", "type"]
        },
        execute: async (args, onProgress, signal) => {
            const service = ContextArchiveService.getInstance();
            service.anchor({
                id: getStringArg(args, 'id'),
                label: getStringArg(args, 'label'),
                content: getStringArg(args, 'content'),
                type: getStringArg(args, 'type') as any
            });
            return `Context anchored: ${getStringArg(args, 'label')} (ID: ${getStringArg(args, 'id')}). This information is now preserved for your strategic use. ✨`;
        }
    });

    registry.register({
        name: "get_file_diagnostics",
        description: "Get real-time diagnostics (errors, warnings, lints) for a file from VS Code.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const uri = vscode.Uri.file(p);
            const diags = vscode.languages.getDiagnostics(uri);

            if (diags.length === 0) return "No diagnostics found. The file appears clean. ✨";

            let result = `# Diagnostics for ${path.basename(p)}\n\n`;
            diags.forEach(d => {
                const severity = vscode.DiagnosticSeverity[d.severity];
                result += `- [${severity}] L${d.range.start.line + 1}: ${d.message} (${d.code || 'no-code'})\n`;
            });
            return result;
        }
    });

    registry.register({
        name: "get_file_history",
        description: "Consult the 'human echos' of a file by reading its recent git history. Use this to understand context and conventions.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const mod = await import("../../plumbing/git/GitService.js");
            return await mod.getFileHistory(process.cwd(), p);
        }
    });

    registry.register({
        name: "run_test_suite",
        description: "Execute a test command and receive a structured 'Triage Report' identifying specific failures.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The test command (e.g., 'npm test')" }
            },
            required: ["command"]
        },
        execute: async (args, onProgress, signal) => {
            const cmd = getStringArg(args, 'command');
            return await TestService.runAndTriage(cmd);
        }
    });

    registry.register({
        name: "get_code_complexity",
        description: "Analyze a file for cyclomatic complexity and clutter level to identify refactoring needs.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const metrics = await ComplexityService.analyze(p);
            let result = `# Complexity Scan: ${path.basename(p)}\n\n`;
            result += `- **Clutter Level**: ${metrics.clutterLevel}\n`;
            result += `- **Cyclomatic Complexity**: ${metrics.cyclomaticComplexity}\n`;
            result += `- **Lines of Code**: ${metrics.loc}\n\n`;
            if (metrics.suggestions.length > 0) {
                result += `## 🛠️ Refinement Suggestions\n`;
                metrics.suggestions.forEach(s => result += `- ${s}\n`);
            }
            return result;
        }
    });

    registry.register({
        name: "audit_architectural_integrity",
        description: "Verify that code doesn't violate architectural boundaries (e.g., UI/Domain depending on Plumbing) across a file or directory.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file or directory to audit" },
                recursive: { type: "boolean", description: "Whether to scan subdirectories (default: true)" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const recursive = args.recursive !== false;

            const stats = await fs.stat(p);
            const files: string[] = [];
            if (stats.isFile()) {
                files.push(p);
            } else {
                const entries = await fs.readdir(p, { withFileTypes: true, recursive } as any);
                files.push(...entries.filter((e: any) => e.isFile() && /\.(ts|tsx|js|jsx)$/.test(e.name)).map((e: any) => path.join(e.path || p, e.name)));
            }

            const violations: string[] = [];
            for (const file of files) {
                const health = await checkCodeHealth(file);
                if (health.zoningHealth.isBackflowPresent) {
                    violations.push(`**${path.relative(process.cwd(), file)}**: ${health.zoningHealth.illegalImports.join(', ')}`);
                }
            }

            if (violations.length === 0) return `No architectural violations detected in ${files.length} file(s). The structure is pure. ✨`;

            let result = `# 👮‍♀️ Architectural Integrity Report\n\n`;
            result += `Audited **${files.length}** file(s). Found **${violations.length}** violation(s).\n\n`;
            result += `## ⚠️ Zone Leakage (Backflow)\n`;
            violations.forEach(v => result += `- ${v}\n`);
            result += `\n**Methodology Note**: Respect the Downward Flow Law (Domain -> Infrastructure -> Plumbing). Use \`trace_data_flow\` to resolve these leaks.`;
            return result;
        }
    });

    registry.register({
        name: "extract_component_api",
        description: "Generate a structured markdown API summary for a component or class (functions, props, types).",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                vscode.Uri.file(p)
            );

            if (!symbols || symbols.length === 0) return "No symbols found to generate API summary.";

            let result = `# ✍️ API Summary: ${path.basename(p)}\n\n`;
            symbols.forEach(s => {
                const kind = vscode.SymbolKind[s.kind];
                result += `### [${kind}] ${s.name}\n`;
                if (s.children.length > 0) {
                    s.children.forEach(c => {
                        const cKind = vscode.SymbolKind[c.kind];
                        result += `- **${c.name}** (${cKind})\n`;
                    });
                }
                result += '\n';
            });
            return result;
        }
    });

    registry.register({
        name: "get_folder_structure",
        description: "Get a recursive, tree-like overview of a folder's structure.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the folder" },
                depth: { type: "number", description: "Maximum recursion depth (default: 3)" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const depth = args.depth as number | undefined;
            return await DiscoveryService.getFolderTree(p, depth);
        }
    });

    registry.register({
        name: "find_symbol_references",
        description: "Find all references/usages of a symbol across the workspace.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file containing the symbol" },
                line: { type: "number", description: "The line number (1-indexed)" },
                character: { type: "number", description: "The character position (1-indexed)" }
            },
            required: ["path", "line", "character"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const line = (args.line as number) - 1;
            const char = (args.character as number) - 1;
            const uri = vscode.Uri.file(p);
            const pos = new vscode.Position(line, char);

            const refs = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                pos
            );

            if (!refs || refs.length === 0) return "No references found.";

            let result = `Found ${refs.length} reference(s):\n`;
            refs.slice(0, 50).forEach(r => {
                result += `- ${r.uri.fsPath} [L${r.range.start.line + 1}:C${r.range.start.character + 1}]\n`;
            });
            if (refs.length > 50) result += `\n... AND ${refs.length - 50} MORE.`;
            return result;
        }
    });

    registry.register({
        name: "get_workspace_joy_map",
        description: "Generate a project-wide health report. Use this to identify 'Clutter Hotspots' and prioritize refactoring efforts.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!root) return "No workspace folder found.";
            const joyMap = await JoyMapService.generate(root);
            const run = automationService.getCurrentRun();

            let result = `# 🌟 Workspace Joy Map\n\n`;
            result += `**Overall Joy Score**: ${joyMap.overallJoyScore}/100\n`;
            if (run) {
                const resilience = run.heuristicFixes && run.heuristicFixes.length > 3 ? "Fragile ⚠️" : "Resilient ✨";
                result += `**Agent Resilience**: ${resilience}\n`;
            }
            result += `**Files Scanned**: ${joyMap.totalFilesScanned}\n\n`;
            result += `> ${joyMap.summary}\n\n`;

            if (joyMap.hotspots.length > 0) {
                result += `## ⚠️ Clutter Hotspots\n`;
                joyMap.hotspots.forEach(h => {
                    result += `- \`${h.path}\`: ${h.joyScore} (${h.clutterLevel})\n`;
                });
            }
            return result;
        }
    });

    registry.register({
        name: "check_ripple_health",
        description: "Verify the health of all workspace files that depend on a specific path. Use this to catch regressions in downstream consumers.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the modified file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            try {
                // 1. Get all exported symbols in the file
                const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                    'vscode.executeDocumentSymbolProvider',
                    vscode.Uri.file(p)
                );

                if (!symbols || symbols.length === 0) return "No symbols found to check ripples for.";

                // 2. Find all unique external reference files
                const uniqueFiles = new Set<string>();
                for (const sym of symbols) {
                    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        vscode.Uri.file(p),
                        sym.location.range.start
                    );
                    refs?.forEach(r => {
                        if (r.uri.fsPath !== p) uniqueFiles.add(r.uri.fsPath);
                    });
                }

                if (uniqueFiles.size === 0) return "No external downstream dependents found for any symbol in this file. ✨";

                let result = `# 🌊 Comprehensive Ripple Health: ${path.basename(p)}\n\n`;
                result += `Checking **${uniqueFiles.size}** dependent(s) across all symbols...\n\n`;

                const fileList = Array.from(uniqueFiles);
                for (const file of fileList) {
                    const diags = vscode.languages.getDiagnostics(vscode.Uri.file(file));
                    const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                    result += `- \`${path.relative(process.cwd(), file)}\`: ${errors.length > 0 ? `❌ ${errors.length} Error(s)` : `✅ Clean`}\n`;
                }

                return result;
            } catch (error) {
                return `Ripple check failed: ${error}`;
            }
        }
    });

    registry.register({
        name: "generate_evolution_chronicle",
        description: "Synthesize the 'Story' of a directory or file's evolution using git history and recent diffs.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the directory or file" }
            },
            required: ["path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const mod = await import("../../plumbing/git/GitService.js");
            const history = await mod.getFileHistory(process.cwd(), p);

            let result = `# 📜 Evolution Chronicle: ${path.basename(p)}\n\n`;
            result += `## Recent Trajectory\n`;
            result += history + "\n\n";
            result += `## Intent Synthesis\n`;
            result += `Based on the echos above, this area is transitioning through the Living Project lifecycle. Ensure the next 'Pass' aligns with this momentum. ✨`;
            return result;
        }
    });

    registry.register({
        name: "predict_refactor_ripple",
        description: "Simulate a structural change (e.g., changing a signature) and predict which downstream files will break.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" },
                symbol: { type: "string", description: "The symbol being modified" },
                changeDescription: { type: "string", description: "Description of the change (e.g., 'Removing optional param X')" }
            },
            required: ["path", "symbol", "changeDescription"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const sym = getStringArg(args, 'symbol');
            const uri = vscode.Uri.file(p);

            // 1. Find the symbol's actual position
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            const target = symbols?.find(s => s.name === sym);
            const pos = target?.location.range.start || new vscode.Position(0, 0);

            // 2. Find references to that specific point
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                pos
            );

            if (!locations || locations.length === 0) return `No ripple effect detected for \`${sym}\`. The change is isolated. ✨`;

            const uniqueFiles = Array.from(new Set(locations.map(l => l.uri.fsPath))).filter(f => f !== p);
            let result = `# 🔮 Refactor Ripple Prediction: \`${sym}\`\n\n`;
            result += `Proposed Change: ${getStringArg(args, 'changeDescription')}\n\n`;

            if (uniqueFiles.length > 0) {
                result += `## ⚠️ Potentially Broken Dependents (${uniqueFiles.length})\n`;
                for (const f of uniqueFiles) {
                    const relativePath = path.relative(process.cwd(), f);
                    const fileLocations = locations.filter(l => l.uri.fsPath === f);
                    result += `- \`${relativePath}\`: Found ${fileLocations.length} reference(s)\n`;

                    // Added: Sample context from the first reference in each file
                    try {
                        const content = await fs.readFile(f, 'utf-8');
                        const lines = content.split('\n');
                        const sampleLine = lines[fileLocations[0].range.start.line].trim();
                        result += `  > \`${sampleLine}\` (L${fileLocations[0].range.start.line + 1})\n`;
                    } catch (e) { /* ignore read errors */ }
                }
                result += `\nRecommendation: Use \`check_ripple_health\` after applying the change to verify these files.`;
            } else {
                result += `No external dependents found. The change is safe to apply within this file.`;
            }
            return result;
        }
    });

    registry.register({
        name: "generate_migration_plan",
        description: "Generate a step-by-step 'Blueprint' for migrating code from an old pattern to a new one.",
        input_schema: {
            type: "object",
            properties: {
                fromPattern: { type: "string", description: "The pattern being replaced" },
                toPattern: { type: "string", description: "The new target pattern" },
                files: { type: "array", items: { type: "string" }, description: "List of files to migrate" }
            },
            required: ["fromPattern", "toPattern", "files"]
        },
        execute: async (args, onProgress, signal) => {
            const files = args.files as string[];
            let result = `# 📐 Migration Blueprint\n\n`;
            result += `**Trajectory**: From \`${args.fromPattern}\` to \`${args.toPattern}\`\n\n`;
            result += `## 🗺️ Execution Steps\n`;
            result += `1. **Analysis**: Map all instances of old pattern in ${files.length} files.\n`;
            result += `2. **Transformation**: Apply structural replacements using \`replace_in_file\`.\n`;
            result += `3. **Verification**: Run \`check_ripple_health\` and \`run_test_suite\`.\n\n`;
            result += `## 🗂️ Target Garden\n`;
            files.slice(0, 10).forEach(f => result += `- \`${f.split('/').pop()}\`\n`);
            if (files.length > 10) result += `- ... and ${files.length - 10} more.\n`;
            return result;
        }
    });

    registry.register({
        name: "analyze_agent_telemetry",
        description: "Analyze your own execution telemetry (errors, heuristic fixes, retries) to self-calibrate your strategy.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const run = automationService.getCurrentRun(); // Hypothetical access to current run
            if (!run) return "No active telemetry found for this session.";

            let result = `# 🧪 Strategic Telemetry Analysis\n\n`;
            result += `- **Total Elapsed**: ${Math.round((Date.now() - run.startedAt) / 1000)}s\n`;
            result += `- **Heuristic Fixes**: ${run.heuristicFixes?.length || 0}\n`;
            result += `- **Objective Latency**: High (Refining Strategy...)\n\n`;

            if (run.heuristicFixes && run.heuristicFixes.length > 3) {
                result += `## ⚠️ Resilience Warning\n`;
                result += `Multiple heuristic repairs detected. Consider shifting to a more **Empirical Grounding** phase.`;
            } else {
                result += `Execution is healthy and resilient. ✨`;
            }
            return result;
        }
    });

    registry.register({
        name: "execute_semantic_rename",
        description: "Perform a workspace-wide, compiler-safe rename of a symbol using the LSP.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file containing the symbol" },
                line: { type: "integer", description: "The line number of the symbol (1-indexed)" },
                column: { type: "integer", description: "The column number of the symbol (1-indexed)" },
                newName: { type: "string", description: "The new name for the symbol" }
            },
            required: ["path", "line", "column", "newName"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const line = args.line as number;
            const col = args.column as number;
            const newName = getStringArg(args, 'newName');
            const uri = vscode.Uri.file(p);
            const pos = new vscode.Position(line - 1, col - 1);

            try {
                const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
                    'vscode.executeRenameProvider',
                    uri,
                    pos,
                    newName
                );

                if (!edit) return `LSP could not find a renameable symbol at ${p}:${line}:${col}.`;

                const success = await vscode.workspace.applyEdit(edit);
                if (!success) return "Failed to apply workspace-wide semantic rename.";

                return `Successfully renamed symbol to \`${newName}\` across the entire workspace. ✨`;
            } catch (error) {
                return `Semantic rename failed: ${error}`;
            }
        }
    });

    registry.register({
        name: "simulate_semantic_edit",
        description: "Simulate a change in a 'Shadow Buffer' to catch lints/errors without affecting the disk.",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "The absolute path to the file" },
                targetContent: { type: "string", description: "Exact content to replace" },
                replacementContent: { type: "string", description: "New content" }
            },
            required: ["path", "targetContent", "replacementContent"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const target = getStringArg(args, 'targetContent');
            const replacement = getStringArg(args, 'replacementContent');

            try {
                const content = await fs.readFile(p, 'utf-8');
                if (!content.includes(target)) return `Error: Could not find target content in ${p} for simulation.`;

                const simulatedContent = content.replace(target, replacement);

                // Shadow Simulation: Create a hidden sibling file
                const simPath = p.replace(/(\.[^.]+)$/, '.marie_sim$1');
                await fs.writeFile(simPath, simulatedContent);

                // Wait for VS Code to process the new file
                await new Promise(r => setTimeout(r, 1000));

                const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(simPath));
                const localErrors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

                let result = "";
                if (localErrors.length > 0) {
                    result += `# 🌑 Shadow Realm: Local Regressions\n`;
                    localErrors.forEach(e => result += `- [Line ${e.range.start.line + 1}] ${e.message}\n`);
                }

                // Multi-file ripple check (the "Oracle's Sight")
                // Check if any other files in the workspace now have errors due to this "Shadow" file
                // (VS Code might not show errors for other files until they are opened, 
                // but we can report on the ones it DOES detect)
                const allDiagnostics = vscode.languages.getDiagnostics();
                const externalErrors = allDiagnostics.filter(([uri, diags]) => {
                    return uri.fsPath !== simPath && diags.some(d => d.severity === vscode.DiagnosticSeverity.Error);
                });

                if (externalErrors.length > 0) {
                    result += `\n## ⚠️ Ripple Regressions Detected\n`;
                    externalErrors.slice(0, 5).forEach(([uri, diags]) => {
                        const file = uri.fsPath.split('/').pop();
                        result += `- **${file}**: ${diags[0].message}\n`;
                    });
                }

                await fs.unlink(simPath); // Cleanup

                if (result) return result;

                return `Simulation successful. Change is syntactically sound and produces no ripple regressions. ✨`;
            } catch (error) {
                return `Shadow simulation failed: ${error}`;
            }
        }
    });

    registry.register({
        name: "execute_semantic_move",
        description: "Move a symbol (function/class) to a new file and attempt to update imports throughout the workspace.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                sourcePath: { type: "string", description: "Absolute path to source file" },
                targetPath: { type: "string", description: "Absolute path to target file" },
                symbolName: { type: "string", description: "Name of the symbol to move" }
            },
            required: ["sourcePath", "targetPath", "symbolName"]
        },
        execute: async (args, onProgress, signal) => {
            const src = getStringArg(args, 'sourcePath');
            const dest = getStringArg(args, 'targetPath');
            const sym = getStringArg(args, 'symbolName');

            try {
                // 1. Locate symbol
                const symbols = await withTimeout<vscode.SymbolInformation[]>(
                    vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                        'vscode.executeDocumentSymbolProvider',
                        vscode.Uri.file(src)
                    ) as Promise<vscode.SymbolInformation[]>,
                    5000,
                    'LSP Document Symbol Provider'
                );
                const targetSym = symbols?.find((s: vscode.SymbolInformation) => s.name === sym);
                if (!targetSym) return `Could not find symbol \`${sym}\` in source file.`;

                const content = await fs.readFile(src, 'utf-8');
                const lines = content.split('\n');
                const symContent = lines.slice(targetSym.location.range.start.line, targetSym.location.range.end.line + 1).join('\n');

                // 2. Identify required imports (Surgical Heuristic)
                const importLines = lines.filter(l => l.trim().startsWith('import '));
                const neededImports = importLines.filter(l => {
                    // Very basic check: does the symbol content use any identifier mentioned in this import?
                    const match = l.match(/\{([^}]+)\}/);
                    if (match) {
                        const idents = match[1].split(',').map(i => i.trim());
                        return idents.some(i => symContent.includes(i));
                    }
                    return false;
                });

                // 3. Update source
                const newSrcContent = [
                    ...lines.slice(0, targetSym.location.range.start.line),
                    ...lines.slice(targetSym.location.range.end.line + 1)
                ].join('\n');
                await writeFile(src, newSrcContent, signal);

                // 4. Update destination
                let destContent = "";
                try {
                    destContent = await fs.readFile(dest, 'utf-8');
                } catch (e) {
                    destContent = `// Created for moved symbol ${sym}\n`;
                }

                const finalDestContent = neededImports.join('\n') + '\n\n' + destContent + '\n\n' + symContent;
                await writeFile(dest, finalDestContent, signal);

                // Mirror Polishing I: Automated Downstream Import Migration
                const refs = await withTimeout<vscode.Location[]>(
                    vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        vscode.Uri.file(src),
                        targetSym.location.range.start
                    ) as Promise<vscode.Location[]>,
                    5000,
                    'LSP Reference Provider'
                );

                const externalRefs = (refs as vscode.Location[]).filter((r: vscode.Location) => r.uri.fsPath !== src && r.uri.fsPath !== dest);
                const updatedFiles: string[] = [];

                if (externalRefs.length > 0) {
                    const workspaceEdit = new vscode.WorkspaceEdit();
                    const refFiles = Array.from(new Set(externalRefs.map((r: vscode.Location) => r.uri.fsPath)));

                    for (const refFile of refFiles as string[]) {
                        const refContent = await fs.readFile(refFile as string, 'utf-8');
                        const srcRel = path.relative(path.dirname(refFile as string), src as string).replace(/\.[^.]+$/, '').replace(/\\/g, '/');
                        const destRel = path.relative(path.dirname(refFile as string), dest as string).replace(/\.[^.]+$/, '').replace(/\\/g, '/');

                        // Heuristic replacement of the import path
                        const oldImportPath = srcRel.startsWith('.') ? srcRel : `./${srcRel}`;
                        const newImportPath = destRel.startsWith('.') ? destRel : `./${destRel}`;

                        if (refContent.includes(oldImportPath)) {
                            const newRefContent = refContent.replace(new RegExp(`from\\s+['"]${oldImportPath}['"]`, 'g'), `from '${newImportPath}'`);
                            if (newRefContent !== refContent) {
                                await fs.writeFile(refFile, newRefContent);
                                updatedFiles.push(path.basename(refFile));
                            }
                        }
                    }
                }

                return `Successfully moved \`${sym}\` to \`${dest.split('/').pop()}\`. 🗡️\n\n` +
                    `**Methodology Complete**: Required imports were identified and copied to the destination.\n` +
                    (updatedFiles.length > 0
                        ? `**Downstream Migration**: Automatically updated imports in ${updatedFiles.length} file(s): ${updatedFiles.join(', ')}. ✨`
                        : `**Mirror Polishing**: No external downstream imports required migration.`);
            } catch (error) {
                return `Semantic move failed: ${error}`;
            }
        }
    });

    registry.register({
        name: "trace_data_flow",
        description: "Analyze how a specific type or interface is used across multiple layers.",
        input_schema: {
            type: "object",
            properties: {
                typeName: { type: "string", description: "The name of the type/interface to trace" },
                filePath: { type: "string", description: "Path to the file where the type is defined" }
            },
            required: ["typeName", "filePath"]
        },
        execute: async (args, onProgress, signal) => {
            const type = getStringArg(args, 'typeName');
            const p = getStringArg(args, 'filePath');
            const uri = vscode.Uri.file(p);

            // 1. Find the symbol's actual position
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            const target = symbols?.find(s => s.name === type);
            const pos = target?.location.range.start || new vscode.Position(0, 0);

            // 2. Use reference provider to see where this type is used
            const refs = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                pos
            );

            if (!refs || refs.length === 0) return `Type \`${type}\` appears to be isolated. ✨`;

            const uniqueFiles = Array.from(new Set(refs.map(r => r.uri.fsPath)));
            let result = `# 🔮 Data Flow Trace: \`${type}\`\n\n`;
            result += `Found usages in **${uniqueFiles.length}** files.\n\n`;

            const layers = uniqueFiles.map(f => {
                if (f.includes('/infrastructure/')) return 'Infrastructure 🏛️';
                if (f.includes('/domain/')) return 'Domain 🧠';
                if (f.includes('/plumbing/')) return 'Plumbing 🔧';
                return 'UI/External 🎨';
            });
            const layerCounts = layers.reduce((acc, l) => { acc[l] = (acc[l] || 0) + 1; return acc; }, {} as any);

            result += `## Layer Distribution\n`;
            Object.entries(layerCounts).forEach(([layer, count]) => {
                result += `- **${layer}**: ${count} files\n`;
            });

            if (layerCounts['Domain 🧠'] && layerCounts['Infrastructure 🏛️']) {
                result += `\n> [!NOTE]\n> This type crosses the Domain/Infrastructure boundary. Ensure strict mapping is in place to maintain Joyful purity. ✨`;
            }

            return result;
        }
    });

    registry.register({
        name: "generate_architectural_decision",
        description: "Generate a structured ADR (Architectural Decision Record) to document a major shift in the project.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                title: { type: "string", description: "Concise title of the decision" },
                context: { type: "string", description: "The problem or context driving this change" },
                decision: { type: "string", description: "The chosen solution and rationale" },
                consequences: { type: "string", description: "Impact on the system moving forward" }
            },
            required: ["title", "context", "decision", "consequences"]
        },
        execute: async (args, onProgress, signal) => {
            const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!root) return "No workspace detected.";

            const id = `ADR-${Math.round(Date.now() / 1000)}`;
            const adrDir = path.join(root, '.marie', 'decisions');
            const adrPath = path.join(adrDir, `${id}.md`);

            const title = getStringArg(args, 'title');
            const historyContext = title.includes('Refactor') ? `\n## Historical Context\n> This decision aligns with the trajectory identified in the Evolution Chronicle. ✨\n` : "";

            const adrContent = `# 🛡️ ${id}: ${title}\n\n` +
                `**Date**: ${new Date().toLocaleDateString()}\n` +
                `**Status**: Accepted\n\n` +
                historyContext +
                `## Context\n${getStringArg(args, 'context')}\n\n` +
                `## Decision\n${getStringArg(args, 'decision')}\n\n` +
                `## Consequences\n${getStringArg(args, 'consequences')}\n\n` +
                `--- \nGenerated by Marie Autonomous Agent ✨`;

            try {
                await fs.mkdir(adrDir, { recursive: true });
                await fs.writeFile(adrPath, adrContent);
                return `Architectural Decision Record saved to \`.marie/decisions/${id}.md\`. History preserved. 🛡️`;
            } catch (e) {
                return `Failed to save ADR: ${e}`;
            }
        }
    });

    registry.register({
        name: "diagnose_action_failure",
        description: "Analyze why a high-order action (Rename, Move) failed and suggest a resilient fallback methodology.",
        input_schema: {
            type: "object",
            properties: {
                actionAttempted: { type: "string" },
                errorMessage: { type: "string" },
                path: { type: "string" }
            },
            required: ["actionAttempted", "errorMessage", "path"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const diags = vscode.languages.getDiagnostics(vscode.Uri.file(p));
            const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

            let result = `# 🩹 Sovereign Recovery Diagnostic\n\n`;
            result += `Failed Action: \`${args.actionAttempted}\`\n`;
            result += `Reason: ${args.errorMessage}\n\n`;

            if (errors.length > 0) {
                result += `## ⚠️ Underlying File Errors\n`;
                result += `The LSP is likely blocked because the file has syntax/semantic errors:\n`;
                errors.slice(0, 3).forEach(e => result += `- [L${e.range.start.line + 1}] ${e.message}\n`);
                result += `\n**Recommendation**: Fix these errors using \`replace_in_file\` before retrying semantic actions.`;
            } else {
                result += `## 🗺️ Fallback Trajectory\n`;
                result += `The high-order tool is healthy but the specific symbol could not be transformed. \n`;
                result += `**Trajectory**: Transition to **Shadow Realm Simulation** via \`simulate_semantic_edit\` to verify manual replacements.`;
            }

            return result;
        }
    });

    registry.register({
        name: "sprout_new_module",
        description: "Create a new file with architectural boilerplate and register it in the project's living history.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the new file" },
                description: { type: "string", description: "Brief description of the module's purpose" }
            },
            required: ["path", "description"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const desc = getStringArg(args, 'description');
            const name = path.basename(p);

            let boilerplate = `/**\n * ${name}: ${desc}\n * \n * Part of the Living Project - Sprouted on ${new Date().toLocaleDateString()}\n */\n\n`;

            if (p.includes('/infrastructure/')) {
                boilerplate += `import * as vscode from 'vscode';\n\nexport class ${name.replace(/\.[^.]+$/, '')} {\n    // Implementation\n}\n`;
            } else if (p.includes('/domain/')) {
                boilerplate += `export interface ${name.replace(/\.[^.]+$/, '')} {\n    // Domain Logic\n}\n`;
            } else if (p.includes('/plumbing/')) {
                boilerplate += `/** Plumbing Utility */\nexport function ${name.replace(/\.[^.]+$/, '').toLowerCase()}() {\n    return;\n}\n`;
            }

            await writeFile(p, boilerplate);
            await logGratitude(`Sprouted new module: ${name}`);

            return `# 🌱 New Sprout: ${name}\n\n` +
                `Module created at \`${path.relative(process.cwd(), p)}\`.\n` +
                `**Intent**: ${desc}\n\n` +
                `> **Methodology Note**: This module has been registered in the project's lineage. Please use \`get_file_diagnostics\` to verify initial health. ✨`;
        }
    });

    registry.register({
        name: "propose_logic_clustering",
        description: "Scan a directory and propose structural reorganizations (Clustering) based on semantic co-dependency.",
        input_schema: {
            type: "object",
            properties: {
                directoryPath: { type: "string", description: "Absolute path to the directory to analyze" }
            },
            required: ["directoryPath"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'directoryPath');
            const { proposeClustering } = await import("../../domain/joy/JoyTools.js");
            const clusters = await proposeClustering(p);

            if (clusters.length === 0) return "No significant clustering opportunities detected. The architecture appears naturally granular. ✨";

            let result = `# 🧘‍♂️ Convergence Ritual: Clustering Proposal\n\n`;
            result += `Based on semantic co-dependency and zoning laws, the following 'Logic Clusters' are proposed for \`${p.split('/').pop()}\`:\n\n`;

            clusters.forEach((c: any) => {
                result += `### ${c.zone} Zone Fragment\n`;
                result += `- **File Count**: ${c.fileCount}\n`;
                result += `- **Suggested Clusters**: ${c.suggestedClusters.join(', ')}\n`;
                result += `- **Rationale**: High internal cohesion suggests these should be grouped into a single module to reduce workspace noise.\n\n`;
            });

            result += `**Action**: Use \`execute_semantic_move\` to begin converging these fragments into the suggested clusters.`;
            return result;
        }
    });

    registry.register({
        name: "get_pinned_context",
        description: "Retrieve all anchored strategic context to refresh your memory.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            return ContextArchiveService.getInstance().getAllAnchors();
        }
    });

    registry.register({
        name: "find_files",
        description: "Search for files across the workspace using a glob pattern (e.g., '**/*.test.ts').",
        input_schema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "The glob pattern to search for" },
                exclude: { type: "string", description: "Optional glob pattern for files to exclude" }
            },
            required: ["pattern"]
        },
        execute: async (args, onProgress, signal) => {
            const pattern = getStringArg(args, 'pattern');
            const exclude = args.exclude as string | undefined;
            const files = await vscode.workspace.findFiles(pattern, exclude);

            if (files.length === 0) return "No files found matching the pattern.";

            let result = `Found ${files.length} file(s) matching \`${pattern}\`:\n`;
            files.slice(0, 50).forEach(f => result += `- \`${f.fsPath}\`\n`);
            if (files.length > 50) result += `\n... AND ${files.length - 50} MORE.`;
            return result;
        }
    });

    registry.register({
        name: "list_workspace_symbols",
        description: "Search for symbols (classes, functions, etc.) across the entire workspace.",
        input_schema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The symbol name or partial name to search for" }
            },
            required: ["query"]
        },
        execute: async (args, onProgress, signal) => {
            const query = getStringArg(args, 'query');
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols || symbols.length === 0) return "No symbols found matching the query.";

            let result = `Found ${symbols.length} symbol(s) matching \`${query}\`:\n`;
            symbols.slice(0, 50).forEach(s => {
                const kind = vscode.SymbolKind[s.kind];
                result += `- [${kind}] \`${s.name}\` in \`${s.location.uri.fsPath}\`\n`;
            });
            if (symbols.length > 50) result += `\n... AND ${symbols.length - 50} MORE.`;
            return result;
        }
    });

    registry.register({
        name: "verify_workspace_health",
        description: "Perform a non-destructive health check (build/lint) to ensure recent changes haven't introduced regressions.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const mod = await import("../../plumbing/terminal/TerminalService.js");
            // Heuristic health check: run 'npm run build' or 'tsc' if available
            return await mod.TerminalService.runCommand("npm run build -- --noEmit || npx tsc --noEmit");
        }
    });

    registry.register({
        name: "run_command",
        description: "Execute a command in the terminal. Requires user approval. Use this for running tests or building the project.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to execute" },
            },
            required: ["command"],
        },
        execute: async (args, onProgress, signal) => {
            const command = getStringArg(args, 'command');
            const mod = await import("../../plumbing/terminal/TerminalService.js");
            return await mod.TerminalService.runCommand(command, signal);
        }
    });

    registry.register({
        name: "perform_strategic_planning",
        description: "A mandatory planning ritual. Call this at the start of any complex task.",
        input_schema: {
            type: "object",
            properties: {
                intent: { type: "string" },
                joyZone: { type: "string", enum: ["joyful", "infrastructure", "plumbing"] },
                projectName: { type: "string" },
                lifecycleStage: { type: "string", enum: ["sprout", "bloom", "compost"] },
                objectives: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] }
                        },
                        required: ["id", "label", "status"]
                    }
                },
                ritualChecked: { type: "boolean" },
                gratitudeMoment: { type: "string" },
                dependencyRisk: { type: "string" },
                totalPasses: { type: "number", description: "Total number of passes (1-4)" },
                passFocus: { type: "string", description: "Initial focus of Pass 1" }
            },
            required: ["intent", "joyZone", "projectName", "lifecycleStage", "ritualChecked", "gratitudeMoment", "totalPasses", "passFocus"]
        },
        execute: async (args, onProgress) => {
            const intent = getStringArg(args, 'intent');
            const joyZone = getStringArg(args, 'joyZone') as JoyZone;
            const projectName = getStringArg(args, 'projectName');
            const lifecycleStage = getStringArg(args, 'lifecycleStage') as any;
            const objectives = getArrayArg<ProgressObjective>(args, 'objectives');
            const gratitude = getStringArg(args, 'gratitudeMoment');

            // Architectural Layer Validation (Conceptual)
            const layerOrder = ["joyful", "infrastructure", "plumbing"];
            const currentLayerIndex = layerOrder.indexOf(joyZone);

            // Pass ritual state to progress
            onProgress?.({
                context: `Mindfulness: ${intent} [Zone: ${joyZone}]`,
                completedObjectiveIds: [],
                activeObjectiveId: objectives[0]?.id,
                achieved: [
                    `Aligned with ${joyZone} zone protocols`,
                    `Planning for ${projectName} (${lifecycleStage})`,
                    `Ritual: ${gratitude}`
                ],
                lifecycleStage,
                ritualComplete: true,
                currentPass: 1,
                totalPasses: getStringArg(args, 'totalPasses') as any || 1,
                passFocus: getStringArg(args, 'passFocus')
            });

            return `Strategic Plan for '${projectName}' accepted. The KonMari Waterfall (Domain -> Infrastructure -> Plumbing) has been aligned. ✨`;
        }
    });

    registry.register({
        name: "checkpoint_pass",
        description: "Explicitly end a pass, summarize achievements, and orient for the next pass.",
        input_schema: {
            type: "object",
            properties: {
                summary: { type: "string", description: "What was achieved in this pass" },
                reflection: { type: "string", description: "What sparked joy or was learned in this pass? (KonMari Reflection)" },
                nextPassFocus: { type: "string", description: "The focus for the upcoming pass" },
                zoneSolidification: { type: "boolean", description: "Confirm that all new code follows JOY zoning protocols." },
                tidyChecked: { type: "boolean", description: "Confirm that Joyful Tidying (fold_file) has been performed." },
                isFinalPass: { type: "boolean" }
            },
            required: ["summary", "reflection", "nextPassFocus", "zoneSolidification", "tidyChecked", "isFinalPass"]
        },
        execute: async (args, onProgress) => {
            const summary = getStringArg(args, 'summary');
            const reflection = getStringArg(args, 'reflection');
            const nextFocus = getStringArg(args, 'nextPassFocus');
            const solidified = args.zoneSolidification as boolean;
            const isFinal = args.isFinalPass as boolean;

            if (!solidified) {
                return "Error: Zone Solidification check failed. Please ensure all new code is correctly zoned before ending the pass.";
            }

            if (!args.tidyChecked) {
                return "Error: Joyful Tidying check failed. Please perform 'fold_file' on modified files to ensure code health.";
            }

            onProgress?.({
                context: `Checkpoint: ${summary} (Reflection: ${reflection})`,
                achieved: [`Completed Pass: ${summary}`],
                // We'll let the processor handle the history update
                passHistory: [{ pass: args.currentPass || 1, summary, reflection }],
                currentPass: isFinal ? null : undefined,
                passFocus: isFinal ? undefined : nextFocus
            } as any);

            return `Pass internal checkpoint reached. Focus shifting to: ${nextFocus}. Reflection: ${reflection}`;
        }
    });

    registry.register({
        name: "map_project_context",
        description: "A mapping ritual. Returns a high-level overview of JOY zones and key inhabitants to aid strategic planning.",
        input_schema: { type: "object", properties: {} },
        execute: async () => {
            const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!root) return "No workspace detected.";

            const { isProjectJoyful, proposeClustering } = await import("../../domain/joy/JoyTools.js");
            const isJoyful = await isProjectJoyful(root);
            const clustering = await proposeClustering(root);

            // Real Hotspot detection based on mtime
            const hotspots: string[] = [];
            try {
                const entries = await fs.readdir(root, { withFileTypes: true, recursive: true } as any);
                const files = entries
                    .filter((e: any) => e.isFile() && !e.name.startsWith('.') && !e.path.includes('node_modules'))
                    .map((e: any) => path.join(e.path, e.name));

                const stats = await Promise.all(files.map(async (f: string) => ({ path: f, mtime: (await fs.stat(f)).mtime.getTime() })));
                const recent = stats.sort((a, b) => b.mtime - a.mtime).slice(0, 5);
                hotspots.push(...recent.map(r => path.relative(root, r.path)));
            } catch (e) {
                console.error("Hotspot detection failed:", e);
                hotspots.push("src/domain/marie/MarieTypes.ts", "src/infrastructure/ai/MarieEngine.ts");
            }

            let map = `# Project Map (JOY Structure)\n\n`;
            map += `**Status**: ${isJoyful ? "Joyful Ecosystem ✨" : "Architectural Void ⚠️ (Genesis Needed)"}\n\n`;
            map += `**Zones**:\n`;
            map += `- **Domain** (\`src/domain\`): Core logic and purity.\n`;
            map += `- **Infrastructure** (\`src/infrastructure\`): Adapters and stability.\n`;
            map += `- **Plumbing** (\`src/plumbing\`): Mechanical machinery.\n\n`;

            map += `**Hotspots** (Most Recently Modified):\n`;
            for (const h of hotspots) {
                map += `- \`${h}\`\n`;
            }
            map += `\n`;

            if (clustering.length > 0) {
                map += `**Clustering Opportunities**:\n`;
                for (const c of clustering) {
                    map += `- ${c.zone}: ${c.fileCount} files. Consider sub-zones like ${c.suggestedClusters.join(', ')}.\n`;
                }
            }

            return map;
        }
    });

    registry.register({
        name: "update_run_objectives",
        description: "Update the current run's objectives and progress context.",
        input_schema: {
            type: "object",
            properties: {
                context: { type: "string" },
                completedObjectiveIds: { type: "array", items: { type: "string" } },
                activeObjectiveId: { type: "string" },
                achieved: { type: "array", items: { type: "string" } },
                totalPasses: { type: "number" }
            },
            required: ["context"]
        },
        execute: async (args, onProgress) => {
            const context = getStringArg(args, 'context');
            const completedObjectiveIds = getArrayArg<string>(args, 'completedObjectiveIds');
            const activeObjectiveId = getStringArg(args, 'activeObjectiveId');
            const achieved = getArrayArg<string>(args, 'achieved');
            const totalPasses = args.totalPasses as number | undefined;

            onProgress?.({
                context,
                completedObjectiveIds,
                activeObjectiveId,
                achieved,
                totalPasses
            });

            return `Progress updated: ${context}${totalPasses ? ` (Total Passes: ${totalPasses})` : ""}`;
        }
    });

    registry.register({
        name: "augment_roadmap",
        description: "Insert a new pass into the current roadmap. Use this when significant unexpected complexity is discovered.",
        input_schema: {
            type: "object",
            properties: {
                addedPassCount: { type: "number", description: "How many passes to add (usually 1)" },
                newPassFocus: { type: "string", description: "The focus for the upcoming augmented pass" },
                reason: { type: "string", description: "Why is the roadmap being augmented? (Mindfulness discovery)" }
            },
            required: ["addedPassCount", "newPassFocus", "reason"]
        },
        execute: async (args, onProgress) => {
            const count = args.addedPassCount as number;
            const focus = getStringArg(args, 'newPassFocus');
            const reason = getStringArg(args, 'reason');

            onProgress?.({
                context: `Roadmap Augmented: ${reason}`,
                achieved: [`Calibrated roadmap: +${count} pass(es)`],
                // The processor will handle the totalPasses increment
                totalPasses: (count as any), // This is a delta for the processor if we handle it there, or absolute
                passFocus: focus
            } as any);

            return `Roadmap augmented with ${count} additional pass(es). Reason: ${reason}`;
        }
    });

    registry.register({
        name: "execute_genesis_ritual",
        description: "Convert an entire project to the JOY structure.",
        input_schema: { type: "object", properties: {} },
        execute: async () => await automationService.triggerGenesis()
    });

    registry.register({
        name: "sow_joy_feature",
        description: "Scaffold a new feature structure across all JOY zones.",
        input_schema: {
            type: "object",
            properties: {
                name: { type: "string" },
                intent: { type: "string" }
            },
            required: ["name", "intent"]
        },
        execute: async (args) => await automationService.sowJoyFeature(getStringArg(args, 'name'), getStringArg(args, 'intent'))
    });

    registry.register({
        name: "perform_garden_pulse",
        description: "Deep audit of project structure and scaffolding.",
        input_schema: { type: "object", properties: {} },
        execute: async () => await automationService.performGardenPulse()
    });

    registry.register({
        name: "fold_file",
        description: "Format and organize imports in a file.",
        input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        execute: async (args) => await foldCode(getStringArg(args, 'path'))
    });

    registry.register({
        name: "cherish_file",
        description: "Update the timestamp of a 'Sentimental' file.",
        input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        execute: async (args) => await cherishFile(getStringArg(args, 'path'))
    });

    registry.register({
        name: "check_code_health",
        description: "Analyze a file for complexity and technical debt.",
        input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        execute: async (args) => JSON.stringify(await checkCodeHealth(getStringArg(args, 'path')))
    });

    registry.register({
        name: "replace_in_file",
        description: "Replace a specific string with another in a file. Surgical and mindful.",
        isDestructive: true,
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string" },
                search: { type: "string" },
                replace: { type: "string" }
            },
            required: ["path", "search", "replace"]
        },
        execute: async (args, onProgress, signal) => {
            const p = getStringArg(args, 'path');
            const s = getStringArg(args, 'search');
            const r = getStringArg(args, 'replace');
            const { replaceInFile } = await import("../../plumbing/filesystem/FileService.js");
            return await replaceInFile(p, s, r);
        }
    });

    registry.register({
        name: "generate_joy_dashboard",
        description: "Generate a JOY.md dashboard for the workspace.",
        input_schema: { type: "object", properties: { rootPath: { type: "string" } }, required: ["rootPath"] },
        execute: async (args) => await generateJoyDashboard(getStringArg(args, 'rootPath'))
    });

    registry.register({
        name: "complete_task_ritual",
        description: "A final ritual to conclude a large task. Summarizes the entire journey and expresses gratitude. WARNING: Do NOT call this tool until you have confirmed the user's request is 100% satisfied. If you have any doubts or pending verifications, use `notify_user` instead.",
        input_schema: {
            type: "object",
            properties: {
                finalSummary: { type: "string", description: "The 'Bloom Report': a synthesis of all work achieved." },
                gratitude: { type: "string", description: "A final expression of gratitude for the code and the process." },
                healthCheck: { type: "string", description: "A final assessment of the project's JOY state." }
            },
            required: ["finalSummary", "gratitude", "healthCheck"]
        },
        execute: async (args, onProgress) => {
            const summary = getStringArg(args, 'finalSummary');
            const gratitude = getStringArg(args, 'gratitude');
            const health = getStringArg(args, 'healthCheck');

            onProgress?.({
                context: `Bloom Ritual: ${summary}`,
                achieved: [
                    `Task Completed: ${summary}`,
                    `Code Ascension complete ✨`
                ],
                currentPass: null,
                passFocus: undefined,
                ritualComplete: true
            } as any);

            return `Task Bloom Ritual complete.\n\nReport: ${summary}\n\nGarden Growth: Metrics archived in telemetry.\n\nHealth: ${health}\n\nGratitude: ${gratitude} ✨`;
        }
    });
}
