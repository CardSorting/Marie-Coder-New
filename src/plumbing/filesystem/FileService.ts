import * as vscode from "vscode";
import { ConfigService } from "../../infrastructure/config/ConfigService.js";
import { resolvePath } from "./PathResolver.js";
import { DecorationService } from "../ui/DecorationService.js";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

// SPECTRAL INTEGRITY: Fine-Grained Path Locking (RWLock)
class PathLock {
    private readers = 0;
    private writer = false;
    private queue: (() => void)[] = [];

    async acquireRead() {
        while (this.writer) await new Promise<void>(res => this.queue.push(res));
        this.readers++;
    }
    releaseRead() {
        this.readers--;
        this._next();
    }
    async acquireWrite() {
        while (this.writer || this.readers > 0) await new Promise<void>(res => this.queue.push(res));
        this.writer = true;
    }
    releaseWrite() {
        this.writer = false;
        this._next();
    }
    private _next() {
        const q = [...this.queue];
        this.queue = [];
        q.forEach(resolve => resolve());
    }
}

const pathLocks = new Map<string, PathLock>();
const backups = new Map<string, string>();
const getLock = (path: string) => {
    if (!pathLocks.has(path)) pathLocks.set(path, new PathLock());
    return pathLocks.get(path)!;
};

export async function readFile(filePath: string, startLine?: number, endLine?: number, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Error(`AbortError: Read of ${filePath} aborted.`);
    const uri = resolvePath(filePath);
    const lock = getLock(uri.fsPath);

    await lock.acquireRead();
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            if (!uri.fsPath.startsWith(workspaceRoot)) {
                throw new Error(`Security Error: Path ${filePath} is outside the workspace boundary.`);
            }
        }
        // INDUSTRIAL STABILITY: Prevent reading massive files that could crash the extension host
        const MAX_READ_SIZE = 5 * 1024 * 1024; // 5MB
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.size > MAX_READ_SIZE && startLine === undefined && endLine === undefined) {
                return `Error: File ${filePath} is too large to read entirely (${(stat.size / 1024 / 1024).toFixed(1)} MB). Use line-based reading for large files.`;
            }
        } catch (e: any) {
            if (e.code !== 'FileNotFound') {
                console.warn(`[FileService] Stat failed for ${filePath}: ${e.message}`);
            }
        }

        const uint8Array = await vscode.workspace.fs.readFile(uri);
        if (signal?.aborted) throw new Error(`AbortError: Read of ${filePath} aborted.`);
        const text = textDecoder.decode(uint8Array);

        if (startLine !== undefined || endLine !== undefined) {
            const lines = text.split('\n');
            const start = startLine !== undefined ? Math.max(0, startLine - 1) : 0;
            const end = endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;
            return lines.slice(start, end).join('\n');
        }

        return text;
    } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error}`);
    } finally {
        lock.releaseRead();
    }
}

export async function writeFile(filePath: string, content: string, signal?: AbortSignal, expectedMtime?: number): Promise<void> {
    if (signal?.aborted) throw new Error(`AbortError: Write to ${filePath} aborted.`);
    const uri = resolvePath(filePath);
    const lock = getLock(uri.fsPath);

    await lock.acquireWrite();
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            if (!uri.fsPath.startsWith(workspaceRoot)) {
                throw new Error(`Security Error: Path ${filePath} is outside the workspace boundary.`);
            }
        }
        console.log(`[FileService] writeFile called with path: ${filePath}, resolved URI: ${uri.fsPath}`);

        // Ensure the parent directory exists
        const parentDir = vscode.Uri.file(uri.fsPath.substring(0, uri.fsPath.lastIndexOf('/')));
        try {
            await vscode.workspace.fs.stat(parentDir);
        } catch {
            console.log(`[FileService] Parent directory doesn't exist, creating: ${parentDir.fsPath}`);
            await vscode.workspace.fs.createDirectory(parentDir);
        }

        if (signal?.aborted) throw new Error(`AbortError: Write to ${filePath} aborted.`);

        // INTIMATE STABILITY: Check for external modifications
        try {
            const currentStat = await vscode.workspace.fs.stat(uri);
            if (expectedMtime && currentStat.mtime > expectedMtime + 1000) { // 1s tolerance
                console.warn(`[FileService] EXTERNAL MODIFICATION DETECTED for ${filePath}. File mtime: ${currentStat.mtime}, Expected: ${expectedMtime}`);
            }
        } catch (e) { /* File doesn't exist, proceed */ }

        // SUB-ATOMIC INTEGRITY: Atomic Write Pattern
        // Write to a .tmp file first, then rename to ensure target is never corrupt
        const tmpUri = vscode.Uri.file(`${uri.fsPath}.tmp.${Math.random().toString(36).substring(2, 9)}`);

        console.log(`[FileService] Performing ATOMIC write to ${filePath} via ${tmpUri.fsPath}`);
        await vscode.workspace.fs.writeFile(tmpUri, textEncoder.encode(content));

        if (signal?.aborted) {
            try { await vscode.workspace.fs.delete(tmpUri); } catch (e) { /* ignore cleanup error */ }
            throw new Error(`AbortError: Write to ${filePath} aborted during commit.`);
        }

        // Apply atomic move (rename)
        await vscode.workspace.fs.rename(tmpUri, uri, { overwrite: true });
        console.log(`[FileService] Atomic write completed successfully for ${filePath}`);

        // Verify and show the document
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Active });

        // Highlight the new content
        const firstLine = doc.lineAt(0);
        const lastLine = doc.lineAt(doc.lineCount - 1);
        const range = new vscode.Range(firstLine.range.start, lastLine.range.end);

        editor.revealRange(range, vscode.TextEditorRevealType.Default);
        DecorationService.decorateCreation(editor, range);

    } catch (error) {
        console.error(`[FileService] Error during atomic write: ${error}`);
        throw new Error(`Failed to write file ${filePath}: ${error}`);
    } finally {
        lock.releaseWrite();
    }
}

