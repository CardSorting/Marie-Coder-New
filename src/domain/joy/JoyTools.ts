import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { ConfigService } from "../../infrastructure/config/ConfigService.js";
import { checkCodeHealth, HealthReport } from "../../plumbing/analysis/CodeHealthService.js";

export async function logGratitude(message: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const gratitudePath = path.join(workspaceFolders[0].uri.fsPath, "GRATITUDE.md");
    const date = new Date().toISOString().split('T')[0];
    const entry = `- **${date}**: ${message}\n`;

    try {
        await fs.appendFile(gratitudePath, entry, "utf-8");
    } catch (e) {
        // If file doesn't exist, create it with header
        const header = "# Gratitude Journal\n\nA record of things that have served their purpose and passed on.\n\n";
        await fs.writeFile(gratitudePath, header + entry, "utf-8");
    }
}

export async function generateJoyDashboard(rootPath: string, signal?: AbortSignal): Promise<string> {
    const files = await getAllFiles(rootPath, signal);
    let totalScore = 0;
    let scoredFiles = 0;
    const hallOfFame: string[] = [];
    const needsCare: string[] = [];

    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;

        if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
            try {
                const health = await checkCodeHealth(file);

                totalScore += health.joyScore;
                scoredFiles++;

                if (health.joyScore === 100) {
                    hallOfFame.push(`- 🏆 **${path.basename(file)}**`);
                } else if (health.joyScore < 50) {
                    needsCare.push(`- ❤️‍🩹 **${path.basename(file)}** (Score: ${health.joyScore})`);
                }
            } catch { /* Skip files that can't be analyzed */ }
        }
    }

    const avgScore = scoredFiles > 0 ? Math.round(totalScore / scoredFiles) : 0;

    // Read Logic for Journals
    const getRecentLines = async (filename: string, count: number): Promise<string[]> => {
        try {
            const content = await fs.readFile(path.join(rootPath, filename), 'utf-8');
            const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
            return lines.slice(-count);
        } catch {
            return ["*No entries yet.*"];
        }
    };

    const recentGratitude = await getRecentLines("GRATITUDE.md", 3);
    const recentReflections = await getRecentLines("JOURNAL.md", 3);

    let output = `# Joy Dashboard 🌟\n\n`;
    output += `**Workspace Joy Score**: ${avgScore}/100\n\n`;

    if (avgScore >= 90) output += `*Your workspace is radiating joy!* ✨\n\n`;
    else if (avgScore >= 70) output += `*A tidy and functional space. Keep going!* 🌿\n\n`;
    else output += `*Your workspace needs some love and attention.* ❤️\n\n`;

    output += `## 🏆 Hall of Fame (Perfect Score)\n${hallOfFame.length > 0 ? hallOfFame.join('\n') : '*No perfect files yet. Keep polishing!*'}\n\n`;

    output += `## ❤️‍🩹 Needs Care (Score < 50)\n${needsCare.length > 0 ? needsCare.join('\n') : '*Everything is in decent shape!*'}\n\n`;

    output += `## 🙏 Recent Gratitude\n${recentGratitude.join('\n')}\n\n`;
    output += `## 📓 Recent Reflections\n${recentReflections.join('\n')}\n`;

    const dashboardPath = path.join(rootPath, "JOY.md");
    await fs.writeFile(dashboardPath, output, "utf-8");

    return `Joy Dashboard generated at ${dashboardPath}`;
}

export async function cherishFile(filePath: string): Promise<string> {
    const now = new Date();
    await fs.utimes(filePath, now, now);
    return `File '${path.basename(filePath)}' has been cherished. It is deemed active and sparks joy.`;
}

export async function foldCode(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        // The Art of Folding: Organize Imports then Format
        await vscode.commands.executeCommand('editor.action.organizeImports');
        await vscode.commands.executeCommand('editor.action.formatDocument');
        await doc.save();

        // Close the editor to keep the space tidy (optional, but nice)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        return `File '${path.basename(filePath)}' has been folded neatly.`;
    } catch (e: any) {
        return `Could not fold '${path.basename(filePath)}': ${e.message}`;
    }
}

