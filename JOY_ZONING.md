# Joy Zoning Protocol 🌸 (v5)

Non-joyful code is not a moral failure.
It is often necessary infrastructure, transitional work, or support plumbing.

Joy Zoning exists to protect clarity, reduce cognitive load, and preserve creative space.
The goal is containment—not shame.

## The Core Principle

**All code has a home.**
Code without a home becomes clutter.

We do not delete necessary complexity.
We name it, place it, and limit its spread.

## The Prime Directive

**Joyful zones must be defended.**
**Non-joyful zones must be honest.**

This protocol optimizes for long-term human comprehension, not short-term velocity.

## Zones (with Intent)

### 1. Joyful Code ✨

*   **Purpose**: Expression and meaning
*   **Question**: Is this the reason the system exists?
*   **Location**: `src/domain/`, core application flows

**Characteristics**:
*   Expressive
*   Intentional
*   Readable

**Constraints**:
*   No adapters
*   No glue
*   No “just in case” logic
*   No environment awareness
*   No orchestration logic
*   **Protected Zone**: Complexity must justify its presence

*Joyful code is where humans think. Guard it fiercely.*

### 2. Infrastructure 🏗️

*   **Purpose**: Stability and coordination
*   **Question**: Does this absorb complexity so the system stays calm?
*   **Location**: `src/infrastructure/`

**Characteristics**:
*   Heavy
*   Necessary
*   Emotionally flat

**Examples**:
*   Config loaders
*   AI clients
*   Registries
*   State bridges
*   Dependency wiring

**Constraints**:
*   Must terminate complexity
*   Must not leak abstractions upward
*   Must be replaceable without touching domain logic
*   Should be boring to read

*Infrastructure exists so joyful code doesn’t have to care.*

### 3. Plumbing 🔧

*   **Purpose**: Mechanical execution
*   **Question**: Is this unavoidable work best treated as machinery?
*   **Location**: `src/plumbing/`

**Characteristics**:
*   Low-level
*   Mechanical
*   Replaceable

**Examples**:
*   Filesystem I/O
*   Git wrappers
*   Shell execution
*   Static analysis primitives

**Constraints**:
*   Explicit boundaries
*   Minimal surface area
*   No domain knowledge
*   No opinionated logic
*   No lifecycle awareness

*Plumbing is respected, but never romanticized.*

## Dependency Law (Hard Rule) 📐

Dependencies may only flow downward.

| From \ To | Joyful | Infrastructure | Plumbing |
| :--- | :---: | :---: | :---: |
| **Joyful** | ✅ | ✅ | ❌ |
| **Infrastructure** | ❌ | ✅ | ✅ |
| **Plumbing** | ❌ | ❌ | ✅ |

**Rule**: If you violate this table, zoning has failed.
This rule exists to prevent conceptual backflow.

## Project Formation Rule 🧱

There are no generic buckets.

❌ `utils.ts`
❌ `helpers/`

✅ `filesystem/`
✅ `analysis/`
✅ `formatting/`

Every file belongs to a **Project** that explains what responsibility it owns.
If you cannot name the project, the code is not ready to exist.

## Lifecycle & Movement

Code is allowed—and expected—to move.

1.  **Sprout → Joyful**: When intent becomes legible.
2.  **Joyful → Infrastructure**: When patterns stabilize and repetition appears.
3.  **Infrastructure → Plumbing**: When logic becomes mechanical or commoditized.
4.  **Any → Compost**: When obsolete. Trust version control.

*Movement is maturity, not failure.*

## Pressure Valves 🔋

Pressure valves allow temporary disorder without dishonesty.

**Allowed**:
*   Flat files
*   TODOs with intent
*   Unzoned drafts

**Rules**:
1.  Must be acknowledged.
2.  Must answer: “Where does this belong once it settles?”
3.  Are not permanent homes.

*Pressure valves prevent premature abstraction and false cleanliness.*

## Agent & Automation Contract 🤖

When AI agents or automated tools interact with this codebase:
*   Agents may observe and suggest, never enforce.
*   Agents may flag heaviness, never moralize.
*   Agents must prefer containment over refactor.
*   Agents must not invent zones, projects, or abstractions without human approval.
*   Agents must never optimize for “elegance” over placement.

*Agents assist judgment. They do not replace it.*

## Review & Maintenance Cadence (NEW) 📅

Joy Zoning is enforced continuously, lightly.

*   **During development**: Ask “Where does this belong?”
*   **During review**: Ask “Is this carrying the right amount of meaning?”
*   **Periodically**: Relocate, don’t redesign.

*There are no “zoning sprints.” Tidying is part of normal work.*

## Reviewer Heuristics (Fast Checks)

*   “Why does this live here?”
*   “What zone would this fall into if it grew 3×?”
*   “Is this protecting joyful code—or polluting it?”
*   “Is this doing thinking it shouldn’t be doing?”

*If the answer feels fuzzy, pause. Do not invent abstractions to escape discomfort.*

## Failure Conditions (Explicit) 🚨

Joy Zoning has failed if it:
1.  Becomes a gatekeeping tool.
2.  Encourages hiding work.
3.  Replaces judgment with ritual.
4.  Rewards cleverness over clarity.
5.  Lets agents override humans.

*When this happens, simplify the protocol, not the people.*

## Final Safeguard

This protocol exists to reduce suffering, not to increase purity.

Clarity is the goal.
Joy is the signal.
Humans are the authority.
