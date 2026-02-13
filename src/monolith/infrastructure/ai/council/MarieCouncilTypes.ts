export interface ToolExecution {
    name: string;
    durationMs: number;
    success: boolean;
    timestamp: number;
    filePath?: string;
}

/**
 * Represents the collective mental state of the Marie Swarm.
 * Allows agents (Engine, Strategist, Auditor) to vote on execution strategy.
 */
export type CouncilStrategy = 'EXECUTE' | 'RESEARCH' | 'DEBUG' | 'PANIC' | 'HYPE';
export type CouncilMood = 'AGGRESSIVE' | 'CAUTIOUS' | 'INQUISITIVE' | 'ZEN' | 'EUPHORIA' | 'DOUBT' | 'FRICTION' | 'STABLE' | 'FLUIDITY' | 'HESITATION';
export type ErrorCategory = 'SYNTAX' | 'NOT_FOUND' | 'PERMISSION' | 'LOGIC' | 'TIMEOUT' | 'UNKNOWN';

export interface CouncilVote {
    agent: 'Engine' | 'Strategist' | 'Auditor' | 'QASRE' | 'ISO9001' | 'YOLO';
    strategy: CouncilStrategy;
    reason: string;
    timestamp: number;
    confidence: number;
}

export interface YoloTelemetry {
    profile: 'demo_day' | 'balanced' | 'recovery';
    strategy: CouncilStrategy;
    confidence: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    dampened: boolean;
    dampenReason?: string;
    structuralUncertainty: boolean;
    requiredActions: string[];
    blockedBy: string[];
    stopCondition: 'landed' | 'structural_uncertainty';
    timestamp: number;
}

export interface HiveMemory {
    lastActiveFile?: string;
    errorHotspots: Record<string, number>;
    totalErrorCount: number; // O(1) tracking
    flowState: number; // 0-100 velocity score
    recentFiles: string[]; // Last N files read/viewed
    toolHistory: string[]; // Ordered tool call names for loop detection
    toolExecutions: ToolExecution[]; // Rich execution records with duration + success
    successStreak: number; // Current consecutive success count (combo from Council's perspective)
    shakyResponseDensity: number; // 0-1 score indicating how often the model fails constraints
    writtenFiles: string[];
    actionDiffs: Record<string, string>;
    wiringAlerts: string[];
    lastYoloDecision?: YoloTelemetry;
}

export interface BlackboardRoutine {
    name: string;
    data: Record<string, any>;
    updatedAt: number;
}

export interface Blackboard {
    notes: Record<string, any>;
    routines: Record<string, BlackboardRoutine>;
    write(key: string, value: any): void;
    read(key: string): any;
    clear(key: string): void;
    writeRoutine(name: string, data: Record<string, any>): void;
    getRoutine(name: string): BlackboardRoutine | undefined;
}
