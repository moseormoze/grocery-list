# Designer Feedback — Iteration 2 (Fixes Only)

Flows 1A & 1B (signup + invite) and 2 (dashboard) are **excellent**. Keep those.

**Flows 3, 4, 5 need clarity.** The issue: you showed only the *Add Item modal*, not the underlying **Shopping Mode** and **Edit Mode list views**.

## What to show

Create three side-by-side full-screen mockups:

### 1. Shopping Mode (default, full list view)
- Header: list name + type icon
- Progress: "X of Y items checked"
- Sections with items (each section has illustration above)
- Each item: **checkbox** ☐ + name + quantity
- Ticked items: ~~strikethrough~~ + faded
- Bottom: "סיימתי קניות" button (only if ≥1 ticked)
- Top-right: "עריכה" button

### 2. Edit Mode (same structure, different actions)
- Same list layout as Shopping Mode
- Each item: **trash icon** 🗑 + name + **drag handle** ≡
- Items are reorderable within section
- Top: "הוסף פריט +" button
- Bottom: "שמור" button
- No checkboxes in this view

### 3. Add Item Modal (overlay on Edit Mode)
- Input: "שם הפריט" (required)
- Input: "כמות" (optional)
- Button: "בחר קטגוריה" → opens section picker
- Button: "הוסיף" to add
- Show what section is selected (e.g., "קטגוריה: מוצרי חלב")

## The flow (user POV)

```
Shopping Mode → tap "עריכה" → Edit Mode
Edit Mode → tap "הוסף פריט" → modal opens
Modal → enter name/qty/section → tap "הוסיף" → back to Edit Mode
Edit Mode → tap "שמור" → back to Shopping Mode
```

## Key points

- **All three are full-screen views.** The modal is layered on top, not replacing the list.
- Designer mockups should show each state in full, then show the modal interaction.
- Keep everything else from Iteration 1 (colors, fonts, sections, illustrations, RTL, peach buttons).

---

Ready to iterate?
