import { MarieCouncil, CouncilStrategy } from "./MarieCouncil.js";
import { AgentCoordination, AgentContext } from "./AgentCoordination.js";

/**
 * Task Type definitions for agent specialization
 */
export type TaskType =
    | 'CODE_REFACTORING'
    | 'FEATURE_IMPLEMENTATION'
    | 'BUG_FIXING'
    | 'ARCHITECTURE_DESIGN'
    | 'TESTING'
    | 'DOCUMENTATION'
    | 'DEPENDENCY_MANAGEMENT'
    | 'PERFORMANCE_OPTIMIZATION'
    | 'SECURITY_AUDIT'
    | 'UNKNOWN';

/**
 * Agent Specialization Profile
 */
export interface SpecializationProfile {
    agent: string;
    taskTypes: TaskType[];
    expertiseScore: number; // 0-1
    successRateByTask: Partial<Record<TaskType, number>>;
    avgSpeedByTask: Partial<Record<TaskType, number>>;
    lastSpecializationUpdate: number;
}

/**
 * Task Analysis Result
 */
export interface TaskAnalysis {
    taskType: TaskType;
    confidence: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    estimatedDuration: number;
    requiredExpertise: string[];
}

/**
 * AgentSpecialization provides dynamic agent specialization based on task type.
 * 
 * Features:
 * - Automatic task type detection from context
 * - Agent-task matching based on historical performance
 * - Dynamic priority adjustment based on specialization
 * - Expertise learning and tracking
 */
export class AgentSpecialization {
    private profiles: Map<string, SpecializationProfile> = new Map();
    private taskHistory: Array<{ taskType: TaskType; agent: string; success: boolean; duration: number }> = [];
    private readonly MAX_HISTORY = 100;

    // Keywords for task type detection
    private taskKeywords: Record<TaskType, string[]> = {
        CODE_REFACTORING: ['refactor', 'restructure', 'simplify', 'clean up', 'modernize', 'extract'],
        FEATURE_IMPLEMENTATION: ['implement', 'add feature', 'new functionality', 'create', 'build'],
        BUG_FIXING: ['fix', 'bug', 'error', 'crash', 'issue', 'resolve', 'repair'],
        ARCHITECTURE_DESIGN: ['architecture', 'design pattern', 'structure', 'organize', 'module'],
        TESTING: ['test', 'spec', 'verify', 'assert', 'mock', 'coverage'],
        DOCUMENTATION: ['document', 'comment', 'readme', 'docstring', 'explain'],
        DEPENDENCY_MANAGEMENT: ['dependency', 'import', 'package', 'npm', 'install', 'upgrade'],
        PERFORMANCE_OPTIMIZATION: ['performance', 'optimize', 'speed', 'cache', 'memory', 'efficient'],
        SECURITY_AUDIT: ['security', 'vulnerability', 'sanitize', 'validate', 'auth', 'encrypt'],
        UNKNOWN: []
    };

    constructor(private council: MarieCouncil) {
        this.loadProfiles();
    }

    /**
     * Analyze a task to determine its type
     */
    public analyzeTask(context: string): TaskAnalysis {
        const lowerContext = context.toLowerCase();
        const scores: Record<TaskType, number> = {} as Record<TaskType, number>;

        // Score each task type based on keyword matches
        for (const [taskType, keywords] of Object.entries(this.taskKeywords)) {
            if (taskType === 'UNKNOWN') continue;

            let score = 0;
            for (const keyword of keywords) {
                const regex = new RegExp(keyword, 'gi');
                const matches = lowerContext.match(regex);
                if (matches) {
                    score += matches.length;
                }
            }
            scores[taskType as TaskType] = score;
        }

        // Find best matching task type
        let bestTaskType: TaskType = 'UNKNOWN';
        let bestScore = 0;

        for (const [taskType, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestTaskType = taskType as TaskType;
            }
        }

        // Calculate complexity based on context indicators
        const complexity = this.estimateComplexity(lowerContext);
        const estimatedDuration = this.estimateDuration(bestTaskType, complexity);

        return {
            taskType: bestTaskType,
            confidence: Math.min(1, bestScore / 3), // Normalize confidence
            complexity,
            estimatedDuration,
            requiredExpertise: this.getRequiredExpertise(bestTaskType)
        };
    }

