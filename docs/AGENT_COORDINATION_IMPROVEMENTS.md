# Agent Coordination & Council Improvements

## Overview

This document summarizes the comprehensive improvements made to the Marie-Coder agent coordination system and the integration between MarieYOLO and the Council.

## Architecture

```
MarieAgentSwarm
    ├── MarieYOLO (Founder)
    ├── MarieStrategist
    ├── MarieAuditor
    ├── MarieQASRE
    └── MarieISO9001
            │
            ▼
    MarieCouncil
            │
            ├── AdvancedYOLOIntegration (NEW)
            │       ├── processYOLODecision() - with momentum & alignment
            │       ├── shouldVetoWithContext() - context-aware veto
            │       ├── detectRollbackNeeded() - strategic rollback
            │       ├── recordVetoOutcome() - veto learning
            │       ├── getVetoAnalytics() - veto analytics
            │       └── getAdvancedAnalytics() - comprehensive metrics
            │
            ├── EnhancedAgentCoordination (NEW)
            │       ├── predictConflicts() - predictive conflict detection
            │       ├── detectResourceContention() - resource contention
            │       ├── getAgentAffinity() - agent compatibility scoring
            │       ├── recordCollaborationOutcome() - collaboration learning
            │       ├── getCollaborationRecommendations() - agent pairing
            │       ├── calculateSmartTimeout() - adaptive timeouts
            │       └── calculateEnhancedExecutionOrder() - optimized ordering
            │
            └── AgentSpecialization
                    ├── analyzeTask() - task type detection
                    ├── applySpecialization() - dynamic prioritization
                    ├── recordTaskCompletion() - cross-session learning
                    └── getSpecializationReport() - expertise reporting
```

## New Components

### 1. EnhancedAgentCoordination (`src/infrastructure/ai/council/EnhancedAgentCoordination.ts`)

A sophisticated agent coordination system that extends the base coordination with predictive capabilities and agent affinity scoring.

#### Key Features:

**Predictive Conflict Detection**
- Predicts conflicts before they occur based on historical patterns
- Uses agent affinity scores to anticipate problematic agent pairings
- Provides conflict probability and prevention recommendations

**Agent Affinity Scoring**
- Tracks which agents work well together
- Calculates compatibility scores (0-1) based on:
  - Successful collaboration count
  - Conflict frequency
  - Average collaboration time
- Maintains collaboration history for learning

**Resource Contention Detection**
- Tracks file/module access patterns
- Detects when multiple agents compete for the same resources
- Provides contention level (LOW/MEDIUM/HIGH) and resolution suggestions

**Smart Timeout Adjustment**
- Adjusts agent timeouts based on historical performance
- High-performing agents get shorter timeouts (faster execution)
- Struggling agents get longer timeouts (more patience)

**Collaboration Recommendations**
- Recommends optimal agent pairings for tasks
- Identifies agents to avoid pairing together
- Calculates optimal execution ordering based on affinities

**Enhanced Execution Order**
- Optimizes parallel groups based on agent compatibility
- Separates conflicting agents into different groups
- Groups compatible agents for better collaboration

**Coordination Health Metrics**
- Overall health score (0-1)
- Average affinity score
- Conflict rate
- Prediction accuracy
- Actionable recommendations

#### Usage:

```typescript
const coordination = council.getAgentCoordination() as EnhancedAgentCoordination;

// Predict conflicts before execution
const predictions = coordination.predictConflicts(['Strategist', 'Auditor', 'QASRE']);
// Returns: [{ agents: ['Auditor', 'QASRE'], probability: 0.8, ... }]

// Get agent affinity
const affinity = coordination.getAgentAffinity('Strategist', 'Auditor');
// Returns: { compatibilityScore: 0.85, successfulCollaborations: 12, ... }

// Calculate enhanced execution order
const result = coordination.calculateEnhancedExecutionOrder(['Strategist', 'Auditor', 'QASRE']);
// Returns: { executionOrder, parallelGroups, predictions, contentions, recommendations }

// Record resource access
 coordination.recordResourceAccess('Auditor', 'src/file.ts', 'read');

// Record collaboration outcome for learning
coordination.recordCollaborationOutcome(['Strategist', 'Auditor'], true, 1500);

// Get coordination health
const health = coordination.getCoordinationHealth();
// Returns: { overallHealth, avgAffinityScore, conflictRate, recommendations }
```

### 2. AdvancedYOLOIntegration (`src/infrastructure/ai/council/AdvancedYOLOIntegration.ts`)

Deep integration layer between MarieYOLO (the Founder) and the Council with advanced analytics and strategic alignment tracking.

#### Key Features:

**Conviction Momentum Tracking**
- Tracks YOLO's confidence trajectory over time
- Calculates momentum score (-1 to 1)
- Detects acceleration/deceleration trends
- Measures volatility (standard deviation)

**Strategic Alignment Scoring**
- Measures how well the council aligns with YOLO's vision
- Per-agent alignment tracking
- Consensus strength calculation (variance-based)
- Alignment trend detection (IMPROVING/DECLINING/STABLE)

**Veto Success Analytics**
- Tracks outcomes of YOLO vetoes
- Calculates veto success rate
- Identifies best veto contexts
- Provides veto recommendations

**Context-Aware Veto Decisions**
- Adjusts veto thresholds based on:
  - Recent success rate
  - Current entropy
  - Council alignment
- More cautious when success rate is low
- More aggressive when entropy is high

**Strategic Rollback Detection**
- Detects when strategy rollback is needed based on conviction momentum
- Rolls back from HYPE/EXECUTE when conviction decelerates
- Advances from RESEARCH when conviction accelerates

