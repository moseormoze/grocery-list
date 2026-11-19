# Design: Drag Between Sections (Edit Mode)

## Screens Affected

- **`/lists/[listId]`** (List Detail) במצב `mode === 'edit'`: ארכיטקטורת ה-DnD משתנה מ-`DndContext`-per-section ל-`DndContext` יחיד ב-root. ה-handle `≡` שכבר קיים בכל פריט ([app/lists/[listId]/page.tsx:264-271](app/lists/[listId]/page.tsx#L264-L271)) מאפשר עכשיו גם move בין סקציות, לא רק reorder פנימי.
- אין שינוי במסך `/lists` או במסכים אחרים.
- אין שינוי במצב Shopping (`mode === 'browse'`): הגרירה מנוטרלת לחלוטין, בדיוק כמו היום (דרך `useSortable({ disabled: mode !== 'edit' })`).

## Components

- **New:**
  - **`SectionDropZone`** (wrapper logical, לא קומפוננטה דקלרטיבית בהכרח) — כל container של סקציה מקבל `useDroppable({ id: 'section:${sectionKey}' })`. תפקידו: לאפשר drop על "כל הרווח של הסקציה" (banner + padding + bottom whitespace), לא רק על פריטים.
  - **`DragOverlay`** ([@dnd-kit/core](https://docs.dndkit.com)) — portal שמרנדר ייצוג של הפריט הנגרר כדי שהוא יעלה מעל גבולות הסקציה במהלך cross-section drag. ללא ה-overlay, הפריט נחתך ב-`overflow-hidden` של ה-section card / row.

- **Reused:**
  - `SortableItem` ([app/lists/[listId]/page.tsx:189-344](app/lists/[listId]/page.tsx#L189-L344)) — נשאר זהה ל-API שלו (`useSortable({ id: item.id })`). שינוי פנימי קטן ב-styling במצב dragging.
  - `SECTIONS_BY_TYPE` ([lib/categories.ts](lib/categories.ts)) — מקור האמת לרשימת הסקציות פר סוג רשימה. אין שינוי.
  - `reorderOptimistically` מ-`useList` — נמשיך להשתמש בו ל-reorder בתוך אותה סקציה.
  - `updateOptimistically` מ-`useList` — לשימוש בעדכון פריט שעבר סקציה (שינוי `section_id`).

- **Modified:**
  - **List Detail page** ([app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx)) — הריפקטור המרכזי:
    - **`DndContext` מוזז ל-root** של רשימת הסקציות (סביב ה-`Object.entries(groupedItems).map(...)`). כיום הוא ב-per-section ([page.tsx:476-480](app/lists/[listId]/page.tsx#L476-L480)).
    - **`SortableContext` נשאר per-section** — אחד לכל מערך פריטים של סקציה. הוא ספק ה-sortable identifiers וה-strategy. ה-`useDroppable` החדש עוטף את כולו.
    - **`handleDragEnd` נכתב מחדש** — מבחין בין שלוש תוצאות: (1) drop על אותו פריט (no-op), (2) drop על פריט/אזור באותה סקציה (reorder קיים), (3) drop על פריט/אזור בסקציה אחרת (move + שינוי `section_id`).
    - **`onDragStart` חדש** — שומר את ה-`activeItem` ב-state כדי להזין ל-`DragOverlay`.
    - **Conflict avoidance**: ה-`onTouchStart`/`onTouchEnd` של swipe-to-delete חי על אותו `SortableItem`. שני המנגנונים חיים בשלום היום במצב browse בלבד; ה-`useSortable` מנוטרל ב-browse כך שלא נוצרת תחרות. מצב edit לא חשוף ל-swipe-to-delete (הוא ב-`mode === 'browse'`).

## User Flow

### A. Reorder באותה סקציה (התנהגות קיימת — regression-safe)

1. משתמש פותח מצב עריכה (`ערוך`).
2. תופס פריט עם ה-handle `≡`.
3. גורר למעלה/למטה בתוך אותה סקציה — רואה את הסידור הסורטבילי הקיים (insertion preview, החלקה).
4. שחרור על פריט אחר באותה סקציה → reorder (`order_index` מתעדכן). זהה להיום.
5. ה-handle והפריט חוזרים למצב רגיל, ה-`DragOverlay` נעלם.

### B. Move בין סקציות (חדש)

1. משתמש במצב עריכה. תופס פריט עם ה-handle `≡` (לחיצה ארוכה 250ms על מובייל, או drag מיידי על desktop — לא משתנה מהיום).
2. בתחילת הגרירה:
   - הפריט המקורי במקומו מקבל מצב "פנטום" (`opacity: 0.4`) — מאותת "זה הפריט שאתה גורר".
   - `DragOverlay` מופיע ועוקב אחרי האצבע/סמן עם הפריט המוצג בגודלו המלא, עם `shadow-card-elevated` חדש (ראה Design System Impact).
3. כשהמשתמש עובר עם הפריט מעל **סקציה אחרת**:
   - אותה סקציה (banner + רקע אזור הפריטים) מקבלת **drop-zone highlight**: מסגרת `ring-2 ring-accent ring-offset-2 ring-offset-cream` + `bg-accent-tint/40` עדין על אזור הפריטים. מעבר 120ms ease-out.
   - הסקציה המקורית **לא** מקבלת highlight (אין משמעות ל-drop עליה).
4. שחרור על סקציית היעד (בכל מקום בתוך הסקציה — banner, between items, אחרי הפריט האחרון):
   - הפריט נוסף **בסוף סקציית היעד** (אחרי הפריט הקיים האחרון של אותה סקציה).
   - ה-`section_id` של הפריט מתעדכן ב-DB. `order_index` נקבע כ-`max(order_index)+1` של הסקציה החדשה (תיאום עם המבנה הקיים שבו `order_index` הוא גלובלי לרשימה).
   - האנימציה: הפריט "נוחת" בסוף הסקציה עם slide-in קצר (200ms ease-out). הפנטום במקור נעלם.
5. ה-`DragOverlay` נעלם. ה-realtime channel הקיים מסנכרן את ה-UPDATE לפרטנר; הפרטנר יראה את הפריט קופץ לסקציה החדשה (עקבי עם reorder/check/add היום — אין הילה מיוחדת ל-"מישהו זז").

### C. Drop על אזור לא תקף (ביטול)

1. משתמש גורר פריט.
2. משחרר מעל אזור שאינו סקציה (מחוץ לרשימה, או על הסקציה המקורית עצמה ללא over-item).
3. ה-`DragOverlay` מתפוגג. הפנטום במקור חוזר ל-`opacity: 1`. אין שינוי ב-DB.
4. בפרט: drop על banner של **סקציית המקור** → ביטול (לא מבצעים move לאותו section_id; לא מסדרים מחדש).

### D. Auto-scroll במובייל

1. במהלך גרירה, אם האצבע מגיעה ל-~80px מהקצה התחתון/עליון של ה-viewport, `@dnd-kit`'s built-in `autoScroll: true` מפעיל גלילה אוטומטית.
2. סקציות מתחת/מעל נכנסות לתצוגה.
3. המשתמש יכול לעצור כשמגיעים לסקציה הרצויה ולשחרר.
4. אין צורך בקוד חדש — הפיצ׳ר הזה default ב-`@dnd-kit/core`.

## Drop-zone Visual Spec

| מצב | סקציית מקור | סקציית יעד אפשרי | סקציה לא מעורבת |
|---|---|---|---|
| Idle (לפני drag) | רגיל | רגיל | רגיל |
| Drag פעיל, hover מחוץ לסקציה | רגיל (פנטום בתוכה) | רגיל | רגיל |
| Drag פעיל, hover מעל סקציית יעד | רגיל (פנטום בתוכה) | **highlight** (ring + tint) | רגיל |
| Drag פעיל, hover מעל סקציית מקור | רגיל (פנטום בתוכה) | — | רגיל |

**ה-highlight המוצע (סקציית יעד פעילה):**

```
ring: 2px solid var(--accent) (= #F4B5A0 לפי tokens)
ring-offset: 2px
ring-offset-color: var(--cream) (= bg-cream)
items-area background overlay: rgba(244, 181, 160, 0.12) (accent ב-12% alpha)
transition: ring 120ms ease-out, background-color 120ms ease-out
```

**הפנטום (פריט המקור במהלך drag):**

```
opacity: 0.4
filter: saturate(0.7)
transition: opacity 120ms ease-out
ה-handle והאייקונים בתוכו נשארים גלויים — אבל בעמעום עם הרקע
```

**ה-DragOverlay (הפריט שעוקב אחרי האצבע):**

```
מאפיינים זהים לפריט במצב רגיל (אותו `item-row`)
תוספת: shadow: 0 8px 24px rgba(28, 27, 23, 0.18) (drop shadow גבוה)
תוספת: scale(1.02) — קל, "נשא מהמסך"
border-radius: שמורה מהקיים (`rounded-lg`)
zIndex: גבוה (managed ע״י DragOverlay portal)
```

## Motion Specs

| תזוזה | תזמון | easing | הערה |
|---|---|---|---|
| הופעת highlight על סקציית יעד | 120ms | `ease-out` | מהיר — צריך להיות מורגש כתגובתי |
| היעלמות highlight | 120ms | `ease-out` | סימטרי |
| הופעת DragOverlay | מיידי (0ms) | — | חיוני לתחושת responsiveness |
| Slide-in של הפריט בסוף סקציית יעד (לאחר drop) | 200ms | `ease-out` | מובחן מ-snap, רך |
| היעלמות הפנטום במקור | 120ms fade | `ease-out` | סינכרוני עם ה-slide-in |

## States

- **Loading**: לא רלוונטי — הפיצ׳ר מתמרן על נתונים שכבר טעונים.
- **Empty**:
  - **רשימה ריקה**: ה-empty state הקיים ([page.tsx:409-418](app/lists/[listId]/page.tsx#L409-L418)) ממשיך כרגיל. אין סקציות, אין drag.
  - **סקציה ריקה**: לא מרונדרת ([page.tsx:422](app/lists/[listId]/page.tsx#L422), `if (sectionItems.length === 0) return null`). **מתועד כ-known limitation בבריף**. כתוצאה: לא ניתן להעביר פריט יחיד לסקציה שאין בה כלום. מאשרים את ההחלטה — דחוי עד שיהיה pain מוכח.
- **Error**:
  - אם ה-UPDATE ל-`section_id` נכשל ב-DB: optimistic update חוזר אחורה (revert state), הפריט קופץ חזרה לסקציה המקורית. אין toast UI חדש בסקופ הזה. (תיאום עם הדפוס הקיים של reorder שגם לא מציג שגיאות.)
  - אם ה-realtime לא מסנכרן (פרטנר offline): הפריט יסונכרן ברגע שהפרטנר יחזור — דפוס קיים.
- **Success**: הפריט בסקציה החדשה, מסונכרן עם DB ופרטנר. ה-handle חוזר למצב רגיל.

## RTL / Hebrew Notes

- **Final Hebrew copy**: אין UI copy חדש. אין כפתורים חדשים, אין tooltips, אין הודעות. הפיצ׳ר אינטראקטיבי בלבד.
- **Mirrored elements**:
  - ה-handle `≡` (`GripVertical` מ-`lucide-react`) הוא סימטרי — אין צורך במראה. נשאר כפי שהוא.
  - אין חצים או חיצים שמסמלים כיוון. הגרירה מסומלת ע״י המיקום הפיזי של ה-handle.
- **Mixed-direction edge cases**:
  - שמות פריטים שמכילים אנגלית (`dir="auto"` קיים) — נשארים כפי שהם בזמן drag. ה-`DragOverlay` משתמש באותו `item-row` ויירש את ה-`dir`.
  - כמויות (מספרים) — אותו דבר. נשאר נכון.
- **כיוון הגרירה**: הגרירה היא וורטיקלית (למעלה/למטה). אין השפעה של RTL. ה-`verticalListSortingStrategy` כבר בשימוש.

## Design System Impact

- **תוספת shadow חדשה**: `shadow-card-elevated` עבור ה-`DragOverlay`. הצעה לערך: `0 8px 24px rgba(28, 27, 23, 0.18)`.
  - **דגל**: לא קיים היום ב-[tailwind.config.ts](tailwind.config.ts). יש `shadow-card` (`0 1px 0 rgba(28,27,23,0.06), 0 1px 2px rgba(0,0,0,0.03)`) ו-`shadow-sheet`/`shadow-modal`.
  - **הצעה**: להוסיף את `shadow-card-elevated` כ-token חדש ב-`tailwind.config.ts`. שימוש: רק ב-`DragOverlay` כרגע, אבל הוא ניתן לשימוש חוזר בכל drag preview עתידי.
  - **חלופה אם דוחים את ה-token**: לשים inline style ב-`DragOverlay`. פחות נקי.

- **תוספת tint עבור drop-zone**: ה-`accent` ב-12% alpha (`rgba(244, 181, 160, 0.12)`).
  - **דגל**: גם זה לא token. הצעה: להגדיר כ-`bg-accent/10` (Tailwind opacity modifier) — לא דורש token חדש כלל אם `accent` כבר זמין כצבע. בדיקה: כן, `accent: '#F4B5A0'` קיים ב-[tailwind.config.ts](tailwind.config.ts).
  - **החלטה**: להשתמש ב-`bg-accent/10` או `bg-accent/12` — לא דורש שינוי בטוקנים.

- **תוספת ring color**: `ring-accent` — אם `accent` כבר token, אז `ring-accent` עובד אוטומטית ב-Tailwind. לא צריך שינוי.

- **אין tokens חדשים נוספים**. אין צבעים, רדיוסים, או typography חדשים.

- **שינוי ארכיטקטוני (לא visual)**: המעבר מ-`DndContext`-per-section ל-`DndContext` יחיד הוא ריפקטור פנימי שלא משפיע על ה-design system. מוזכר כאן כי הוא חוסם של הפיצ׳ר, ושייך לתפקיד Tech Lead בהמשך.

## Acceptance — UI Hooks

(מתורגם מ-`brief.md` לאלמנטים הויזואליים שהמעצב מבטיח)

- [ ] תפיסת פריט עם `≡` במצב עריכה → פנטום מופיע במקור (`opacity: 0.4`), `DragOverlay` מופיע בעקבות האצבע.
- [ ] hover מעל סקציה אחרת → ring + tint על אותה סקציה תוך 120ms.
- [ ] שחרור על אזור הסקציה (כל מקום בתוכה) → פריט נוסף בסוף הסקציה החדשה עם slide-in 200ms.
- [ ] שחרור על אזור לא תקף → ביטול, אין שינוי ויזואלי מתמשך, ה-overlay מתפוגג, הפנטום חוזר ל-opacity מלא.
- [ ] במצב Shopping (`browse`): אין handle, אין drag, אין highlights — בדיוק כמו היום.
- [ ] במובייל: גרירה לקצה viewport מפעילה auto-scroll (built-in @dnd-kit).
- [ ] RTL: ה-overlay נראה נכון בעברית (טקסט מוזרם נכון, אייקונים במקומם).

## Open Questions

*(None — closed.)*