    /**
     * Get the best agent for a specific task type
     */
    public getBestAgentForTask(taskType: TaskType, excludeAgents: string[] = []): string | null {
        const candidates = Array.from(this.profiles.entries())
            .filter(([agent]) => !excludeAgents.includes(agent))
            .map(([agent, profile]) => ({
                agent,
                score: this.calculateAgentTaskScore(profile, taskType)
            }))
            .sort((a, b) => b.score - a.score);

        return candidates.length > 0 ? candidates[0].agent : null;
    }

    /**
     * Apply specialization-based priorities to coordination
     */
    public applySpecialization(
        coordination: AgentCoordination,
        taskAnalysis: TaskAnalysis
    ): void {
        const { taskType, complexity } = taskAnalysis;

        this.profiles.forEach((profile, agent) => {
            const isSpecialized = profile.taskTypes.includes(taskType);
            const hasExpertise = profile.expertiseScore > 0.6;
            const taskSuccessRate = profile.successRateByTask[taskType] || 0.5;

            let specializationBonus = 1.0;

            if (isSpecialized && hasExpertise) {
                // Boost specialized agents significantly
                specializationBonus = 1.3 + (profile.expertiseScore * 0.2);
            } else if (taskSuccessRate > 0.7) {
                // Boost agents with good track record on this task type
                specializationBonus = 1.2;
            } else if (taskSuccessRate < 0.4) {
                // Reduce priority for agents that struggle with this task type
                specializationBonus = 0.8;
            }

            // Complexity adjustment
            if (complexity === 'HIGH' && !hasExpertise) {
                specializationBonus *= 0.9; // Reduce non-experts on complex tasks
            }

            // Update agent context with specialization
            coordination.registerAgentContext(agent, {
                priority: specializationBonus,
                recommendedStrategy: this.getStrategyForTaskType(taskType)
            });
        });

        // Record this specialization application
        this.council.blackboard.write('specialization:lastTaskAnalysis', {
            taskType,
            timestamp: Date.now(),
            appliedToAgents: Array.from(this.profiles.keys())
        });
    }

    /**
     * Record task completion for learning
     */
    public recordTaskCompletion(
        agent: string,
        taskType: TaskType,
        success: boolean,
        duration: number
    ): void {
        // Update history
        this.taskHistory.push({ taskType, agent, success, duration });
        if (this.taskHistory.length > this.MAX_HISTORY) {
            this.taskHistory.shift();
        }

        // Update profile
        const profile = this.getOrCreateProfile(agent);

        // Update success rate for this task type
        const currentRate = profile.successRateByTask[taskType] || 0.5;
        const newRate = (currentRate * 0.7) + (success ? 0.3 : 0); // EMA
        profile.successRateByTask[taskType] = newRate;

        // Update average duration
        const currentAvg = profile.avgSpeedByTask[taskType] || duration;
        profile.avgSpeedByTask[taskType] = (currentAvg * 0.7) + (duration * 0.3);

        // Update expertise score based on overall performance
        const allRates = Object.values(profile.successRateByTask);
        profile.expertiseScore = allRates.length > 0
            ? allRates.reduce((a, b) => a + b, 0) / allRates.length
            : 0.5;

        // Update task types if agent is performing well on a new type
        if (success && newRate > 0.7 && !profile.taskTypes.includes(taskType)) {
            profile.taskTypes.push(taskType);
        }

        profile.lastSpecializationUpdate = Date.now();
        this.profiles.set(agent, profile);

        // Persist profiles
        this.saveProfiles();
    }

