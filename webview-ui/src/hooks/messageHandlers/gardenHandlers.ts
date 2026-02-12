import type { ProjectHealth } from '../../types';
import type { HandlerContext } from './types';

interface JoyScoreMessage {
    value: {
        score: number;
    };
}

interface ProjectHealthMessage {
    value: ProjectHealth | null;
}


interface RitualUpdateMessage {
    value: {
        lifecycleStage?: 'sprout' | 'bloom' | 'compost';
        ritualComplete?: boolean;
    };
}

/**
 * Handles joy score updates from the extension.
 */
export function handleOnJoyScore(
    message: JoyScoreMessage,
    ctx: HandlerContext
): void {
    const { setJoyScore } = ctx;

    if (!message.value) return;
    setJoyScore(message.value.score);
}

/**
 * Handles project health updates from the extension.
 */
export function handleOnProjectHealth(
    message: ProjectHealthMessage,
    ctx: HandlerContext
): void {
    const { setProjectHealth } = ctx;

    setProjectHealth(message.value);
}

/**
 * Handles ritual update events from the extension.
 * Updates lifecycle stage and ritual completion status.
 */
export function handleOnRitualUpdate(
    message: RitualUpdateMessage,
    ctx: HandlerContext
): void {
    const { setLifecycleStage, setRitualComplete } = ctx;
    const event = message.value;
    if (!event) return;

    if (event.lifecycleStage) {
        setLifecycleStage(event.lifecycleStage);
    }
    if (event.ritualComplete !== undefined) {
        setRitualComplete(event.ritualComplete);
    }
}