export async function generateTidyChecklist(rootPath: string, signal?: AbortSignal): Promise<string> {
    const files = await getAllFiles(rootPath, signal);

    const clothes: string[] = []; // Source code
    const papers: string[] = []; // Docs
    const komono: string[] = []; // Config/Misc
    const sentimental: string[] = []; // Aged files (> 90 days)

    const now = new Date();
    const SENTIMENTAL_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

    let output = "# Tidying Checklist 🧹\n\n";

    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;

        // Check for Sentimental items (Age)
        try {
            const stats = await fs.stat(file);
            const age = now.getTime() - stats.mtime.getTime();
            if (age > SENTIMENTAL_AGE_MS) {
                sentimental.push(`- [ ] **${path.basename(file)}** (Last modified: ${stats.mtime.toISOString().split('T')[0]})`);
            }
        } catch { /* Ignore stat errors for individual files */ }

        if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) {
            // Check joy score for source code
            try {
                const health = await checkCodeHealth(file);

                if (health.joyScore < 80) {
                    clothes.push(`- [ ] **${path.basename(file)}** (Score: ${health.joyScore}): ${health.joyStatus}`);
                }
            } catch { /* Skip files that can't be analyzed */ }
        } else if (file.endsWith('.md') || file.endsWith('.txt')) {
            papers.push(`- [ ] ${path.basename(file)}`);
        } else if (file.endsWith('.json') || file.endsWith('.config')) {
            komono.push(`- [ ] ${path.basename(file)}`);
        }
    }

    if (clothes.length > 0) {
        output += "## 👕 Clothes (Source Code)\n*Focus on files with low Joy Scores.*\n";
        output += clothes.join('\n') + "\n\n";
    }

    if (papers.length > 0) {
        output += "## 📄 Papers (Documentation)\n*Ensure these are up to date.*\n";
        output += papers.join('\n') + "\n\n";
    }

    if (komono.length > 0) {
        output += "## 🧶 Komono (Config & Misc)\n*Is this configuration still essential?*\n";
        output += komono.join('\n') + "\n\n";
    }

    if (sentimental.length > 0) {
        output += "## 🧸 Sentimental (Legacy)\n*These items haven't been touched in over 90 days. Do they still serve a purpose?*\n";
        output += sentimental.join('\n') + "\n\n";
    }

    if (clothes.length === 0 && papers.length === 0 && komono.length === 0 && sentimental.length === 0) {
        output += "Your workspace is pristine! ✨";
    }

    const tidyPath = path.join(rootPath, "TIDYING.md");
    await fs.writeFile(tidyPath, output, "utf-8");

    return `Tidy checklist generated at ${tidyPath}`;
}

export async function ensureJoyZoningFolders(rootPath: string): Promise<void> {
    const zones = ['domain', 'infrastructure', 'plumbing'];
    const srcPath = path.join(rootPath, 'src');

    try {
        await fs.mkdir(srcPath, { recursive: true });
        for (const zone of zones) {
            const zonePath = path.join(srcPath, zone);
            await fs.mkdir(zonePath, { recursive: true });

            // Add a friendly README if missing
            const readmePath = path.join(zonePath, 'README.md');
            try {
                await fs.access(readmePath);
            } catch {
                const zoneCapitalized = zone.charAt(0).toUpperCase() + zone.slice(1);
                await fs.writeFile(readmePath, `# ${zoneCapitalized} Zone\n\nThis directory belongs to the ${zone.toUpperCase()} zone of the JOY concept.\n`, 'utf-8');
            }
        }
    } catch (e) {
        console.error("Failed to ensure JOY folders:", e);
    }
}

