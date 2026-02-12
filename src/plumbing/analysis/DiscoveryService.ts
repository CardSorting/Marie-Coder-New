import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DiscoveryService {
    /**
     * Returns a recursive, tree-like overview of a folder's structure.
     */
    public static async getFolderTree(folderPath: string, maxDepth: number = 3): Promise<string> {
        try {
            const rootName = path.basename(folderPath);
            let result = `# Folder Structure: ${rootName}\n\n`;
            result += await this.generateTree(folderPath, "", 0, maxDepth);
            return result;
        } catch (error) {
            throw new Error(`Failed to generate folder tree for ${folderPath}: ${error}`);
        }
    }

    private static async generateTree(dir: string, indent: string, currentDepth: number, maxDepth: number): Promise<string> {
        if (currentDepth > maxDepth) return "";

        let result = "";
        const entries = await fs.readdir(dir, { withFileTypes: true });

        // Sort: directories first, then files
        const sortedEntries = entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
        });

        // Filter first to get accurate isLast calculation
        const visibleEntries = sortedEntries.filter(e =>
            !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'out'
        );

        for (let i = 0; i < visibleEntries.length; i++) {
            const entry = visibleEntries[i];
            const isLast = i === visibleEntries.length - 1;
            const prefix = isLast ? "└── " : "├── ";
            const nextIndent = indent + (isLast ? "    " : "│   ");

            result += `${indent}${prefix}${entry.name}${entry.isDirectory() ? "/" : ""}\n`;

            if (entry.isDirectory()) {
                result += await this.generateTree(path.join(dir, entry.name), nextIndent, currentDepth + 1, maxDepth);
            }
        }

        return result;
    }
}
