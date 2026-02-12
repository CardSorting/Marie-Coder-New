import { useState, useCallback, useMemo } from 'react';
import type { SetStateAction } from 'react';
import type { GardenState, JoyZone } from '../types';

/** Helper to resolve SetStateAction without `any` casting */
function resolveSetStateAction<T>(val: SetStateAction<T>, prev: T): T {
    return typeof val === 'function' ? (val as (prevState: T) => T)(prev) : val;
}

/** Initial garden state factory */
function createInitialGardenState(): GardenState {
    return {
        joyScore: 100,
        projectHealth: null,
        currentZone: null,
        achievements: [],
        lifecycleStage: undefined,
        ritualComplete: false,
        passHistory: [],
        gardenMetrics: { cherishedFiles: [], releasedDebtCount: 0 },
    };
}

/**
 * Hook for managing garden/joy-related state.
 * Includes joy score, project health, lifecycle, achievements, and garden metrics.
 */
export function useGardenState() {
    const [garden, setGarden] = useState<GardenState>(createInitialGardenState());

    // --- Garden state setters ---
    const setJoyScore = useCallback((val: SetStateAction<number>) => {
        setGarden(prev => ({ ...prev, joyScore: resolveSetStateAction(val, prev.joyScore) }));
    }, []);

    const setProjectHealth = useCallback((val: SetStateAction<GardenState['projectHealth']>) => {
        setGarden(prev => ({ ...prev, projectHealth: resolveSetStateAction(val, prev.projectHealth) }));
    }, []);

    const setCurrentZone = useCallback((val: SetStateAction<JoyZone>) => {
        setGarden(prev => ({ ...prev, currentZone: resolveSetStateAction(val, prev.currentZone) }));
    }, []);

    const setAchievements = useCallback((val: SetStateAction<string[]>) => {
        setGarden(prev => {
            const next = resolveSetStateAction(val, prev.achievements);
            return { ...prev, achievements: Array.isArray(next) ? next : [] };
        });
    }, []);

    const setLifecycleStage = useCallback((val: SetStateAction<'sprout' | 'bloom' | 'compost' | undefined>) => {
        setGarden(prev => ({ ...prev, lifecycleStage: resolveSetStateAction(val, prev.lifecycleStage) }));
    }, []);

    const setRitualComplete = useCallback((val: SetStateAction<boolean>) => {
        setGarden(prev => ({ ...prev, ritualComplete: resolveSetStateAction(val, prev.ritualComplete) }));
    }, []);

    const setPassHistory = useCallback((val: SetStateAction<Array<{ pass: number; summary: string; reflection: string }>>) => {
        setGarden(prev => {
            const next = resolveSetStateAction(val, prev.passHistory);
            return { ...prev, passHistory: Array.isArray(next) ? next : [] };
        });
    }, []);

    const setGardenMetrics = useCallback((val: SetStateAction<{ cherishedFiles: string[]; releasedDebtCount: number }>) => {
        setGarden(prev => {
            const next = resolveSetStateAction(val, prev.gardenMetrics);
            return {
                ...prev,
                gardenMetrics: {
                    cherishedFiles: Array.isArray(next?.cherishedFiles) ? next.cherishedFiles : [],
                    releasedDebtCount: next?.releasedDebtCount ?? 0
                }
            };
        });
    }, []);

    // --- Computed setters object for effects ---
    const setters = useMemo(() => ({
        setJoyScore,
        setProjectHealth,
        setCurrentZone,
        setAchievements,
        setLifecycleStage,
        setRitualComplete,
        setPassHistory,
        setGardenMetrics,
    }), [
        setJoyScore,
        setProjectHealth,
        setCurrentZone,
        setAchievements,
        setLifecycleStage,
        setRitualComplete,
        setPassHistory,
        setGardenMetrics,
    ]);

    // --- State output for components ---
    const state = useMemo(() => garden, [garden]);

    return {
        state,
        setters,
    };
}

export type GardenStateAPI = ReturnType<typeof useGardenState>;
