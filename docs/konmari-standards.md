# MarieCoder Development Standards (KonMari)

> *Guidance, not gospel. Pause, reflect, and choose with intention. Continuous evolution over perfection.*

---

## 🎯 Core Philosophy

**Inspired by KonMari Method**: We approach code with mindfulness—honoring what served us, learning from it, and evolving with gratitude. Philosophy guides our thinking; clarity guides our code.

### Before Any Change - Three Questions:
1. **What purpose did this serve?** (Observe with curiosity)
2. **What has this taught us?** (Learn with gratitude)  
3. **What brings clarity now?** (Choose with intention)

---

## 📝 Naming Standards (Non-Negotiable)

### Files & Modules
- **MUST** use `snake_case` (e.g., `prompt_manager.ts`).
- **Classes**: `PascalCase`.
- **Functions/Methods**: `camelCase`.
- **Constants**: `UPPER_SNAKE_CASE`.

---

## 🌳 Living Project Lifecycle

Every modification must be categorized to maintain structural intent:

1. **Sprout 🌱 (New)**: Adding fresh logic or modules. 
   - *Example*: Creating `src/domain/joy/NewMetric.ts`.
   - *Requirement*: Use `sprout_new_module` for architectural boilerplate.
2. **Bloom 🌸 (Refactor)**: Improving, clarifying, or expanding existing code.
   - *Example*: Extracting logic from `MarieEngine.ts` into a new service.
   - *Requirement*: Use `perform_strategic_planning` for multi-pass execution.
3. **Compost 🍂 (Deletion)**: Safely removing technical debt or redundant logic.
   - *Example*: Deleting a deprecated utility.
   - *Requirement*: Use `discard_file` with the full safety audit.

---

## 🔧 implementation Examples

### Joyful Logic (Domain)
```typescript
// src/domain/joy/RitualService.ts
// ✅ PURE, NO INFRASTRUCTURE DEPENDENCIES
export class RitualService {
    public static performGratitude(action: string): string {
        return `I honor the act of ${action}. ✨`;
    }
}
```

### Infrastructure Adapter
```typescript
// src/infrastructure/ai/MarieEngine.ts
// ✅ ORCHESTRATES PLUMBING AND DOMAIN
import { RitualService } from "../../domain/joy/RitualService";
import { writeFile } from "../../plumbing/filesystem/FileService";

export class MarieEngine {
    async logAction(msg: string) {
        const ritual = RitualService.performGratitude(msg);
        await writeFile("logs/joy.txt", ritual);
    }
}
```

---

## 🙏 Mindset
**Before each session**, remember:
*"I honor the code before me. I learn from every pattern. 'Legacy' was once innovative. I refactor not as criticism, but evolution. I write for clarity. I release with gratitude. I document what we learned. Every commit cares for future developers."*