export async function deleteFile(filePath: string): Promise<void> {
    const uri = resolvePath(filePath);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        if (!uri.fsPath.startsWith(workspaceRoot)) {
            throw new Error(`Security Error: Path ${filePath} is outside the workspace boundary.`);
        }
    }
    try {
        const edit = new vscode.WorkspaceEdit();
        edit.deleteFile(uri, { ignoreIfNotExists: true, recursive: true });

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            throw new Error(`VS Code failed to apply WorkspaceEdit (delete) for ${filePath}`);
        }
    } catch (error) {
        throw new Error(`Failed to delete file ${filePath}: ${error}`);
    }
}

const MAX_SEARCH_MATCHES = 50;

/**
 * Searches for a string within files in a given directory.
 * NOTE: This implementation traverses the directory manually. 
 * For simple filename searches, vscode.workspace.findFiles is preferred.
 */
export async function searchFiles(query: string, searchPath: string, signal?: AbortSignal): Promise<string> {
    const startUri = resolvePath(searchPath);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        if (!startUri.fsPath.startsWith(workspaceRoot)) {
            throw new Error(`Security Error: Path ${searchPath} is outside the workspace boundary.`);
        }
    }
    const results: { path: string, matches: { line: number, content: string }[] }[] = [];

    const excludedDirs = new Set(ConfigService.getExcludedFiles());
    const visitedUris = new Set<string>();

    async function searchDir(dirUri: vscode.Uri, depth: number) {
        if (signal?.aborted) return;
        if (results.length >= MAX_SEARCH_MATCHES) return;
        if (depth > 25) {
            console.warn(`[FileService] Max recursion depth reached at ${dirUri.fsPath}`);
            return;
        }

        const dirKey = dirUri.toString();
        if (visitedUris.has(dirKey)) {
            console.warn(`[FileService] Circular symlink or redundant path ignored: ${dirKey}`);
            return;
        }
        visitedUris.add(dirKey);

        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch (error) {
            return;
        }

        for (const [name, type] of entries) {
            if (signal?.aborted) return;
            if (results.length >= MAX_SEARCH_MATCHES) return;

            const fullUri = vscode.Uri.joinPath(dirUri, name);

            if (type === vscode.FileType.Directory) {
                if (excludedDirs.has(name)) continue;
                await searchDir(fullUri, depth + 1);
            } else if (type === vscode.FileType.File) {
                if (name.endsWith('.log') || name.endsWith('.lock')) continue;

                try {
                    const uint8Array = await vscode.workspace.fs.readFile(fullUri);
                    const content = textDecoder.decode(uint8Array);

                    if (content.includes(query)) {
                        const fileMatches: { line: number, content: string }[] = [];
                        const lines = content.split('\n');
                        lines.forEach((lineText, idx) => {
                            if (lineText.includes(query)) {
                                fileMatches.push({ line: idx + 1, content: lineText.trim() });
                            }
                        });

                        if (fileMatches.length > 0) {
                            results.push({ path: fullUri.fsPath, matches: fileMatches });
                        }
                    }
                } catch (error) {
                    // Ignore binary files or read errors
                }
            }
        }
    }

    await searchDir(startUri, 0);
    if (signal?.aborted) return "Search aborted by user.";

    if (results.length === 0) return "No matches found.";

    let output = "";
    results.forEach(res => {
        output += `\n📄 ${res.path}\n`;
        res.matches.forEach(m => {
            output += `  L${m.line}: ${m.content}\n`;
        });
    });

    return results.length >= MAX_SEARCH_MATCHES
        ? `${output}\n\n(Limit reached: showing first ${MAX_SEARCH_MATCHES} files with matches)`
        : output;
}

