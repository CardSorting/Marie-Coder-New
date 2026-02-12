import * as vscode from 'vscode';
import { readFile } from '../filesystem/FileService.js';

export class DependencyService {
    /**
     * Extracts imports and exports from a file to map its structural network.
     */
    public static async getFileNetwork(filePath: string): Promise<string> {
        try {
            const content = await readFile(filePath);

            // Heuristic regex patterns for ESM imports and exports
            const importRegex = /import\s+(?:.*?\s+from\s+)?['"](.*?)['"]/g;
            const exportRegex = /export\s+(?:const|class|function|type|interface|enum|default)\s+(\w+)/g;

            const imports: string[] = [];
            const exports: string[] = [];

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
            while ((match = exportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }

            let result = `# File Network: ${filePath.split('/').pop()}\n\n`;

            result += `## 📥 Imports (Dependencies)\n`;
            if (imports.length > 0) {
                imports.forEach(i => result += `- \`${i}\`\n`);
            } else {
                result += `*None detected (Self-contained logic)*\n`;
            }

            result += `\n## 📤 Exports (Offerings)\n`;
            if (exports.length > 0) {
                exports.forEach(e => result += `- \`${e}\`\n`);
            } else {
                result += `*None detected (Internal consumer)*\n`;
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to map network for ${filePath}: ${error}`);
        }
    }

    /**
     * STABILITY: Circular Dependency Guard
     * Detects if two files depend on each other, which can cause initialization death spirals.
     */
    public static async checkCircularity(fileA: string, fileB: string): Promise<boolean> {
        // Placeholder for future graph analysis
        return false;
    }
}
