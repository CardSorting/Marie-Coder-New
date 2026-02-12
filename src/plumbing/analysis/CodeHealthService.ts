import * as fs from 'fs/promises';
import { getGratitudeMessage, getCelebrationMessage } from '../../prompts.js';
import { detectMigrationNeeds } from '../../domain/joy/JoyTools.js';

export interface HealthReport {
    path: string;
    lines: number;
    todos: number;
    anys: number;
    maxDepth: number;
    joyScore: number;
    clutter: {
        consoleLogs: number;
        commentedBlocks: number;
    };
    joyStatus: string;
    tips: string[];
    zoningHealth: {
        currentZone: string;
        isBackflowPresent: boolean;
        illegalImports: string[];
        migrationNeed?: { shouldMigrate: boolean, targetZone?: string, reason?: string };
    };
}

export async function checkCodeHealth(path: string): Promise<HealthReport> {
    try {
        const content = await fs.readFile(path, 'utf-8');
        const lines = content.split('\n');
        const totalLines = lines.length;
        const todos = (content.match(/TODO|FIXME/g) || []).length;

        // Refined 'any' detection to include 'as any' and type casting
        const anyRegex = /:\s*any\b|as\s+any\b|<\s*any\s*>/gi;
        const anys = (content.match(anyRegex) || []).length;
        const consoleLogs = (content.match(/console\.log/g) || []).length;

        const blockComments = (content.match(/\/\*[\s\S]*?\*\//g) || [] as string[]).filter((c: string) => c.split('\n').length > 2).length;

        let maxDepth = 0;
        lines.forEach(line => {
            const leadingWhitespace = line.match(/^\s*/)?.[0] || "";
            const spaces = leadingWhitespace.length;
            if (line.trim().length > 0) {
                // Heuristic: handle both 2-space and 4-space indentation
                const depth = Math.floor(spaces / 2);
                if (depth > maxDepth) maxDepth = depth;
            }
        });


        const filePath = path.replace(/\\/g, '/');

        const zoningHealth: HealthReport['zoningHealth'] = {
            currentZone: 'unknown',
            isBackflowPresent: false,
            illegalImports: [],
            migrationNeed: { shouldMigrate: false }
        };

        if (filePath.includes('/domain/')) zoningHealth.currentZone = 'domain';
        else if (filePath.includes('/infrastructure/')) zoningHealth.currentZone = 'infrastructure';
        else if (filePath.includes('/plumbing/')) zoningHealth.currentZone = 'plumbing';

        const imports = content.match(/import\s+.*\s+from\s+['"](.*)['"]*/g) || [] as string[];
        imports.forEach((imp: string) => {
            const match = imp.match(/from\s+['"](.*)['"]/);
            if (!match) return;
            const importPath = match[1].toLowerCase();

            // Downward Flow ONLY: Domain -> Infrastructure -> Plumbing
            if (zoningHealth.currentZone === 'plumbing') {
                if (importPath.includes('/domain/') || importPath.includes('/infrastructure/')) {
                    zoningHealth.isBackflowPresent = true;
                    zoningHealth.illegalImports.push(imp);
                }
            } else if (zoningHealth.currentZone === 'infrastructure') {
                if (importPath.includes('/domain/')) {
                    zoningHealth.isBackflowPresent = true;
                    zoningHealth.illegalImports.push(imp);
                }
            }
        });

        zoningHealth.migrationNeed = detectMigrationNeeds(path, content);

        let joyScore = 100;
        const tips: string[] = [];

        if (totalLines > 300) {
            joyScore -= 10;
            tips.push("• This file is growing large. Consider if it can be split to maintain focus.");
        }
        if (maxDepth > 5) {
            joyScore -= 15;
            tips.push("• Deep nesting detected. Can we simplify the logic to bring more clarity?");
        }
        if (todos > 0) {
            joyScore -= todos * 2;
            tips.push(`• ${todos} lingering TODOs. Each one is a small weight on our minds.`);
        }
        if (anys > 5) {
            joyScore -= 10;
            tips.push("• Frequent use of 'any' masks the true nature of our data.");
        }
        if (consoleLogs > 0) {
            joyScore -= 5;
            tips.push("• Console logs are whispers from development. They can be removed now.");
        }

        if (zoningHealth.isBackflowPresent) {
            joyScore -= 20;
            tips.push(`• ⚠️ **Zoning Violation**: This file imports from a higher conceptual zone. Respect the Downward Flow Law.`);
        }

        joyScore = Math.max(0, Math.min(100, joyScore));

        let joyStatus = "Developing";
        if (joyScore === 100) joyStatus = getCelebrationMessage();
        else joyStatus = getGratitudeMessage();

        if (tips.length === 0 && joyScore === 100) {
            tips.push("• Perfection. This file sparks pure joy!");
        } else if (tips.length === 0) {
            tips.push("• Looks good, just minor energetic tweaks needed.");
        }

        return {
            path,
            lines: totalLines,
            todos,
            anys,
            maxDepth,
            joyScore,
            clutter: {
                consoleLogs,
                commentedBlocks: blockComments
            },
            joyStatus,
            tips,
            zoningHealth
        };

    } catch (error) {
        console.error("Error checking code health:", error);
        throw error;
    }
}
