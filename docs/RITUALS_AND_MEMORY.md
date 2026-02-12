# Rituals & Strategic Memory ⚓

This document dives into the "Intimate Machinery" of MarieCoder—the rituals that govern its behavior and the memory that grounds its technical decisions.

---

## 🙏 The Gratitude Ritual
The system maintains a **Gratitude Journal** (`GRATITUDE.md`) to honor the lifecycle of code. 

- **Purpose**: To document what a piece of code or a specific tool taught us before it is superseded or removed.
- **Mechanism**: The `logGratitude` tool appends a timestamped entry.
- **AI Behavior**: Before calling `discard_file`, Marie is instructed to "say thank you" by documenting the file's contribution.

---

## ⚓ Anchored Strategic Context (Memory)
MarieCoder uses a persistent, surgical memory system called **Anchored Context**, managed by the `ContextArchiveService`.

### How it Works
Unlike traditional "long-term memory" which can become noisy, anchors are **intentional**.
1. **Selection**: Marie identifies a critical snippet, a complex state machine, or a specific architectural decision.
2. **Anchoring**: The `pin_context` tool saves this to `.marie_memory.json`.
3. **Resurrection**: In every future session, these anchors are injected at the very top of the context, ensuring Marie doesn't "forget" critical project constraints between restarts.

### Anchor Types
- `snippet`: A specific block of implementation that is fragile or unique.
- `symbol`: A core class or interface definition.
- `file_ref`: A strategic pointer to a file that must be maintained.

---

## 🧘 Ritual Prompts & Philosophy
The `RitualService` provides the "voice" of the project's mindful approach.

### Gratefulness Selection
When performing a pass or closing a task, the system randomly selects a prompt to center the agent's focus:
> *"How does this change protect the joyful core of our garden?"*
> *"As we bloom this code, what are we thanking it for?"*

### Dependency Law Enforcement
The `RitualService` is also the arbiter of the **Downwards Flow Law**. It calculates the "Joy Ranking" (Joyful: 3, Infrastructure: 2, Plumbing: 1) and prevents **Conceptual Backflow** by throwing validation errors if a higher-level zone tries to point upward.

---
*Verified and Documented with Love. ✨*