    /**
     * Get specialization report for debugging
     */
    public getSpecializationReport(): {
        profiles: SpecializationProfile[];
        topPerformers: Record<TaskType, string[]>;
        recommendations: string[];
    } {
        const profiles = Array.from(this.profiles.values());

        // Find top performers for each task type
        const topPerformers: Record<TaskType, string[]> = {} as Record<TaskType, string[]>;

        for (const taskType of Object.keys(this.taskKeywords) as TaskType[]) {
            if (taskType === 'UNKNOWN') continue;

            const topAgents = profiles
                .filter(p => (p.successRateByTask[taskType] || 0) > 0.7)
                .sort((a, b) => (b.successRateByTask[taskType] || 0) - (a.successRateByTask[taskType] || 0))
                .slice(0, 3)
                .map(p => p.agent);

            topPerformers[taskType] = topAgents;
        }

        // Generate recommendations
        const recommendations: string[] = [];

        profiles.forEach(profile => {
            if (profile.expertiseScore > 0.8) {
                recommendations.push(`${profile.agent} is highly specialized in ${profile.taskTypes.join(', ')}`);
            }

            const weakAreas = Object.entries(profile.successRateByTask)
                .filter(([_, rate]) => rate < 0.4)
                .map(([task, _]) => task);

            if (weakAreas.length > 0) {
                recommendations.push(`${profile.agent} struggles with ${weakAreas.join(', ')} - consider avoiding`);
            }
        });

        return { profiles, topPerformers, recommendations };
    }

    /**
     * Initialize specialization profiles for known agents
     */
    public initializeDefaultProfiles(): void {
        const defaultProfiles: SpecializationProfile[] = [
            {
                agent: 'YOLO',
                taskTypes: ['FEATURE_IMPLEMENTATION', 'ARCHITECTURE_DESIGN'],
                expertiseScore: 0.9,
                successRateByTask: {
                    FEATURE_IMPLEMENTATION: 0.85,
                    ARCHITECTURE_DESIGN: 0.8
                },
                avgSpeedByTask: {},
                lastSpecializationUpdate: Date.now()
            },
            {
                agent: 'Strategist',
                taskTypes: ['ARCHITECTURE_DESIGN', 'CODE_REFACTORING'],
                expertiseScore: 0.85,
                successRateByTask: {
                    ARCHITECTURE_DESIGN: 0.8,
                    CODE_REFACTORING: 0.75
                },
                avgSpeedByTask: {},
                lastSpecializationUpdate: Date.now()
            },
            {
                agent: 'Auditor',
                taskTypes: ['BUG_FIXING', 'SECURITY_AUDIT', 'TESTING'],
                expertiseScore: 0.9,
                successRateByTask: {
                    BUG_FIXING: 0.85,
                    SECURITY_AUDIT: 0.8,
                    TESTING: 0.75
                },
                avgSpeedByTask: {},
                lastSpecializationUpdate: Date.now()
            },
            {
                agent: 'QASRE',
                taskTypes: ['TESTING', 'BUG_FIXING', 'SECURITY_AUDIT'],
                expertiseScore: 0.85,
                successRateByTask: {
                    TESTING: 0.8,
                    BUG_FIXING: 0.75,
                    SECURITY_AUDIT: 0.7
                },
                avgSpeedByTask: {},
                lastSpecializationUpdate: Date.now()
            },
            {
                agent: 'ISO9001',
                taskTypes: ['DOCUMENTATION', 'TESTING'],
                expertiseScore: 0.8,
                successRateByTask: {
                    DOCUMENTATION: 0.75,
                    TESTING: 0.7
                },
                avgSpeedByTask: {},
                lastSpecializationUpdate: Date.now()
            }
        ];

        for (const profile of defaultProfiles) {
            if (!this.profiles.has(profile.agent)) {
                this.profiles.set(profile.agent, profile);
            }
        }
    }

    private calculateAgentTaskScore(profile: SpecializationProfile, taskType: TaskType): number {
        let score = profile.expertiseScore * 0.3;

        if (profile.taskTypes.includes(taskType)) {
            score += 0.4;
        }

        score += (profile.successRateByTask[taskType] || 0.5) * 0.3;

        return score;
    }