export function autoZonePath(fileName: string, intent: string): string {
    const lowerIntent = intent.toLowerCase();
    const lowerFileName = fileName.toLowerCase();

    // Heuristics for Joyful (Domain)
    if (lowerIntent.includes('logic') || lowerIntent.includes('business') || lowerIntent.includes('core') ||
        lowerIntent.includes('rule') || lowerIntent.includes('domain') || lowerFileName.includes('model')) {

        if (lowerFileName.includes('entity')) return 'src/domain/entities';
        if (lowerFileName.includes('value')) return 'src/domain/values';
        if (lowerFileName.includes('event')) return 'src/domain/events';
        return 'src/domain';
    }

    // Heuristics for Infrastructure
    if (lowerIntent.includes('service') || lowerIntent.includes('api') || lowerIntent.includes('database') ||
        lowerIntent.includes('adapter') || lowerIntent.includes('infrastructure') || lowerIntent.includes('client')) {

        if (lowerFileName.includes('gateway') || lowerFileName.includes('client')) return 'src/infrastructure/gateways';
        if (lowerFileName.includes('adapter')) return 'src/infrastructure/adapters';
        if (lowerFileName.includes('repository')) return 'src/infrastructure/repositories';
        return 'src/infrastructure';
    }

    // Heuristics for Plumbing
    if (lowerIntent.includes('util') || lowerIntent.includes('tool') || lowerIntent.includes('system') ||
        lowerIntent.includes('format') || lowerIntent.includes('parse') || lowerIntent.includes('plumbing')) {

        if (lowerFileName.includes('tool')) return 'src/plumbing/tools';
        if (lowerFileName.includes('util')) return 'src/plumbing/utils';
        return 'src/plumbing';
    }

    return 'src'; // Default fallback
}

export interface ReorgProposal {
    file: string;
    currentPath: string;
    suggestedPath: string;
    reason: string;
}

export async function proposeReorganization(rootPath: string, signal?: AbortSignal): Promise<ReorgProposal[]> {
    const files = await getAllFiles(rootPath, signal);
    const proposals: ReorgProposal[] = [];

    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;
        if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) continue;

        const relativePath = path.relative(rootPath, file);
        const content = await fs.readFile(file, 'utf-8');
        const suggestedZone = autoZonePath(path.basename(file), content);
        const suggestedPath = path.join(suggestedZone, path.basename(file));

        if (!relativePath.startsWith(suggestedZone)) {
            proposals.push({
                file: path.basename(file),
                currentPath: relativePath,
                suggestedPath: suggestedPath,
                reason: `Heuristics suggest this belongs in ${suggestedZone} based on purpose and content.`
            });
        }
    }

    return proposals;
}

export async function synthesizeZoneManuals(rootPath: string): Promise<string> {
    const zones = ['domain', 'infrastructure', 'plumbing'];
    let updatedCount = 0;

    for (const zone of zones) {
        const zonePath = path.join(rootPath, 'src', zone);
        try {
            const entries = await fs.readdir(zonePath, { withFileTypes: true });
            const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'));

            if (files.length === 0) continue;

            const fileList = files.map(f => `- \`${f.name}\``).join('\n');
            const summary = `This zone currently contains ${files.length} sprouts that define our ${zone.toUpperCase()} layer.`;

            const readmePath = path.join(zonePath, 'README.md');
            const content = `# ${zone.charAt(0).toUpperCase() + zone.slice(1)} Zone\n\n${summary}\n\n### Current Inhabitants:\n${fileList}\n\n*Last synthesized by Marie on ${new Date().toLocaleDateString()}*`;

            await fs.writeFile(readmePath, content, 'utf-8');
            updatedCount++;
        } catch (e) {
            console.error(`Failed to synthesize manual for ${zone}:`, e);
        }
    }

    return `Synthesized ${updatedCount} zone manuals. The knowledge is now fresh. ✨`;
}

