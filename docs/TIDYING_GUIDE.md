# Tidying & Health Guide 🧹

This document details how MarieCoder perceives the "Cleanliness" and "Joy" of the workspace, using sophisticated heuristics inspired by the KonMari categories.

---

## 🧼 The Joy Score
Every file in the workspace is assigned a **Joy Score** (0-100) calculated by the `checkCodeHealth` utility.

| Score | Status | Action Required |
| :--- | :--- | :--- |
| **90-100** | **Radiant** ✨ | None. Included in the "Hall of Fame." |
| **70-89** | **Functional** 🌿 | Minor tidy-up (imports, formatting). |
| **50-69** | **Cluttered** 🧶 | Needs "Folding" (refactoring). |
| **< 50** | **Heavy** ❤️‍🩹 | Listed under "Needs Care." Potential for "Composting." |

---

## 🧹 The Tidying Checklist (`TIDYING.md`)
The `generateTidyChecklist` tool uses specific categories to help the user (and Marie) prioritize work:

1. **👕 Clothes (Source Code)**:
   - Evaluated by Joy Score. Files with scores < 80 are flagged for folding.
2. **📄 Papers (Documentation)**:
   - All `.md` and `.txt` files. Ensures knowledge stays fresh.
3. **🧶 Komono (Misc/Config)**:
   - JSON, Config, and Dotfiles. Checks if the configuration is still essential.
4. **🧸 Sentimental (Legacy Items)**:
   - **Intimate Detail**: Any file that hasn't been modified in over **90 days** is flagged as "Sentimental." These files are treated with extra care—do they still serve a purpose, or are we just holding on to them out of habit?

---

## 🌸 Restoration & Genesis
- **Genesis Ritual**: A bulk transformation tool that moves "homeless" files into the correct JOY zone based on intent heuristics.
- **Cherishing**: The `cherish_file` tool explicitly updates the access/modification time of a file, marking it as "Active" and preventing it from falling into the "Sentimental" category.
- **Folding**: The `fold_file` tool performs a "Mindful Formatting" (Organize Imports + Document Format), tidying the visual space without altering logic.

---

## 📊 The Joy Dashboard (`JOY.md`)
A synthesis of the entire garden's health, including the average workspace joy score, recent gratitude entries, and the Hall of Fame.

---
*Verified and Documented with Love. ✨*
