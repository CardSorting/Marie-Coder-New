import * as fs from 'fs/promises';
import * as path from 'path';
import { checkCodeHealth } from './CodeHealthService';

export interface JoyMap {
    overallJoyScore: number;
    totalFilesScanned: number;
    hotspots: { path: string, joyScore: number, clutterLevel: string }[];
    summary: string;
}

/**
 * Generates a project-wide "Joy Map" to help Marie prioritize tidying.
 */
export class JoyMapService {
    public static async generate(workspaceRoot: string): Promise<JoyMap> {
        const srcPath = path.join(workspaceRoot, 'src');
        const files = await this.findTsFiles(srcPath);

        const results: { path: string, joyScore: number, clutterLevel: string }[] = [];
        let totalScore = 0;

        // Limit scan to 50 files for performance
        const targetFiles = files.slice(0, 50);

        for (const file of targetFiles) {
            try {
                const health = await checkCodeHealth(file);
                results.push({
                    path: path.relative(workspaceRoot, file),
                    joyScore: health.joyScore,
                    clutterLevel: health.joyScore < 60 ? 'Toxic' : (health.joyScore < 80 ? 'Tangled' : 'Clean')
                });
                totalScore += health.joyScore;
            } catch (e) {
                console.error(`Failed to scan ${file}`, e);
            }
        }

        const averageScore = targetFiles.length > 0 ? Math.floor(totalScore / targetFiles.length) : 100;
        const hotspots = results
            .sort((a, b) => a.joyScore - b.joyScore)
            .filter(r => r.joyScore < 70)
            .slice(0, 5);

        return {
            overallJoyScore: averageScore,
            totalFilesScanned: targetFiles.length,
            hotspots,
            summary: `The project has an average Joy Score of ${averageScore}. ` +
                (hotspots.length > 0 ? `We found ${hotspots.length} hotspots that need immediate attention.` : 'The Garden is looking pristine! ✨')
        };
    }

    private static async findTsFiles(dir: string): Promise<string[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
            const res = path.resolve(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
                return this.findTsFiles(res);
            } else {
                return (res.endsWith('.ts') || res.endsWith('.tsx')) ? [res] : [];
            }
        }));
        return files.flat();
    }
}