export async function executeRestoration(rootPath: string, signal?: AbortSignal): Promise<string> {
    const proposals = await proposeReorganization(rootPath, signal);
    if (proposals.length === 0) return "No restoration needed. Project order is absolute. ✨";

    let movedCount = 0;
    for (const p of proposals) {
        try {
            const from = path.join(rootPath, p.currentPath);
            const to = path.join(rootPath, p.suggestedPath);
            await fs.mkdir(path.dirname(to), { recursive: true });
            await fs.rename(from, to);
            movedCount++;
        } catch (e) {
            console.error(`Restoration failed for ${p.file}:`, e);
        }
    }

    return `Restoration complete. Moved ${movedCount} files to their rightful homes. 🌸`;
}

export async function scaffoldZoneAbstractions(rootPath: string): Promise<string> {
    const zones = [
        { name: 'domain', file: 'DomainEntity.ts', content: `export abstract class DomainEntity {\n    constructor(public readonly id: string) {}\n    // The Domain is pure logic. No dependencies here. ✨\n}\n` },
        { name: 'infrastructure', file: 'BaseAdapter.ts', content: `export abstract class BaseAdapter {\n    // Infrastructure connects the Domain to the world. 🌍\n    protected abstract connect(): Promise<void>;\n}\n` },
        { name: 'plumbing', file: 'BaseTool.ts', content: `export abstract class BaseTool {\n    // Plumbing is mechanical. Low-level work. 🔧\n    protected format(input: string): string {\n        return input.trim();\n    }\n}\n` }
    ];

    let createdCount = 0;
    for (const zone of zones) {
        const zonePath = path.join(rootPath, 'src', zone.name);
        const filePath = path.join(zonePath, zone.file);

        try {
            await fs.mkdir(zonePath, { recursive: true });
            try {
                await fs.access(filePath);
            } catch {
                await fs.writeFile(filePath, zone.content, 'utf-8');
                createdCount++;
            }
        } catch (e) {
            console.error(`Scaffolding failed for ${zone.name}:`, e);
        }
    }

    return createdCount > 0 ? `Scaffolded ${createdCount} zone abstractions. The patterns are set. 🏛️` : "Zones are already well-guarded.";
}

export function detectMigrationNeeds(filePath: string, content: string): { shouldMigrate: boolean, targetZone?: string, reason?: string } {
    const isPlumbing = filePath.includes('/plumbing/');
    const isInfrastructure = filePath.includes('/infrastructure/');
    const lowerContent = content.toLowerCase();

    // If a plumbing file starts talking about "Entity", "User", "Order", it's leaking domain.
    const domainKeywords = ['entity', 'user', 'order', 'product', 'logic', 'business'];
    const domainMatch = domainKeywords.find(word => lowerContent.includes(word));

    if (isPlumbing && domainMatch) {
        return {
            shouldMigrate: true,
            targetZone: 'src/domain',
            reason: `Found domain keyword '${domainMatch}' in plumbing. This file has evolved and deserves ascension.`
        };
    }

    if (isInfrastructure && (lowerContent.includes('sql') || lowerContent.includes('fetch'))) {
        // This is fine, infrastructure is for IO/Adapters.
    }

    return { shouldMigrate: false };
}
export interface ClusteringProposal {
    zone: string;
    fileCount: number;
    suggestedClusters: string[];
    reason: string;
}

