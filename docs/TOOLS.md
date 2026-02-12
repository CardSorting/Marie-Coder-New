# Marie's Toolset 🛠️

Marie's intelligence is expressed through a diverse registry of autonomous tools. These tools are categorized by their role in the project lifecycle and follow the **KonMari Philosophy**—preferring intentional, respectful, and surgical interventions over bulk changes.

---

## 📂 Filesystem & Discovery
Tools for exploring and modifying the physical Garden.

- **`read_file`**: Surgical reading of files. Supports line ranges to minimize context noise.
- **`write_file`**: [Destructive] Overwrites file content. Requires human approval.
- **`list_dir`**: Returns file metadata (size, types) for a directory.
- **`grep_search`**: Powerful regex search across the workspace to find semantic patterns.
- **`find_files`**: Locates files by glob pattern (e.g., `**/*.test.ts`).
- **`get_folder_structure`**: Generates a recursive tree-view of a directory's hierarchy.

---

## 🧠 Intelligence & LSP
Leveraging Language Server Protocol (LSP) for compiler-safe navigation.

- **`get_symbol_definition`**: Jumps to the implementation of a symbol.
- **`find_symbol_references`**: Maps all usages of a symbol across the workspace.
- **`list_workspace_symbols`**: Searches for classes, functions, and interfaces by name.
- **`extract_component_api`**: Generates a structured markdown summary of a file's public surface.
- **`trace_data_flow`**: Analyzes how a type or interface travels between architectural zones.

---

## 🎨 Refactoring & Evolution
Tools for helping the project "Bloom" or "Compost" safely.

- **`execute_semantic_rename`**: [High-Order] Workspace-wide, compiler-safe renaming.
- **`execute_semantic_move`**: [High-Order] Extracts a symbol to a new file and repairs all downstream imports.
- **`replace_in_file`**: Surgical string-based replacement for minor adjustments.
- **`simulate_semantic_edit`**: Creates a "Shadow Buffer" to catch lints/errors before they hit the disk.
- **`propose_logic_clustering`**: Identifies co-dependent files to suggest structural consolidation.

---

## 👮 Governance & Integrity
Protecting the "Downwards Flow Law" and project health.

- **`audit_architectural_integrity`**: Scans for "Zone Leaks" and conceptual backflow.
- **`check_ripple_health`**: Verifies if changes in a core file broke any downstream dependents.
- **`predict_refactor_ripple`**: Foresight tool that predicts which files will break *before* you edit.
- **`get_code_complexity`**: Measures cyclomatic complexity and "clutter level."
- **`generate_architectural_decision`**: Saves an ADR-ID markdown record to `.marie/decisions/`.

---

## ✨ Rituals & Telemetry
The heart of Marie's mindful approach.

- **`perform_strategic_planning`**: Mandatory ritual for complex tasks. Aligns the "Pass" roadmap.
- **`checkpoint_pass`**: Formal transition between execution phases. Requires a "KonMari Reflection."
- **`complete_task_ritual`**: Synthesis of the entire journey. Generates the "Bloom Report."
- **`analyze_agent_telemetry`**: Self-calibration tool for the agent to reflect on its own successes and failures.
- **`pin_context`**: Creates persistent strategic memory (Anchors) that survive across sessions.
- **`get_workspace_joy_map`**: Generates a high-level health heat-map of the entire project.

---
*Verified and Documented with Love. ✨*
