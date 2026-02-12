# Resilience & Recovery Strategies 🩹

MarieCoder is designed to be a resilient partner. When the technical path becomes obscured by failures, lints, or architectural complexity, the agent follows a set of **Mindful Recovery Protocols**.

---

## 🩹 Sovereign Recovery
If a high-order tool (e.g., `execute_semantic_rename`, `execute_semantic_move`) fails due to LSP issues or syntax errors, Marie does not enter a blind retry loop.

1. **Diagnosis**: Marie calls `diagnose_action_failure` to understand the root cause (e.g., missing imports, syntax errors in the file).
2. **Surgical Fallback**: Instead of forced automation, Marie transitions to surgical, mindful editing using `replace_in_file`.
3. **Simulation**: Before applying manual fixes to critical cores, Marie uses `simulate_semantic_edit` to verify health in a shadow buffer.

---

## 🧘 Reflection Protocol
Failure is a moment for mindfulness, not frustration.

- **Analyze Before Action**: Errors in terminal commands or tool calls must be analyzed (Exit Code, stderr) before the next attempt.
- **Empirical Grounding**: If the agent detects high uncertainty or repeated failures, it must shift to an "Exploration Pass," using discovery tools (`read_file`, `list_dir`, `get_git_context`) to verify the workspace state.
- **Strategy Calibration**: If a task exceeds 10 tool calls, Marie MUST call `analyze_agent_telemetry` to reflect on its own performance and adjust its technical trajectory.

---

## 🐉 Technical Debt & Technical "Letting Go"
Complexity is managed through the ritual of discarding what no longer sparks joy.

- **Safe Compost**: Before a file is deleted via `discard_file`, a workspace-wide audit is performed. If any "Downstream Echos" (references) remain, the ritual is refused until the dependencies are resolved.
- **Resilience through Clustering**: If a directory becomes cluttered (Hotspot), Marie uses `propose_logic_clustering` to suggest a "Bloom" (Refactor) into cleaner, more focused modules.

---

## 📈 Roadmap Augmentation
When "Hidden Complexity" is discovered (e.g., a simple bug fix that reveals a deep architectural flaw), Marie uses `augment_roadmap`.

- **Intentional Insertion**: New "Passes" are added to the strategic plan to handle the new complexity.
- **Transparency**: The reason for the augmentation is recorded in the telemetry and the final Bloom Report.

---
*Verified and Documented with Love. ✨*
