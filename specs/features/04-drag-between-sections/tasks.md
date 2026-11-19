---
status: pending-approval
date: 2026-05-25
brief: specs/features/04-drag-between-sections/brief.md
design: specs/features/04-drag-between-sections/design.md
---

# Tasks: Drag Between Sections (Edit Mode)

## Overview

שני טסקים על קובץ אחד עיקרי ([app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx)) + עדכון קטן ל-`useList` ו-helper של DnD outcome נטו.

**T1 — Refactor:** העברת `DndContext` מ-per-section ל-root + `DragOverlay` + extraction של לוגיקת ה-drag-end לפונקציה טהורה (testable). **Regression-safe**: ההתנהגות זהה להיום (reorder באותה סקציה בלבד).

**T2 — Feature:** `useDroppable` על סקציות + cross-section move (DB + UI), highlight על סקציית יעד, פנטום על מקור, slide-in על drop.

הפיצול הזה מאפשר:
- מרג' T1 לבד אם T2 נתקע.
- ה-pure function ב-T1 משמשת כ-test surface יציב — כי `@dnd-kit` קשה לבדיקה ב-jsdom (ראה Risks).

Stack assumptions (לפי [tech-stack.md](context/tech-stack.md) ו-[vitest.config.ts](vitest.config.ts)):
- Next.js App Router, `'use client'` page
- `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`
- Vitest + jsdom (אין Playwright בפרויקט; manual verification במכשיר אמיתי)
- TypeScript strict, no `any`

---

## Task List

### T1 — Refactor: root `DndContext` + `DragOverlay` + extract pure outcome fn

**Goal:** ריפקטור ארכיטקטוני שמאפשר cross-container drag, בלי לשנות התנהגות. ה-`DndContext` עובר מ-per-section ל-root, `DragOverlay` portal נוסף, ולוגיקת ה-`onDragEnd` מועברת לפונקציה טהורה ניתנת לבדיקה.

**Approach:**

