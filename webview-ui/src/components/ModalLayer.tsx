import React from 'react';
import { vscode } from '../utils/vscode';
import { LettingGoModal } from './LettingGoModal';
import { ConfirmationModal } from './ConfirmationModal';
import { SettingsModal } from './SettingsModal';
import { SproutRitual } from './SproutRitual';
import { ProjectVitality } from './ProjectVitality';
import type { Settings, ProjectHealth } from '../types';

interface UIState {
    sproutingFile: { fileName: string; suggestedPath?: string } | null;
    setSproutingFile: (file: { fileName: string; suggestedPath?: string } | null) => void;
    isVitalityOpen: boolean;
    setIsVitalityOpen: (open: boolean) => void;
    setLettingGoFile: (file: null) => void;
    isClearModalOpen: boolean;
    setIsClearModalOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
    triggerSparkles: () => void;
}

interface AppState {
    sproutingFile: { fileName: string; suggestedPath?: string } | null;
    projectHealth: ProjectHealth | null;
    lettingGoFile: { fullPath: string; fileName?: string; lines?: number } | null;
    settings: Settings;
    availableModels: { id: string; name: string }[];
    isLoadingModels: boolean;
}

interface Actions {
    handleLettingGoConfirm: () => void;
    confirmClearSession: () => void;
    handleSaveSettings: (settings: Settings) => void;
    fetchModels: (provider: 'anthropic' | 'openrouter' | 'cerebras') => void;
}

interface ModalLayerProps {
    ui: UIState;
    state: AppState;
    actions: Actions;
}

export const ModalLayer: React.FC<ModalLayerProps> = ({ ui, state, actions }) => {
    // We need to access vscode API, ensure it's available or mocked if needed, 
    // but in webview context it should be global.
    // For safety, we'll assume it's available as used in App.tsx

    return (
        <>
            {/* Sprout Ritual Modal */}
            {state.sproutingFile && (
                <SproutRitual
                    fileName={state.sproutingFile.fileName}
                    suggestedPath={state.sproutingFile.suggestedPath}
                    onConfirm={(intent, finalPath) => {
                        if (state.sproutingFile) {
                            vscode.postMessage({
                                type: 'plantIntent',
                                value: {
                                    fileName: state.sproutingFile.fileName,
                                    intent,
                                    finalPath: finalPath || state.sproutingFile.suggestedPath || state.sproutingFile.fileName
                                }
                            });
                        }
                        ui.setSproutingFile(null);
                        ui.triggerSparkles();
                    }}
                    onCancel={() => ui.setSproutingFile(null)}
                />
            )}

            {/* Project Vitality Dashboard */}
            {ui.isVitalityOpen && state.projectHealth && (
                <ProjectVitality
                    health={{
                        ...state.projectHealth,
                        clutterCount: state.projectHealth.clutterCount || 0,
                        joyfulFiles: state.projectHealth.joyfulFiles || 0,
                        plumbingFiles: state.projectHealth.plumbingFiles || 0,
                        clusteringAlerts: state.projectHealth.clusteringAlerts || []
                    }}
                    onRestore={() => vscode.postMessage({ type: 'onMessage', value: 'Please restore project order. Reason: Manual vitality restoration pulse.' })}
                    onSynthesize={() => vscode.postMessage({ type: 'onMessage', value: 'Please synthesize zone manuals.' })}
                    onClose={() => ui.setIsVitalityOpen(false)}
                />
            )}

            {/* Letting Go Ritual Modal */}
            {state.lettingGoFile && state.lettingGoFile.fileName && state.lettingGoFile.lines !== undefined && (
                <LettingGoModal
                    fileName={state.lettingGoFile.fileName}
                    lines={state.lettingGoFile.lines}
                    onConfirm={actions.handleLettingGoConfirm}
                    onCancel={() => ui.setLettingGoFile(null)}
                />
            )}

            <ConfirmationModal
                isOpen={ui.isClearModalOpen}
                title="Clear Session History?"
                message="This will remove all messages from the current session. This action cannot be undone."
                onConfirm={actions.confirmClearSession}
                onCancel={() => ui.setIsClearModalOpen(false)}
            />

            <SettingsModal
                isOpen={ui.isSettingsOpen}
                initialSettings={state.settings}
                onSave={actions.handleSaveSettings}
                onCancel={() => ui.setIsSettingsOpen(false)}
                availableModels={state.availableModels}
                isLoadingModels={state.isLoadingModels}
                onFetchModels={actions.fetchModels}
            />
        </>
    );
};
