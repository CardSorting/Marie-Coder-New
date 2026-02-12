import { MarieCouncil } from "../council/MarieCouncil.js";

/**
 * ATMOSPHERIC SEPARATION: MarieDirectiveService
 * Handles construction of Council Directives, intuition injection, and error history summaries.
 */
export class MarieDirectiveService {
    constructor(private council: MarieCouncil) { }

    public buildCouncilDirective(snapshot: any): string | null {
        const hotFiles = Object.entries(snapshot.errorHotspots).filter(([_, count]) => (count as number) >= 3);

        // BALANCED SUPREMACY: Skip directive only when Founder has high conviction and no hotspots
        const yoloDecision = snapshot.lastYoloDecision;
        const yoloHighConfidence = yoloDecision && yoloDecision.confidence >= 2.5;
        if (snapshot.strategy === 'EXECUTE' && snapshot.flowState > 60 && hotFiles.length === 0 && yoloHighConfidence) {
            return null; // Trust the Founder's high conviction
        }

        const parts: string[] = [`📊 Strategy: ${snapshot.strategy}, Mood: ${snapshot.mood}, Flow: ${snapshot.flowState}`];

        if (hotFiles.length > 0) {
            parts.push(`⚠️ Hotspots: ${hotFiles.map(([f]) => f.split('/').pop()).join(', ')}`);
        }

        const yoloWeight = snapshot.agentWeights?.YOLO;
        if (typeof yoloWeight === 'number') {
            parts.push(`⚡ Founder Signal Weight: ${yoloWeight.toFixed(2)}`);
        }

        // BALANCED SUPREMACY: Ceremonial recognition of Founder's authority
        if (yoloDecision) {
            const authorityMarker = yoloDecision.confidence >= 2.5 ? 'Founder Decrees' :
                yoloDecision.confidence >= 2.0 ? 'Founder Leads' : 'Founder Advises';
            parts.push(`⚡ ${authorityMarker}: ${yoloDecision.strategy} @ ${yoloDecision.confidence.toFixed(2)} (${yoloDecision.profile})`);

            if (yoloDecision.dampened && yoloDecision.dampenReason) {
                parts.push(`🛡️ Founder Consideration: ${yoloDecision.dampenReason}`);
            }

            // Add mandate indicator for high conviction
            if (yoloDecision.confidence >= 2.5) {
                parts.push(`👑 Founder's Mandate: The Council follows.`);
            }
        }

        // Phase 10: Intuition Injection
        const activeFile = snapshot.recentFiles[snapshot.recentFiles.length - 1];
        if (activeFile) {
            const intuition = this.council.getIntuition(activeFile);
            if (intuition.length > 0) {
                parts.push(`🧠 HIVE INTUITION for ${activeFile.split('/').pop()}: ${intuition.join('; ')}`);
            }
        }

        const toolExecutions = Array.isArray(snapshot.toolExecutions) ? snapshot.toolExecutions : [];
        const staleFiles = snapshot.recentFiles.filter((f: string) =>
            !toolExecutions.slice(-15).some((e: any) => e.filePath === f)
        );
        if (staleFiles.length > 4) {
            parts.push(`💡 CONTEXT ADVISORY: ${staleFiles.length} files are stale. Consider cleanup.`);
        }

        // Phase 12: Active Self-Healing (Ghost Critic Injection)
        const activeCritique = this.council.blackboard.read('activeCritique');
        if (activeCritique) {
            // BALANCED SUPREMACY: Only show critique as critical if YOLO confidence is not high
            const critiqueSeverity = yoloHighConfidence ? 'Council Advisory' : 'Critical';
            parts.push(`\n🚨 ${critiqueSeverity} FEEDBACK: "${activeCritique}"`);
            if (!yoloHighConfidence) {
                parts.push(`Immediate correction required.`);
            }
            this.council.blackboard.clear('activeCritique'); // Consume the critique
        }

        return '[COUNCIL DIRECTIVE]\n' + parts.join('\n');
    }

    public getErrorMemorySummary(snapshot?: any): string {
        const hotspots = (snapshot || this.council.getSnapshot()).errorHotspots;
        return Object.entries(hotspots)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 2)
            .map(([f, c]) => `${f.split('/').pop()}(${c}x)`)
            .join('; ');
    }
}