    private estimateComplexity(context: string): 'LOW' | 'MEDIUM' | 'HIGH' {
        const complexityIndicators = {
            HIGH: ['complex', 'architect', 'redesign', 'major', 'breaking change', 'fundamental'],
            LOW: ['simple', 'minor', 'quick', 'trivial', 'update', 'rename']
        };

        for (const indicator of complexityIndicators.HIGH) {
            if (context.includes(indicator)) return 'HIGH';
        }

        for (const indicator of complexityIndicators.LOW) {
            if (context.includes(indicator)) return 'LOW';
        }

        return 'MEDIUM';
    }

    private estimateDuration(taskType: TaskType, complexity: 'LOW' | 'MEDIUM' | 'HIGH'): number {
        const baseDurations: Record<TaskType, number> = {
            CODE_REFACTORING: 300000, // 5 min
            FEATURE_IMPLEMENTATION: 600000, // 10 min
            BUG_FIXING: 180000, // 3 min
            ARCHITECTURE_DESIGN: 480000, // 8 min
            TESTING: 240000, // 4 min
            DOCUMENTATION: 120000, // 2 min
            DEPENDENCY_MANAGEMENT: 60000, // 1 min
            PERFORMANCE_OPTIMIZATION: 420000, // 7 min
            SECURITY_AUDIT: 360000, // 6 min
            UNKNOWN: 300000 // 5 min default
        };

        const base = baseDurations[taskType] || 300000;
        const multiplier = complexity === 'HIGH' ? 2 : complexity === 'LOW' ? 0.5 : 1;

        return base * multiplier;
    }

    private getRequiredExpertise(taskType: TaskType): string[] {
        const expertiseMap: Record<TaskType, string[]> = {
            CODE_REFACTORING: ['pattern recognition', 'code analysis'],
            FEATURE_IMPLEMENTATION: ['design patterns', 'API knowledge'],
            BUG_FIXING: ['debugging', 'root cause analysis'],
            ARCHITECTURE_DESIGN: ['system design', 'modularity'],
            TESTING: ['test frameworks', 'edge case identification'],
            DOCUMENTATION: ['technical writing', 'clarity'],
            DEPENDENCY_MANAGEMENT: ['package management', 'version control'],
            PERFORMANCE_OPTIMIZATION: ['profiling', 'algorithm optimization'],
            SECURITY_AUDIT: ['security patterns', 'vulnerability detection'],
            UNKNOWN: []
        };

        return expertiseMap[taskType] || [];
    }

    private getStrategyForTaskType(taskType: TaskType): CouncilStrategy {
        const strategyMap: Record<TaskType, CouncilStrategy> = {
            CODE_REFACTORING: 'EXECUTE',
            FEATURE_IMPLEMENTATION: 'EXECUTE',
            BUG_FIXING: 'DEBUG',
            ARCHITECTURE_DESIGN: 'RESEARCH',
            TESTING: 'DEBUG',
            DOCUMENTATION: 'EXECUTE',
            DEPENDENCY_MANAGEMENT: 'DEBUG',
            PERFORMANCE_OPTIMIZATION: 'DEBUG',
            SECURITY_AUDIT: 'DEBUG',
            UNKNOWN: 'RESEARCH'
        };

        return strategyMap[taskType] || 'RESEARCH';
    }

    private getOrCreateProfile(agent: string): SpecializationProfile {
        if (!this.profiles.has(agent)) {
            this.profiles.set(agent, {
                agent,
                taskTypes: [],
                expertiseScore: 0.5,
                successRateByTask: {} as Partial<Record<TaskType, number>>,
                avgSpeedByTask: {} as Partial<Record<TaskType, number>>,
                lastSpecializationUpdate: Date.now()
            });
        }
        return this.profiles.get(agent)!;
    }

    private loadProfiles(): void {
        const saved = this.council.blackboard.read('agent:specializationProfiles');
        if (saved && typeof saved === 'object') {
            for (const [agent, profile] of Object.entries(saved)) {
                this.profiles.set(agent, profile as SpecializationProfile);
            }
        } else {
            this.initializeDefaultProfiles();
        }
    }

    private saveProfiles(): void {
        const profilesObj = Object.fromEntries(this.profiles);
        this.council.blackboard.write('agent:specializationProfiles', profilesObj);
    }
}
