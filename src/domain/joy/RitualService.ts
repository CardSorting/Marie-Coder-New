import * as path from "path";

export type JoyZone = 'joyful' | 'infrastructure' | 'plumbing';

export interface DependencyViolation {
    file: string;
    target: string;
    message: string;
}

export class RitualService {
    /** Zone ranking hierarchy — hoisted to avoid per-call allocation */
    private static readonly ZONE_RANKINGS: Record<JoyZone, number> = {
        'joyful': 3,
        'infrastructure': 2,
        'plumbing': 1
    };

    /**
     * Dependency Law: Joyful -> Infrastructure -> Plumbing.
     * Never point upward.
     */
    public static validateDependencies(sourceZone: JoyZone, targetFiles: string[]): DependencyViolation[] {
        const violations: DependencyViolation[] = [];

        for (const target of targetFiles) {
            const targetZone = this.getZoneFromPath(target);

            if (this.isUpward(sourceZone, targetZone)) {
                violations.push({
                    file: target,
                    target: targetZone,
                    message: `Conceptual Backflow: '${sourceZone}' code cannot depend on '${targetZone}' structure.`
                });
            }
        }

        return violations;
    }

    public static getZoneFromPath(filePath: string): JoyZone {
        const normalized = filePath.replace(/\\/g, '/');
        if (normalized.includes('/domain/') || normalized.includes('/joy/')) return 'joyful';
        if (normalized.includes('/infrastructure/') || normalized.includes('/services/')) return 'infrastructure';
        if (normalized.includes('/plumbing/') || normalized.includes('/utils/')) return 'plumbing';

        // Default based on common patterns if not explicit
        return 'joyful';
    }

    private static isUpward(source: JoyZone, target: JoyZone): boolean {
        // Upward if target has a higher (more joyful) ranking than source
        return this.ZONE_RANKINGS[target] > this.ZONE_RANKINGS[source];
    }

    public static getRitualGratefulnessPrompt(projectName: string, stage: string): string {
        const messages = [
            `What part of '${projectName}' brings you the most clarity today?`,
            `As we ${stage} this code, what are we thanking it for?`,
            `How does this change protect the joyful core of our garden?`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
}