1. **שינוי מבנה ב-[app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx):**
   - להעיף את ה-`DndContext` ב-[page.tsx:476-480](app/lists/[listId]/page.tsx#L476-L480) (per-section).
   - לעטוף את כל `Object.entries(groupedItems).map(...)` ב-`DndContext` יחיד (סביב [page.tsx:421](app/lists/[listId]/page.tsx#L421)).
   - ה-`SortableContext` נשאר per-section (כן רוצים — מאפשר insertion strategy לכל סקציה בנפרד).
   - `sensors` נשארים זהים ([page.tsx:65-69](app/lists/[listId]/page.tsx#L65-L69)).
   - להוסיף `<DragOverlay>` מ-`@dnd-kit/core` כ-sibling ל-list container (לא חייב בתוך ה-DndContext לרנדור, אבל חייב בתוכו כדי לקבל את ה-`active`).

2. **State חדש ל-overlay:**
   - `const [activeItem, setActiveItem] = useState<Item | null>(null)`.
   - `onDragStart={(e) => setActiveItem(items.find(i => i.id === e.active.id) ?? null)}`.
   - `onDragEnd` (וגם `onDragCancel`) → `setActiveItem(null)`.

3. **רנדור ה-`DragOverlay`:**
   - אם `activeItem` קיים → לרנדר ייצוג של ה-`SortableItem` עם props מינימליים. בשלב הזה מספיק לרנדר את ה-row visual (שם פריט + qty + check button) **ללא** `useSortable` (זה רק תצוגה).
   - styling: `shadow-card-elevated` (טוקן חדש — ראה item 5 בהמשך) + `scale(1.02)`.
   - הערה: אפשרי שלעולם לא נראה את ה-overlay אם ה-touch sensor delay (250ms) "מבליע" את הרגע הראשון — צריך לאמת ידנית.

4. **Extract `computeDragOutcome` לפונקציה טהורה:**
   - קובץ חדש: `lib/dnd/outcome.ts`.
   - חתימה:
     ```ts
     type DragOutcome =
       | { kind: 'none' }
       | { kind: 'reorder'; sectionId: string; orderedIds: string[] }
       | { kind: 'move'; itemId: string; toSectionId: string };

     export function computeDragOutcome(args: {
       activeId: string;
       overId: string | null;
       items: Item[];           // כל הפריטים של הרשימה
     }): DragOutcome;
     ```
   - **כללי החלטה (גרסת T1, ללא cross-section עדיין):**
     - `overId === null || activeId === overId` → `{ kind: 'none' }`.
     - ה-active וה-over באותה סקציה → `{ kind: 'reorder', sectionId, orderedIds }` (לפי `arrayMove` כמו היום).
     - אחרת → `{ kind: 'none' }` (cross-section יוטמע ב-T2).
   - ב-`handleDragEnd` של ה-page: לקרוא ל-`computeDragOutcome`, לפעול לפי ה-kind.
     - `reorder` → לעדכן `order_index` ל-IDs (כמו [page.tsx:439-451](app/lists/[listId]/page.tsx#L439-L451)).
     - `none` → no-op.

5. **Design token חדש (Design System Impact מה-[design.md](specs/features/04-drag-between-sections/design.md)):**
   - להוסיף ל-[tailwind.config.ts](tailwind.config.ts) תחת `extend.boxShadow`:
     ```
     'card-elevated': '0 8px 24px rgba(28, 27, 23, 0.18)',
     ```
   - **לא** משנה את `shadow-card` הקיים.

**Files likely touched:**
- [app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx) — שינוי מבני, ~80-100 LOC delta.
- `lib/dnd/outcome.ts` (חדש) — ~30 LOC.
- `lib/dnd/__tests__/outcome.test.ts` (חדש) — ~80 LOC.
- [tailwind.config.ts](tailwind.config.ts) — שורה אחת.

**Test strategy (Vitest):**

- **Unit על `computeDragOutcome` (lib/dnd/__tests__/outcome.test.ts):**
  - `overId === null` → kind 'none'.
  - `activeId === overId` → kind 'none'.
  - active ו-over באותה סקציה, סדר 1→2 → kind 'reorder', orderedIds תואם `arrayMove`.
  - active ב-section A ו-over ב-section B → kind 'none' (יוחלף ב-T2).
  - active לא נמצא ב-items (corrupt) → kind 'none'.
- **אין integration test ל-`DndContext`** — ראה Risks. ההסתמכות היא על: (א) הפונקציה הטהורה מכוסה ביחידה; (ב) manual verification של ה-page.

**Depends on:** אין.

**Done when:**
- [ ] `npm test` — כל הטסטים הקיימים (כולל `useList`, `categories`, וכו') ממשיכים לעבור.
- [ ] טסטים חדשים ל-`computeDragOutcome` נכתבים ועוברים (5 it blocks למעלה).
- [ ] `tsc --noEmit` עובר ללא שגיאות. אין `any`.
- [ ] `npm run dev` עולה. ב-`/lists/[listId]` במצב Edit: גרירה של פריט בתוך סקציה עובדת **בדיוק כמו היום** (reorder נשמר, סדר מעודכן ב-DB).
- [ ] גרירה לסקציה אחרת **מבוטלת** (חוזרת למקור). זה התנהגות מצופה ב-T1 — תיתוסף ב-T2.
- [ ] ה-`shadow-card-elevated` קיים ב-`tailwind.config.ts` אך לא נמצא בשימוש בשום מקום אחר עדיין — הוא יישומש ע״י ה-`DragOverlay` ב-T1 אם בחרת לשים, או רק ב-T2 אם דחית.

**Estimated size:** ~190 LOC (כולל טסטים).

---

### T2 — Cross-section move + drop highlights + phantom

**Goal:** הפיצ׳ר עצמו. גרירת פריט מסקציה X לסקציה Y במצב Edit מעדכנת את `section_id` ב-DB, מציבה את הפריט בסוף סקציית היעד, עם משוב ויזואלי מלא לפי [design.md](specs/features/04-drag-between-sections/design.md).

**Approach:**

1. **`useDroppable` על כל סקציה:**
   - בתוך ה-`Object.entries(groupedItems).map((section, sectionItems) => ...)`:
     ```ts
     const { setNodeRef, isOver } = useDroppable({
       id: `section:${section}`,
       data: { type: 'section', sectionId: section },
     });
     ```
   - לעטוף את ה-section container (`<div key={section} className="flex flex-col gap-2">` ב-[page.tsx:455](app/lists/[listId]/page.tsx#L455)) ב-`ref={setNodeRef}`.
   - הערה: ה-`SortableContext` ויחזיק את הפריטים בפנים — שניהם יחדיו (droppable wrapper + sortable items) מאפשרים גם drop על banner וגם drop על item.

2. **`computeDragOutcome` — הרחבה ל-cross-section:**
   - ב-`lib/dnd/outcome.ts`: ב-T1 החזרנו `none` ל-cross-section. עכשיו:
     - לזהות `overId` שמתחיל ב-`section:` → cross-section move ל-`overId.slice(8)`.
     - אם `overId` הוא item id של סקציה אחרת → גם cross-section move לסקציה של אותו item.
     - אם active ו-over באותה סקציה → reorder (כמו בT1).
     - חתימה לא משתנה. רק הענפים מתעדכנים.
   - להוסיף test cases חדשים:
     - active ב-section A, overId = `section:B` → kind 'move', toSectionId 'B'.
     - active ב-section A, overId = item-בסקציה B → kind 'move', toSectionId 'B'.
     - active ב-section A, overId = `section:A` (חזרה לעצמה) → kind 'none'.

3. **טיפול ב-`move` ב-`handleDragEnd`:**
   - חישוב `order_index` חדש: `Math.max(...itemsInTargetSection.map(i => i.order_index), -1) + 1` (`-1` כדי שאם הסקציה ריקה — לא רלוונטי כי בריף אומר שסקציות ריקות לא תמיד מוצגות, אבל בכל מקרה ה-`max` עם `-1` בטוח).
   - אופטימיסטי: לעדכן את ה-item ב-state. **שימוש ב-`updateOptimistically(updatedItem)`** ב-[useList.ts:35-44](hooks/useList.ts#L35-L44) — מצוין, הוא מטפל בעדכון של אובייקט קיים לפי id (מחליף בתוך ה-array).
   - לאחר עדכון אופטימי: לקרוא ל-DB:
     ```ts
     await supabase
       .from('items')
       .update({
         section_id: outcome.toSectionId,
         order_index: newOrderIndex,
         updated_at: new Date().toISOString(),
       })
       .eq('id', outcome.itemId);
     ```
   - על שגיאת DB: revert — לקרוא ל-`updateOptimistically(originalItem)`. (כמו שאר העדכונים, אין UI שגיאה — תיעוד ב-design.md.)
   - **לא דורש שינוי ב-`useList`** — `updateOptimistically` הקיים מספיק.

4. **Visual: phantom על source item:**
   - ב-`SortableItem` ([page.tsx:189-344](app/lists/[listId]/page.tsx#L189-L344)) — להוסיף inline style מותנה:
     ```ts
     opacity: isDragging ? 0.4 : 1,
     filter: isDragging ? 'saturate(0.7)' : undefined,
     transition: 'opacity 120ms ease-out, filter 120ms ease-out',
     ```
   - `isDragging` כבר זמין מ-`useSortable` ([page.tsx:206](app/lists/[listId]/page.tsx#L206)).

5. **Visual: highlight על סקציית יעד:**
   - על ה-section wrapper (זה שעוטף את `ref={setNodeRef}` מסעיף 1):
     - בודקים: האם זה drop target חוקי? `const isValidDropTarget = isOver && activeItem?.section_id !== sectionId`.
     - className מותנה: `${isValidDropTarget ? 'ring-2 ring-accent ring-offset-2 ring-offset-cream' : ''}` (Tailwind ring utilities).
     - על אזור הפריטים בלבד (תת-div): `style={{ backgroundColor: isValidDropTarget ? 'rgba(244, 181, 160, 0.12)' : undefined, transition: 'background-color 120ms ease-out, ring 120ms ease-out' }}` — או `bg-accent/10` ב-Tailwind (גמיש יותר).
   - מעבר חלק: `transition` על ring + background.

6. **DragOverlay עם shadow:**
   - אם לא הוטמע ב-T1: להוסיף את ה-`shadow-card-elevated` + `scale(1.02)` על ה-overlay כאן.
   - **תוכן** ה-overlay: לרנדר את אותו `SortableItem` עם prop חדש `isOverlay={true}` שמכבה את ה-`useSortable` ה-listeners ומחזיר את ה-row כמו "מצב רגיל" עם shadow.
   - חלופה: לחלץ את ה-row visual ל-`ItemRow` קטן מבלי `useSortable`, ולתת ל-`SortableItem` להשתמש בו. מומלץ — נקי יותר.

7. **Slide-in animation על drop:**
   - `@dnd-kit/sortable` כבר מספק transition אוטומטי על reorder. עבור cross-section drop, אחרי ה-`updateOptimistically`, הפריט נכנס למקום החדש ברנדור הבא — אם רוצים slide-in מובחן, להוסיף CSS animation:
     ```ts
     // ב-SortableItem, אם isDragging===false וה-item רק עכשיו נוסף ל-section זה:
     ```
   - הגישה הפשוטה: לסמוך על ה-transition של `@dnd-kit/sortable` (`transition` מ-`useSortable`). אם נראה צורם — להוסיף animation מותאם.
   - **המלצה לT2**: לסמוך על ה-default. אם ב-manual verification זה לא חלק — לפתוח issue ולא לחסום את ה-PR.

8. **`onDragOver` handler:**
   - הוספת `onDragOver={(e) => { /* ניתן להוסיף כאן בעתיד אם נרצה preview בזמן אמת */ }}`. ב-T2 לא צריך — `isOver` של `useDroppable` מספק את ה-highlight. רישום ה-handler אופציונלי.

9. **Edit-mode gating:**
   - וודא ש-`useDroppable` הסקציות **לא פעיל** במצב Shopping. דרכים:
     - לעטוף את ה-`useDroppable` ב-`disabled: mode !== 'edit'` (לא קיים API ישיר — חלופה: לא לחבר את ה-`setNodeRef` במצב browse).
     - או פשוט: כל ה-`DndContext` כבר במצב edit-only? לא — היום ה-`DndContext` תמיד פעיל, וה-`disabled` הוא רק ב-`useSortable` של כל item. אז דרושה גם הגנה על הסקציות.
   - **גישה מומלצת**: לתת ל-section wrapper `setNodeRef={mode === 'edit' ? setNodeRef : undefined}`. או conditional rendering.

10. **Done check — קונפליקט עם swipe-to-delete:**
    - swipe-to-delete חי ב-mode='browse' בלבד ([page.tsx:223](app/lists/[listId]/page.tsx#L223)). DnD חי ב-mode='edit' בלבד (`useSortable({ disabled: mode !== 'edit' })`). אין קונפליקט אמיתי. **רק לוודא ב-manual** שהמעבר בין modes לא משאיר state תקוע.

**Files likely touched:**
- [app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx) — קוד עיקרי, ~120-150 LOC delta.
- `lib/dnd/outcome.ts` — הרחבת המקרים, ~15 LOC.
- `lib/dnd/__tests__/outcome.test.ts` — 3-4 it blocks חדשים, ~40 LOC.
- (אם בוחרים לחלץ `ItemRow`): רכיב חדש קטן ~40 LOC.

**Test strategy:**

- **Unit על `computeDragOutcome` (extending T1's tests):**
  - active ב-A, over = `section:B` → kind 'move', toSectionId 'B', itemId הנכון.
  - active ב-A, over = item ב-B → kind 'move', toSectionId 'B'.
  - active ב-A, over = `section:A` → kind 'none' (אין משמעות).
  - active ב-A, over = item ב-A → kind 'reorder' (כפי שכבר נבדק ב-T1).
- **אין integration test על drag visual** (ראה Risks). הסתמכות על manual verification.
- **Manual verification** (חובה לפני merge):
  - **Desktop Chrome**: גרירה בין סקציות עובדת. רואים phantom, highlight, overlay.
  - **iPhone Safari + Chrome (PWA installed)**: גרירה עובדת אחרי 250ms press. auto-scroll מופעל בקצה. ה-`updated_at` ב-DB מעודכן (בדיקה ב-Supabase dashboard).
  - **שני מכשירים**: פתיחת אותה רשימה. גרירה בסביבה A, בסביבה B רואים את הפריט מופיע בסקציה החדשה ב-realtime.
  - **Mode toggle**: עריכה → סדור → חזרה ל-shopping → אין state תקוע, swipe-to-delete עובד.

**Depends on:** T1.

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים. הטסטים מ-T1 ממשיכים לעבור.
- [ ] `tsc --noEmit` עובר. אין `any`.
- [ ] גרירה בין סקציות במצב Edit מעדכנת את `section_id` ב-DB ובשרת.
- [ ] גרירה בתוך אותה סקציה ממשיכה לעבוד (regression-safe).
- [ ] במצב Shopping אין drag (handle נסתר, swipe-to-delete עובד).
- [ ] Highlight ויזואלי על סקציית יעד מופיע בזמן hover.
- [ ] Phantom (opacity 0.4) על פריט מקור בזמן drag.
- [ ] `DragOverlay` עם shadow + scale(1.02) מופיע ועוקב אחרי האצבע/סמן.
- [ ] **בדיקה ידנית במכשיר אמיתי** (iPhone או Android Chrome) הצליחה — לרבות auto-scroll, realtime sync לפרטנר, ומעבר edit→browse.
- [ ] ה-PR description מפנה ל-`specs/features/04-drag-between-sections/tasks.md#T2` ול-brief/design.

**Estimated size:** ~180-220 LOC. **דגל**: גבולי לסף ה-200. אם בפועל יוצא משמעותית מעל, לפצל לפני שמגישים PR (אחרי הריפקטור ב-T1, חלוקה אפשרית: T2a = logic + tests + droppable wiring; T2b = visuals + overlay).

---

## Build Order

```
T1 (refactor + DragOverlay scaffold + pure outcome) → T2 (cross-section feature + visuals)
```

- **T1 רץ ראשון** — בלעדיו אין דרך להוסיף cross-container drag. הוא regression-safe ויכול להיכנס למרג' לבד.
- **T2 בונה על T1** — מרחיב את `computeDragOutcome`, מוסיף `useDroppable`, ומחבר את ה-DB.
- אם T2 חורג מ-200 LOC: לפצל לפי המלצה בסוף T2.

---

## Risks

### High

1. **`@dnd-kit` קשה לבדיקה אינטגרטיבית ב-jsdom.** ה-sensors שלו מסתמכים על `getBoundingClientRect()` שמחזיר אפסים ב-jsdom. בכוונה לא הוספנו integration test ל-`DndContext` עצמו. **Mitigation**: (א) ה-`computeDragOutcome` הוא unit-testable במלואו. (ב) הסתמכות על manual verification. (ג) אם בעתיד תרצו לכסות את ה-DnD עצמו — דרושה Playwright (לא בסקופ).

### Medium

2. **`useDroppable` כפול במקרה של `SortableContext` עם פריטים** — ב-`@dnd-kit/core`, פריטים בתוך `SortableContext` הם droppables אוטומטית. הוספת `useDroppable` נוסף על ה-wrapper של הסקציה יוצרת **שני** drop targets שמתחרים על אותו אזור. ה-`closestCenter` collision detection בוחר את הקרוב ביותר — שזה תמיד item (כי הוא מתחת לאצבע). זה אומר ש-`overId` יהיה item id במקרים רגילים, ו-`section:X` רק כש-hover על banner/empty space.
   **Mitigation**: ה-`computeDragOutcome` מטפל בשתי המקרים (item id וגם `section:` prefix) — אם over = item בסקציה אחרת, מתייחסים אליה כ-move לסקציה של אותו item. ה-test cases מכסים את שני המסלולים. **חלופה אם יוצא רע**: לשנות את ה-collision detection ל-`pointerWithin` או `rectIntersection` — לבחון ב-manual.

3. **State reset במעבר edit → browse בזמן drag פעיל** — אם המשתמש פותח edit, מתחיל drag, ואז (איכשהו) לוחץ "בוצע" — ה-DnD context נשאר עם `active` תקוע? יותר תיאורטי מאשר מעשי (אצבע באוויר). **Mitigation**: `useEffect` שמאזין ל-`mode` ומאפס `activeItem`:
   ```ts
   useEffect(() => { if (mode === 'browse') setActiveItem(null); }, [mode]);
   ```

### Low

4. **Tailwind ring + offset על background צבעוני** — `ring-offset-cream` דורש שהקלאס `ring-offset-cream` קיים. בדיקה: `cream` הוא token ב-[tailwind.config.ts](tailwind.config.ts), אז `ring-offset-cream` נוצר אוטומטית ע״י Tailwind. אם לא — fallback ל-inline `box-shadow: 0 0 0 2px ...`.

5. **Realtime sync — סדר אירועים** — אם A מזיז item ל-section B ובו-בזמן B מסמן את אותו item — בקרת קונפליקט תלויה ב-`updated_at` של Supabase + ה-realtime ordering. **Mitigation**: ה-PATCH הוא של שדות שונים (section_id מול ticked), אז last-write-wins על כל שדה הוא נכון. אין צורך בלוגיקה מיוחדת.

6. **Touch press delay 250ms** — אם המשתמש "טפסר" מהר, ה-drag לא יתחיל. זה דפוס קיים, לא חדש. כל אינטראקציה אחרת (tap, swipe) עובדת ב-touchstart מיידי. **Mitigation**: לא דורש פעולה — תיעוד בלבד.

---

## Out of scope reminders

מהוצא ב-brief — אל תוסיף את אלה:
- **גרירה לסקציה ריקה** — סקציות ריקות לא מרונדרות ב-DOM. ידוע ומתועד.
- **בחירת מיקום בתוך סקציית היעד** — תמיד נוחת בסוף.
- **למידה/auto-categorization** — אין מנגנון שזוכר ש"גבינה היא מוצרי חלב".
- **Presence indicator** של "פרטנר זז עכשיו".
- **גרירה במצב Shopping** — נשארת רק בעריכה.
- **חלופת tap-to-move modal** — נדחתה.
- **שינויים ב-DB schema** — `section_id` כבר עמודה קיימת ב-`items`.
- **שינוי באנימציית snap הקיימת של @dnd-kit/sortable** ל-reorder באותה סקציה.

---

## Approval checklist (PM / user)

- [ ] T1 ו-T2 נראים מציאותיים מבחינת LOC (T2 גבולי — האם להסכים מראש על פיצול אם חורג?).
- [ ] **שאלה לפני אישור**: האם להוסיף את ה-`shadow-card-elevated` כ-Tailwind token ב-T1, או להישאר inline ב-`DragOverlay` עד שיתברר שצריך אותו במקום נוסף? (ההצעה: token ב-T1. כן/לא?)
- [ ] **שאלה לפני אישור**: האם להפסיק לקרוא ל-T1 "T1" ולקרוא ל-T2 "T2" — או למספור גלובלית בפרויקט? (היום הפיצ׳רים האחרים שמרו על T1/T2/T3 פר feature folder, אז אני שומר על אותו דפוס.)