**Dynamic Mood Influence**
- Applies council mood based on YOLO's strategy and conviction
- Mood influence intensity adjusts based on:
  - Conviction level
  - Momentum direction
  - Veto success rate
- Higher intensity = stronger mood control

#### Usage:

```typescript
const yoloIntegration = council['yoloIntegration'] as AdvancedYOLOIntegration;

// Process YOLO decision with advanced analytics
const result = yoloIntegration.processYOLODecision(decision);
// Returns: { ...baseMetrics, momentum, alignment, moodImpact }

// Check for rollback needs
const rollback = yoloIntegration.detectRollbackNeeded('HYPE');
// Returns: { rollbackNeeded: true, reason: "...", suggestedStrategy: 'DEBUG' }

// Get veto analytics
const analytics = yoloIntegration.getVetoAnalytics();
// Returns: { totalVetoes, successRate, avgConvictionAtVeto, recommendation }

// Record veto outcome for learning
yoloIntegration.recordVetoOutcome('HYPE', 'DEBUG', true, 'critical_bug_fix');

// Get comprehensive analytics
const advancedAnalytics = yoloIntegration.getAdvancedAnalytics();
// Returns: { convictionMomentum, strategicAlignment, vetoAnalytics, recommendations }
```

### 3. AgentSpecialization (`src/infrastructure/ai/council/AgentSpecialization.ts`)

Dynamic agent specialization based on task type with cross-session learning.

#### Key Features:
- **Task Type Detection**: Automatically detects 9 task types from context
- **Agent-Task Matching**: Matches agents to tasks based on historical performance
- **Dynamic Priority Adjustment**: Boosts specialized agents, reduces poor performers
- **Cross-Session Learning**: Specialization profiles persist across sessions
- **Expertise Tracking**: Tracks expertise scores and success rates per task type

#### Task Types:
- `CODE_REFACTORING` - Restructuring and simplifying code
- `FEATURE_IMPLEMENTATION` - Adding new functionality
- `BUG_FIXING` - Fixing errors and crashes
- `ARCHITECTURE_DESIGN` - System design and organization
- `TESTING` - Writing and running tests
- `DOCUMENTATION` - Writing docs and comments
- `DEPENDENCY_MANAGEMENT` - Package and import management
- `PERFORMANCE_OPTIMIZATION` - Speed and efficiency improvements
- `SECURITY_AUDIT` - Security analysis and fixes

#### Usage:

```typescript
const specialization = council.getAgentSpecialization();

// Analyze task
const analysis = specialization.analyzeTask("Implement new authentication feature");
// Returns: { taskType: 'FEATURE_IMPLEMENTATION', confidence: 0.85, ... }

// Apply specialization to coordination
specialization.applySpecialization(coordination, analysis);

// Record completion for learning
council.recordTaskCompletion('YOLO', 'FEATURE_IMPLEMENTATION', true, 120000);

// Get specialization report
const report = council.getSpecializationReport();
// Returns: { profiles, topPerformers, recommendations }
```

## Integration Points

### MarieCouncil Integration

The `MarieCouncil` class now uses:
- `AdvancedYOLOIntegration` for YOLO-Council coordination
- `EnhancedAgentCoordination` for agent management (via YOLO integration)
- `AgentSpecialization` for task-based agent selection

Enhanced methods:
- `processYOLODecision(decision)` - Now returns advanced metrics with momentum and alignment
- `getSwarmGuidance()` - Enhanced with YOLO authority and agent activation
- `getAgentCoordination()` - Returns EnhancedAgentCoordination

### MarieAgentSwarm Integration

The `MarieAgentSwarm` class now uses:
- Enhanced agent coordination for intelligent execution ordering
- YOLO guidance for agent prioritization
- Performance tracking for adaptive coordination
- Conflict detection and resolution
- Task specialization for agent selection

**Enhanced Flow:**
1. YOLO evaluation runs first (Founder sets trajectory)
2. Get advanced analytics from YOLO-Council integration
3. Predict conflicts and resource contentions
4. Register agent contexts based on guidance
5. Calculate optimal execution order with enhanced coordination
6. Execute agents in parallel groups
7. Record performance and collaboration outcomes
8. Resolve consensus with YOLO authority

## Benefits

1. **Predictive Conflict Resolution**: Conflicts are detected before they occur, preventing issues
2. **Agent Affinity Learning**: System learns which agents work well together
3. **Resource Contention Management**: Better coordination of file/module access
4. **Adaptive Timeouts**: Agents get appropriate timeouts based on performance
5. **YOLO Conviction Tracking**: Understand YOLO's confidence trajectory
6. **Strategic Alignment**: Measure how well council aligns with Founder's vision
7. **Veto Learning**: Track veto outcomes to improve override decisions
8. **Mood Influence Propagation**: YOLO's conviction influences council mood dynamically
9. **Strategic Rollback**: Automatic rollback detection based on conviction momentum
10. **Cross-Session Persistence**: Agent performance and specialization persist across sessions

## Cross-Session Persistence

Agent performance, affinity scores, and specialization data are now persisted across sessions in `.marie/agent_performance.json`.

Persistence includes:
- Agent performance statistics
- Specialization profiles
- YOLO analytics
- Collaboration outcomes

## Testing

Run the comprehensive test suite:

```bash
npx ts-node tests/test_agent_coordination.ts
npx ts-node tests/test_marie_council.ts
```

## Future Enhancements

Potential future improvements:
1. Machine learning for agent weight optimization
2. Predictive conflict detection using historical patterns
3. Visual dashboard for agent coordination metrics
4. Real-time agent affinity visualization
5. YOLO conviction forecasting
6. Automatic strategy optimization based on outcomes
