import { CouncilState as StateManager } from './CouncilState';
import { CouncilMood } from './MarieCouncilTypes';

export class CouncilMoods {
    public currentMood: CouncilMood = 'AGGRESSIVE';

    constructor(private state: StateManager) { }

    public setMood(mood: CouncilMood) {
        // BALANCED SUPREMACY: YOLO's conviction can override mood changes
        const lastYolo = this.state.memory.lastYoloDecision;
        if (lastYolo && lastYolo.confidence >= 2.5) {
            // High YOLO conviction maintains AGGRESSIVE/ZEN mood despite errors
            if ((mood === 'CAUTIOUS' || mood === 'DOUBT' || mood === 'FRICTION') &&
                (lastYolo.strategy === 'EXECUTE' || lastYolo.strategy === 'HYPE')) {
                // Don't drop below INQUISITIVE when YOLO has high conviction
                if (this.currentMood === 'AGGRESSIVE' || this.currentMood === 'ZEN' || this.currentMood === 'EUPHORIA') {
                    return; // Maintain current high-energy mood
                }
            }
        }

        if (this.currentMood !== mood) {
            this.state.moodHistory.push(mood);
            if (this.state.moodHistory.length > 10) {
                this.state.moodHistory = this.state.moodHistory.slice(-10);
            }
            this.currentMood = mood;
            this.state.blackboard.write('moodHistory', [...this.state.moodHistory]);

            // Drift Analysis
            if (this.state.moodHistory.length >= 4) {
                const lh = this.state.moodHistory;
                const last4 = lh.slice(-4);
                if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
                    this.state.blackboard.write('moodDriftDetected', true);
                }
            }
        }
    }

    public getMoodColor(): string {
        // BALANCED SUPREMACY: When YOLO has high conviction, show founder color
        const lastYolo = this.state.memory.lastYoloDecision;
        if (lastYolo && lastYolo.confidence >= 2.5) {
            return '#FFD700'; // Gold for Founder's authority
        }

        switch (this.currentMood) {
            case 'AGGRESSIVE': return '#FF4500';
            case 'CAUTIOUS': return '#32CD32';
            case 'INQUISITIVE': return '#1E90FF';
            case 'ZEN': return '#00FFFF';
            case 'EUPHORIA': return '#FFD700';
            case 'DOUBT': return '#808080';
            case 'FRICTION': return '#8B0000';
            case 'STABLE': return '#98FB98';
            case 'FLUIDITY': return '#00FF7F';
            case 'HESITATION': return '#DAA520';
            default: return '#FFFFFF';
        }
    }

    /**
     * BALANCED SUPREMACY: Get the council's current mood with YOLO influence
     */
    public getEffectiveMood(): CouncilMood {
        const lastYolo = this.state.memory.lastYoloDecision;
        if (lastYolo && lastYolo.confidence >= 2.5) {
            if (lastYolo.strategy === 'HYPE') return 'EUPHORIA';
            if (lastYolo.strategy === 'EXECUTE') return 'AGGRESSIVE';
        }
        return this.currentMood;
    }
}
