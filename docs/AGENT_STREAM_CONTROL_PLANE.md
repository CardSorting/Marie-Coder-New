# Agent Stream Control Plane (Scaffolding)

This document describes the newly added **control-plane/data-plane scaffolding** for moving from shared swarm streams to **on-demand isolated agent streams**.

## Why this was added

The current swarm architecture has strong agent specialization, but turn execution and stream lifecycle are still mostly centralized. This scaffolding introduces the primitives needed to safely evolve into per-agent token streams with deterministic merge behavior.

## New components

### 1) Contracts
- `src/infrastructure/ai/core/AgentStreamContracts.ts`
- Defines:
  - `AgentIntentClass`
  - `AgentIntentRequest`
  - `SpawnPlan`
  - `AgentEnvelope`
  - `AgentTurnContext`

### 2) Policy Engine
- `src/infrastructure/ai/core/AgentStreamPolicyEngine.ts`
- Computes spawn score and admission decisions using configurable thresholds.

### 3) Intent Scheduler
- `src/infrastructure/ai/core/AgentIntentScheduler.ts`
- Produces deterministic spawn plans from turn context + intent requests.

### 4) Stream Manager
- `src/infrastructure/ai/core/AgentStreamManager.ts`
- Tracks active isolated stream handles, timeouts, cancellation, and lifecycle state.

### 5) Merge Arbiter
- `src/infrastructure/ai/core/AgentMergeArbiter.ts`
- Single-writer staging + deterministic acceptance/rejection ordering for agent envelopes.

## Event model additions

`src/domain/marie/MarieTypes.ts` now includes:
- `StreamIdentity`
- `agent_stream_lifecycle` event
- `agent_envelope` event

These are backward-compatible additions for future multi-stream event routing.

## Config flags added

In `ConfigService`:
- `isAgentStreamsEnabled()`
- `getAgentStreamMaxConcurrent()`
- `getAgentStreamSpawnThreshold()`
- `getAgentStreamTimeoutMs()`

Defaults are conservative and safe.

## Engine integration (non-invasive)

`MarieEngine` now initializes and runs a **preview-only control-plane pass** each turn:
- Builds intent requests (currently QASRE + ISO9001 examples)
- Runs scheduler + policy
- Stages preview envelopes through arbiter
- Emits a reasoning telemetry line with accepted/rejected counts

Important: this integration does **not** alter existing swarm behavior or tool execution flow.

## Rollout guidance

1. Keep `agentStreamsEnabled=false` (shadow mode behavior).
2. Validate telemetry quality and policy scores.
3. Replace preview envelope generation with real per-agent stream execution for one pilot agent.
4. Gate merges via arbiter commit policy.
5. Expand to additional agents gradually.
