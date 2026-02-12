# The Living Project Protocol 🌿

> "The question of what you want to own is actually the question of how you want to live your life." — Marie Kondo

This codebase is not a static artifact; it is a **living entity**. It breathes, grows, and requires care. We do not just "maintain" it; we cultivate it.

## 🌟 Core Philosophy

1.  **Code is Alive**: Every line of code represents a thought, a decision, and an intention. We honor that energy.
2.  **Joy is the Metric**: Does this function spark joy? Is it clear? Is it necessary? If not, we thank it for its service and let it go.
3.  **Tidy as You Go**: We do not wait for "refactoring sprints." We tidy continuously. A clean home is a happy home.

## 🧹 The Tidy Protocol

We use specific tools and mindsets to maintain order:

*   **`marieStatus`**: The heartbeat of the application. It tells us if Marie is `idle`, `thinking`, or `responding`. We respect these states and do not interrupt the flow.
*   **`check_code_health`**: Our diagnostic tool. It identifies "clutter" (TODOs, `any` types, commented-out blocks) so we can address them mindfully.
*   **Intentional Naming**: We use `snake_case` for files (e.g., `message.tsx` -> `message_component.tsx` if strictly following, though we adapt to framework conventions like React Component naming `Message.tsx` while keeping logic files `snake_case`). *Note: We are currently evolving towards strict consistency.*

## 🌱 The Lifecycle of Code

We view our features in three stages:

### 1. Sprout (New Features) 🟢
*   **State**: Draft, Experimental, In-Progress.
*   **Mindset**: Curiosity and Nurturing.
*   **Action**: Write freely, but with the intent to refine. Use `TODO`s explicitly to mark areas for future polishing.

### 2. Bloom (Active Code) 🌸
*   **State**: Production, Stable, Polished.
*   **Mindset**: Appreciation and Maintenance.
*   **Action**: Ensure it has tests, documentation, and types. It should be a joy to read. 
*   **Ritual (Cherishing)**: Use `cherish_file` to explicitly mark a module as vital and active, updating its modification metadata to reflect its continued relevance.

### 3. Compost (Deprecated Code) 🍂
*   **State**: Legacy, Unused, Superseded.
*   **Mindset**: Gratitude and Release.
*   **Action**: We do not comment out large blocks of code "just in case." We trust version control.
*   **The Ritual**:
    1.  Acknowledge the value it provided.
    2.  Use `log_gratitude` to save a final reflection in `GRATITUDE.md`.
    3.  Delete it via `discard_file` after the dependency audit clears. 🗑️

---

## 🏛️ Project Rebirth (Genesis)
When the Garden grows beyond its current structure, the `execute_genesis_ritual` is invoked. It uses heuristics (Logic, API, Utils) to automatically transition "homeless" files into their rightful **Joy Zones**, restoring structural intent in one movement.

## 🤝 How to Spark Joy

*   **Before pushing**: Ask, "Is this code clear to the next person who sees it?"
*   **When reviewing**: Look for clarity, not just correctness. Suggest rename refactors if a variable name is vague.
*   **When debugging**: Approach with patience. The bug is just a knot waiting to be untangled.

---

*Reflect: Does your code feel heavy or light?*
