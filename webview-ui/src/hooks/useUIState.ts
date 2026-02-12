import { useState, useCallback, useMemo, useEffect } from 'react';
import { vscode } from '../utils/vscode';
import type { SetStateAction } from 'react';
import type { UIState } from '../types';

/** Helper to resolve SetStateAction without `any` casting */
function resolveSetStateAction<T>(val: SetStateAction<T>, prev: T): T {
    return typeof val === 'function' ? (val as (prevState: T) => T)(prev) : val;
}

/** Initial UI state factory */
function createInitialUIState(): UIState {
    const saved = vscode.getState<{ ui?: UIState }>();
    return saved?.ui || {
        isClearModalOpen: false,
        isSettingsOpen: false,
        isSessionListOpen: false,
        isVitalityOpen: false,
        showSparkles: false,
        showProgressDetails: false,
    };
}

/**
 * Hook for managing UI-related state.
 * Includes modal visibility, sparkles effect, and progress detail toggle.
 */
export function useUIState() {
    const [ui, setUIState] = useState<UIState>(createInitialUIState());

    // --- Persistence ---
    useEffect(() => {
        const existing = vscode.getState<any>() || {};
        vscode.setState({ ...existing, ui });
    }, [ui]);

    // --- UI state setters ---
    const setIsClearModalOpen = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, isClearModalOpen: resolveSetStateAction(val, prev.isClearModalOpen) }));
    }, []);

    const setIsSettingsOpen = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, isSettingsOpen: resolveSetStateAction(val, prev.isSettingsOpen) }));
    }, []);

    const setIsSessionListOpen = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, isSessionListOpen: resolveSetStateAction(val, prev.isSessionListOpen) }));
    }, []);

    const setIsVitalityOpen = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, isVitalityOpen: resolveSetStateAction(val, prev.isVitalityOpen) }));
    }, []);

    const setShowSparkles = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, showSparkles: resolveSetStateAction(val, prev.showSparkles) }));
    }, []);

    const setShowProgressDetails = useCallback((val: SetStateAction<boolean>) => {
        setUIState(prev => ({ ...prev, showProgressDetails: resolveSetStateAction(val, prev.showProgressDetails) }));
    }, []);

    // --- Sparkles effect ---
    const triggerSparkles = useCallback(() => {
        setShowSparkles(true);
        setTimeout(() => setShowSparkles(false), 2000);
    }, [setShowSparkles]);

    // --- Computed setters object for effects ---
    const setters = useMemo(() => ({
        setIsClearModalOpen,
        setIsSettingsOpen,
        setIsSessionListOpen,
        setIsVitalityOpen,
        setShowSparkles,
        setShowProgressDetails,
    }), [
        setIsClearModalOpen,
        setIsSettingsOpen,
        setIsSessionListOpen,
        setIsVitalityOpen,
        setShowSparkles,
        setShowProgressDetails,
    ]);

    // --- Actions ---
    const actions = useMemo(() => ({
        triggerSparkles,
    }), [triggerSparkles]);

    // --- State output for components ---
    const state = useMemo(() => ui, [ui]);

    return {
        state,
        setters,
        actions,
    };
}

export type UIStateAPI = ReturnType<typeof useUIState>;
