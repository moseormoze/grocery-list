# Designer Prompt — Iteration 2

The product brief has been locked. Please update the designs to reflect the following changes. **Do NOT start from scratch** — adjust what needs to change and keep what's good.

---

## Part 1: Locked Product Decisions

### Multiple Lists
- A household (two users) can have multiple lists.
- Each list has a **type**: supermarket, pharmacy, or house.
- Both users see the **same dashboard** showing all lists.
- Either user can pick any list and work with it.

### List Types & Sections
**Supermarket list sections:**
- מוצרי חלב, ירקות ופירות, בשר ודגים, יבש, אפייה ומאפייה, ניקיון, חטיפים, משקאות, קפואים, אחר

**Pharmacy list sections:**
- ניקיון הבית, מוצרי היגינה, תרופות, אחר

**House list sections:**
- למטבח, איחסון, רהיט, חשמל, אחר

### Partner Names
Each user enters their own name during signup. Show both names on the dashboard (so you see "Eilon & Dana" or similar at the top).

### Button Color
**Change from green to #F4B5A0** (soft peach/coral pastel).
If the color needs palette adjustments to integrate cleanly, make those adjustments — trust your judgment.

### Two Distinct Modes (Key Change)
The default state is **Shopping Mode**. Users must tap "עריכה" to enter **Edit Mode**.

---

## Part 2: Updated Sections & Flows

### Section 1A: Signup
**Current state: Good.** Add one change:
- Include a name input field during signup (not optional).
- User enters: email → receives magic link → taps link → enters **name** → signs in.
- Show this name on the dashboard after sign-in.

### Section 1B: Invite & Onboarding
**Current state: Good.**
- Invitee receives magic link → signs up → enters **their name** → is auto-added to the inviter's household.
- First screen they see is the shared dashboard with all household lists.

### Section 1C: Dashboard (Redesigned)
**This is currently missing / unclear.** Design a new dashboard screen:

**Layout:**
- Top: User names / avatars (both members of the household). E.g. "אילון ודנה"
- Body: A grid or list of lists the household owns.

**Each list card shows:**
- List name (user-defined, e.g. "סופר תל אביב")
- List type icon/label (supermarket 🛒, pharmacy 💊, house 🏠)
- Progress badge (e.g. "4 of 12") — shows items checked in current trip
- Last edited timestamp (optional but nice: "ערכתי לפני 2 שעות")

**Actions:**
- Tap a list card → opens that list in **Shopping Mode** (see Section 2 below)
- "+" button at bottom → modal to create a new list (pick name + type)

---

### Section 2: Shopping Mode (Default List View)

**Entry:** User taps a list from the dashboard.

**Layout:**
- Header: list name + list type
- Progress badge: "X of Y items checked" (e.g., "4 of 12")
- Sections (grouped by type): each with an illustration and items
- Each item: checkbox + name + quantity (if any)
- Bottom: sticky "סיימתי קניות" button (only visible if ≥1 item is checked)

**Actions in Shopping Mode:**
- Tick/untick items → checkbox animation (strike-through when checked)
- Tap "עריכה" button (top-right?) → enter Edit Mode
- Tap "סיימתי קניות" (when ≥1 ticked) → archives trip, removes ticked items, returns to Shopping Mode

**Visual Treatment:**
- Ticked items: strike-through text, subtle fade/reduced opacity
- Sections: each has an illustration above it (same as current design)
- RTL throughout, Hebrew only

---

### Section 3: Edit Mode (Toggle from Shopping Mode)

**Entry:** Tap "עריכה" button in Shopping Mode.

**Layout:**
- Same list structure as Shopping Mode, but:
- Items now have delete icons (trash/×)
- Items are draggable within their section (visual drag handle, e.g., ≡)
- Top: an "Add Item" button (or "הוסף פריט +" button)
- Bottom: sticky "שמור" button (to save and return to Shopping Mode)

**Add Item Flow (within Edit Mode):**
1. Tap "הוסף פריט"
2. Modal/bottom-sheet opens with:
   - Text input: "שם הפריט" (item name) — required
   - Text input: "כמות" (quantity) — optional, free text (e.g., "קילו", "2 חבילות")
   - Button: "בחר קטגוריה" (pick section)
3. Tap "בחר קטגוריה" → section picker modal opens
   - Show all sections for this list type
   - User taps one → selection closes, returns to add-item form
   - Selected section is now shown (e.g., "קטגוריה: מוצרי חלב")
4. User taps "הוסיף" (or equivalent) → item is added to the list, modal closes, user sees the item in its section

**Edit Item:**
- Tap item in Edit Mode → edit modal opens (same as add, but with current values pre-filled)
- User changes name / quantity / section
- Tap "עדכן" → saves, modal closes

**Delete Item:**
- Tap trash icon next to item → removes it immediately (or confirm dialog if UX calls for it)

**Reorder:**
- Drag item within its section → new order is reflected immediately
- Dragging out of section should snap back (not allowed per scope)

**Save:**
- Tap "שמור" button → all changes persist, Edit Mode closes, user returns to Shopping Mode

---

### Section 4: Trip Completion

**When user taps "סיימתי קניות":**
1. A confirmation modal appears (optional, but nice for intent confirmation)
2. Tapping "אישור" or "סיימתי" archives the trip snapshot (date + all items + ticked status)
3. Ticked items are removed from the live list
4. Unticked items stay on the list for next trip
5. UI returns to Shopping Mode with the updated list

---

## Part 3: States & Edge Cases

### Empty List
When a list has no items yet:
- Show a friendly empty state (illustration + "עדיין אין פריטים" or similar)
- "הוסף פריט" or "בואו נתחיל" CTA to enter Edit Mode

### Loading / Sync
- If data is syncing from partner, show a subtle loading indicator
- No blocking—just let the user know activity is happening

### Section with No Items
If a section has no items (e.g., no frozen items added yet), don't show the section header/illustration.

---

## Part 4: RTL & Hebrew

- All text is Hebrew (no English in MVP)
- `dir="rtl"` context throughout
- Directional icons (chevrons, arrows, drag handles) are mirrored
- Numbers stay LTR (if any appear)
- Font supports full Hebrew set

---

## Part 5: Design System Alignment

- Button color: **#F4B5A0** (peach pastel) — adjust palette as needed for harmony
- Spacing, radii, tap targets: keep current pastel design aesthetic
- Each section illustration: continue current approach (AI / curated)
- Micro-interactions: keep animations smooth and subtle

---

## What to Keep

- Signup / invite flow (Section 1A & 1C) is good — just add name input
- Item card layout, strike-through treatment, section illustrations
- Overall pastel aesthetic and RTL handling

---

## What's New / Changed

- **Dashboard design** (Section 1B) — show all lists, type icons, progress
- **Mode system** — Shopping (default) vs Edit (toggle), clear separation
- **Edit Mode interactions** — add / edit / delete / drag / save
- **Button color** — peach instead of green

---

## Exit Criteria

After you update:
1. All three list types are shown with their sections
2. Both Shopping and Edit modes are visually distinct and clearly labeled
3. Add item flow is clear: name + quantity → pick section → save
4. Progress badge is visible in Shopping Mode
5. "סיימתי קניות" flow is shown
6. Dashboard shows both users' names and all lists
7. RTL, Hebrew, pastel aesthetic throughout
8. Peach button (#F4B5A0) is in use

**Then we review, lock, and hand off to Tech Lead.**

---

Ready to share with Claude Designer?