export async function replaceInFile(filePath: string, search: string, replace: string): Promise<string> {
    const uri = resolvePath(filePath);
    const lock = getLock(uri.fsPath);

    await lock.acquireWrite();
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();

        const occurrences = text.split(search).length - 1;
        if (occurrences === 0) {
            throw new Error(`Search term not found in file ${filePath}`);
        }
        if (occurrences > 1) {
            throw new Error(`Ambiguous replacement: Search term found ${occurrences} times in ${filePath}. Please provide more context (neighboring lines) to ensure surgical precision.`);
        }

        const index = text.indexOf(search);
        const startPos = doc.positionAt(index);
        const endPos = doc.positionAt(index + search.length);

        const edit = new vscode.WorkspaceEdit();
        const replaceRange = new vscode.Range(startPos, endPos);
        edit.replace(uri, replaceRange, replace);

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            throw new Error(`VS Code failed to apply WorkspaceEdit (replace) for ${filePath}`);
        }

        await doc.save();
        const editor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Active });

        const newEndPos = doc.positionAt(index + replace.length);
        const newRange = new vscode.Range(startPos, newEndPos);

        editor.revealRange(newRange, vscode.TextEditorRevealType.InCenter);
        DecorationService.decorateModification(editor, newRange);

        return `Successfully replaced content in ${filePath}. ✨`;
    } catch (error) {
        throw new Error(`Failed to replace in file ${filePath}: ${error}`);
    } finally {
        lock.releaseWrite();
    }
}

export async function listFiles(dirPath: string, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Error(`AbortError: List directory ${dirPath} aborted.`);
    const uri = resolvePath(dirPath);
    const lock = getLock(uri.fsPath);

    await lock.acquireRead();
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            if (!uri.fsPath.startsWith(workspaceRoot)) {
                throw new Error(`Security Error: Path ${dirPath} is outside the workspace boundary.`);
            }
        }
        const entries = await vscode.workspace.fs.readDirectory(uri);
        const results = await Promise.all(entries.map(async ([name, type]) => {
            const fullUri = vscode.Uri.joinPath(uri, name);
            let size = 0;
            if (type === vscode.FileType.File) {
                try {
                    const stat = await vscode.workspace.fs.stat(fullUri);
                    size = stat.size;
                } catch { }
            }

            const typeStr = type === vscode.FileType.Directory ? "DIR " : "FILE";
            const sizeStr = type === vscode.FileType.File ? ` (${(size / 1024).toFixed(1)} KB)` : "";
            return `${typeStr} ${name}${sizeStr}`;
        }));

        return results.join('\n') || "Directory is empty.";
    } catch (error) {
        throw new Error(`Failed to list files in ${dirPath}: ${error}`);
    } finally {
        lock.releaseRead();
    }
}
/**
 * Capture a file's content in memory before a destructive operation.
 */
export async function backupFile(filePath: string): Promise<void> {
    try {
        const content = await readFile(filePath);
        backups.set(filePath, content);
    } catch (e) {
        // If file doesn't exist, we'll store null/empty to represent "delete on rollback"
        backups.set(filePath, "__NON_EXISTENT__");
    }
}

/**
 * Restore a file from the memory backup.
 */
export async function restoreFile(filePath: string): Promise<void> {
    const content = backups.get(filePath);
    if (content === undefined) return;

    if (content === "__NON_EXISTENT__") {
        try { await deleteFile(filePath); } catch { }
    } else {
        await writeFile(filePath, content);
    }
    backups.delete(filePath);
}

export async function rollbackAll(): Promise<void> {
    const paths = Array.from(backups.keys());
    for (const p of paths) {
        await restoreFile(p);
    }
    backups.clear();
}

export function clearBackups(): void {
    backups.clear();
}