export async function sowFeature(rootPath: string, featureName: string, intent: string): Promise<string> {
    const zones = [
        { name: 'domain', suffix: 'Entity.ts', comment: 'Core logic and business rules. Purity and intent reside here. ✨' },
        { name: 'infrastructure', suffix: 'Repository.ts', comment: 'Connecting the core to the world. Adapters and data reside here. 🌍' },
        { name: 'plumbing', suffix: 'Utils.ts', comment: 'The mechanical support. Technical utilities reside here. 🔧' }
    ];

    const kebabName = featureName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    const pascalName = featureName.charAt(0).toUpperCase() + featureName.slice(1);

    let createdCount = 0;
    for (const zone of zones) {
        const zonePath = path.join(rootPath, 'src', zone.name, kebabName);
        const fileName = `${pascalName}${zone.suffix}`;
        const filePath = path.join(zonePath, fileName);

        const content = `/**\n * ${pascalName} ${zone.name.charAt(0).toUpperCase() + zone.name.slice(1)}\n * Intent: ${intent}\n * \n * ${zone.comment}\n */\n\nexport class ${pascalName}${zone.suffix.replace('.ts', '')} {\n    // A new sprout in the ${zone.name} zone.\n}\n`;

        try {
            await fs.mkdir(zonePath, { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            createdCount++;
        } catch (e) {
            console.error(`Sowing failed for ${zone.name}:`, e);
        }
    }

    return `Successfully sowed '${featureName}' across ${createdCount} JOY zones. Your feature has taken root. 🌱`;
}

export async function proposeClustering(rootPath: string): Promise<ClusteringProposal[]> {
    const zones = ['domain', 'infrastructure', 'plumbing'];
    const proposals: ClusteringProposal[] = [];

    for (const zone of zones) {
        const zonePath = path.join(rootPath, 'src', zone);
        try {
            const entries = await fs.readdir(zonePath, { withFileTypes: true });
            const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'));

            if (files.length > 10) {
                // Heuristic: suggest clusters based on common prefixes/suffixes
                const names = files.map(f => f.name);
                const suffixes = ['Service', 'Repository', 'Entity', 'Tool', 'Util', 'Adapter'];
                const clusters = suffixes.filter(s => names.some(n => n.includes(s)));

                proposals.push({
                    zone,
                    fileCount: files.length,
                    suggestedClusters: clusters.length > 0 ? clusters : ['common', 'core', 'shared'],
                    reason: `The ${zone} zone is becoming a bit crowded with ${files.length} files. Clustering will restore clarity.`
                });
            }
        } catch { /* Zone directory may not exist yet */ }
    }

    return proposals;
}

export async function isProjectJoyful(rootPath: string): Promise<boolean> {
    try {
        const zones = ['src/domain', 'src/infrastructure', 'src/plumbing'];
        for (const zone of zones) {
            await fs.access(path.join(rootPath, zone));
        }
        return true;
    } catch {
        return false;
    }
}

export async function executeGenesisRitual(rootPath: string, signal?: AbortSignal): Promise<string> {
    const files = await getAllFiles(rootPath, signal);
    let totalMoved = 0;

    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;
        if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) continue;

        const relativePath = path.relative(rootPath, file);
        // Skip if already in JOY structure
        if (relativePath.startsWith('src/domain') ||
            relativePath.startsWith('src/infrastructure') ||
            relativePath.startsWith('src/plumbing')) continue;

        const content = await fs.readFile(file, 'utf-8');
        const suggestedZone = autoZonePath(path.basename(file), content);
        const targetPath = path.join(rootPath, suggestedZone, path.basename(file));

        try {
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.rename(file, targetPath);
            totalMoved++;
        } catch (e) {
            console.error(`Genesis move failed for ${file}:`, e);
        }
    }

    await ensureJoyZoningFolders(rootPath);
    await synthesizeZoneManuals(rootPath);

    return `Genesis Ritual complete. Converted ${totalMoved} files to the JOY ecosystem. Your project is reborn. ✨`;
}
async function getAllFiles(dir: string, signal?: AbortSignal): Promise<string[]> {
    const results: string[] = [];
    const excludedDirs = new Set(ConfigService.getExcludedFiles());
    const MAX_FILES = 5000;

    async function scan(directory: string) {
        if (signal?.aborted || results.length >= MAX_FILES) return;

        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (signal?.aborted || results.length >= MAX_FILES) return;

            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!excludedDirs.has(entry.name)) {
                    await scan(fullPath);
                }
            } else {
                results.push(fullPath);
            }
        }
    }

    try {
        await scan(dir);
    } catch (e) {
        console.error(`[JoyTools] Scan failed for ${dir}:`, e);
    }
    return results;
}
