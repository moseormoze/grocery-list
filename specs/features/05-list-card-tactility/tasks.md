---
status: pending-approval
date: 2026-05-22
brief: specs/features/05-list-card-tactility/brief.md
design: specs/features/05-list-card-tactility/design.md
---

# Tasks: List Card Tactility

## Overview

ארבעה טסקים על קובץ יחיד (`ListCard`). T1 הוא ריפקטור־הכנה (extraction + baseline tests) כדי לאפשר טסטים בקלות לשלושת השאר. T2-T4 כל אחד מוסיף שכבת תחושה אחת — ניתן לבדוק, לבדוק ידנית, ולמרג' כל אחד בנפרד.

Stack assumptions (לפי [tech-stack.md](context/tech-stack.md) ולפי הקוד הקיים):
- Next.js App Router, `'use client'` קומפוננטה
- Vitest + React Testing Library + jsdom (לפי [vitest.config.ts](vitest.config.ts))
- אין ספריות גסטר/אנימציה — מימוש ידני בטאצ'-אבנטס

ה-`ListCard` מועבר ל-`components/ListCard.tsx` ב-T1 כדי להתאים לדפוס הקיים של [components/InvitePartnerBanner.tsx](components/InvitePartnerBanner.tsx) (כולל test ב-[components/__tests__/](components/__tests__/)).

---

## Task List

### T1 — Extract `ListCard` לקובץ עצמאי + baseline tests

**Goal:** להוציא את `ListCard` (130 שורות) מ-[app/lists/page.tsx](app/lists/page.tsx) לקובץ עצמאי, ולכתוב טסטים שמכסים את ההתנהגות הקיימת — בלי שינוי פונקציונלי. הטסטים האלה הם רשת הביטחון ל-T2/T3/T4.

**Approach:**
- העברת `ListCard` (ו-helpers כמו `listTypeNames` שמשמש רק אותו) ל-`components/ListCard.tsx`. אם `ProgressBadge` משמש רק את `ListCard` — להעביר גם אותו. שאר ה-helpers (`MemberDot`, `ProgressBadge`) נשארים ב-page אם הם בשימוש בעוד מקום.
- ה-imports הקיימים (`EmojiIcon`, `Trash2`, `ChevronLeft`) עוברים איתו.
- ה-types ל-props (`ListWithProgress`, `onOpen`, `ticked`, `total`, `onDelete`) מועברים יחד.
- ב-[app/lists/page.tsx](app/lists/page.tsx) — `import { ListCard } from '@/components/ListCard'`.
- אין שינוי התנהגותי. אין שינוי styling. אין שינוי במודאל. רק העברת קובץ.

**Files likely touched:**
- `components/ListCard.tsx` (חדש) — הקומפוננטה המוצאת, ~130 שורות.
- `components/__tests__/ListCard.test.tsx` (חדש) — baseline tests.
- [app/lists/page.tsx](app/lists/page.tsx) — מחיקת `ListCard` מקומי + import חדש. ~−130 / +1 שורות.

**Test strategy (Vitest + React Testing Library):**
- `render(<ListCard list={mockList} ticked={3} total={10} onOpen={fn} onDelete={fn} />)`:
  - שם הרשימה מוצג.
  - תווית סוג רשימה (`סופר`/`פארם`/`בית`) מוצגת לפי `list.type`.
  - תאריך מ-`list.created_at` מוצג בפורמט `he-IL`.
  - אם `total === 0` — אין progress bar.
  - אם `total > 0 && ticked > 0` — progress bar עם `width: ${pct}%`.
- אינטראקציות:
  - קליק על הקרטיס (בלי תזוזה) → `onOpen` נקרא פעם אחת.
  - סימולציית סוויפ עם `fireEvent.touchStart/Move/End` (delta > 60px) → קרטיס נשאר חשוף; קליק על האזור האדום → `onDelete` נקרא.
  - סוויפ קצר (delta < 60px) → קרטיס חוזר ל-0; `onDelete` לא נקרא.

**הערה על מגבלות jsdom:** `fireEvent.touchStart` עובד אבל לא מדמה inertia/momentum. הטסטים מתמקדים בלוגיקת ה-state machine (האם `setSwipeX` נקרא עם הערכים הצפויים, האם `onDelete` נקרא בזמן הנכון) — לא בתחושה החזותית עצמה.

**Depends on:** אין.

**Done when:**
- [ ] `components/ListCard.tsx` קיים, מקומפל ב-`tsc --noEmit`.
- [ ] [app/lists/page.tsx](app/lists/page.tsx) מייבא מהקובץ החדש; אין `function ListCard` בקובץ זה.
- [ ] טסטים חדשים נכתבים ועוברים (לפחות 6 it blocks לפי הרשימה למעלה).
- [ ] `npm run dev` עולה, מסך `/lists` נראה זהה לקודם (smoke ויזואלי).
- [ ] ה-PR לא משנה את `setSwipeX`, `handleTouchStart/Move/End`, או כל קוד אחר ב-`ListCard` — רק העברה.

**Estimated size:** ~150 LOC (כולל טסטים).

---

### T2 — Press feedback (`isPressed` state + visual)

**Goal:** הוספת מצב press ויזואלי לקרטיס לפי [design.md](specs/features/05-list-card-tactility/design.md) (סעיף "Press feedback"). המשתמש "מרגיש" שלחץ — scale `0.965`, רקע מעמעם, 120ms.

**Approach:**
- הוספת `const [isPressed, setIsPressed] = useState(false)`.
- ב-`handleTouchStart`: `setIsPressed(true)`.
- ב-`handleTouchMove`: ברגע ש-`Math.abs(diff) > 5` → `setIsPressed(false)` (יחד עם `isDragging.current = true`).
- ב-`handleTouchEnd`: `setIsPressed(false)`.
- ב-`style` של ה-`<button>`: להוסיף conditional `transform: isPressed ? 'scale(0.965)' : '...existing translateX...'`. ⚠️ קונפליקט: היום ה-`transform` הוא `translateX(${swipeX}px)`. צריך לאחד: `transform: \`translateX(${swipeX}px) ${isPressed && !isDragging.current ? 'scale(0.965)' : ''}\``.
- background: `className` עם `bg-surface` נשאר, ב-`style` להוסיף `backgroundColor: isPressed ? 'rgba(28,27,23,0.06)' : undefined` (זה הערך של `bg-ink-06`).
- transition: להוסיף ל-`transition` הקיים את `, background-color 120ms ease-out`.

**Files likely touched:**
- [components/ListCard.tsx](components/ListCard.tsx) — קוד.
- [components/__tests__/ListCard.test.tsx](components/__tests__/ListCard.test.tsx) — טסטים חדשים.

**Test strategy:**
- `fireEvent.touchStart` → ה-`<button>` מקבל `transform` שכולל `scale(0.965)` ו-`backgroundColor` שווה ל-rgba הצפוי.
- `fireEvent.touchEnd` → ה-`<button>` חוזר ל-`transform` בלי scale ו-`backgroundColor` undefined.
- `fireEvent.touchStart` ואז `touchMove` עם diff > 5 → ה-`<button>` כבר לא במצב pressed (אין scale).
- קליק רגיל (`fireEvent.click` או touchStart→End ללא move) → `onOpen` נקרא ו-`isPressed` חזר ל-false.

**Depends on:** T1.

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים. הטסטים מ-T1 ממשיכים לעבור.
- [ ] לחיצה והחזקה על הקרטיס במסך אמיתי (Chrome devtools mobile mode או iPhone אמיתי) מציגה ויזואלית את ה-scale + העמעום.
- [ ] התחלת סוויפ (תזוזה > 5px) לא משאירה את הקרטיס במצב pressed — חוזר ל-scale 1 מיד.
- [ ] `npm run dev` עולה בלי warnings חדשים.

**Estimated size:** ~50 LOC.

---

### T3 — Rubber-band + spring on release + `startX` bug fix

**Goal:** הסוויפ עצמו מרגיש "חי". מעבר ל-120px יש התנגדות (rubber-band). על שחרור — spring קפיצי במקום easing שטוח. וגם: תיקון הבאג שמתבטא במשיכה חוזרת ממצב פתוח.

**Approach:**

1. **Rubber-band ב-`handleTouchMove`:**
   - להחליף את [page.tsx:74-78](app/lists/page.tsx#L74-L78):
     ```
     if (isDragging.current) {
       const newX = swipeX === 120 ? 120 + diff : diff;
       setSwipeX(Math.max(0, Math.min(newX, 120)));
     }
     ```
   - בלוגיקה חדשה: אם המיקום החדש < 120 → 1:1. אם > 120 → `120 + (overflow * 0.3)`, מקסימום 180.

2. **Spring על שחרור:**
   - להחליף את ה-`transition` ב-[page.tsx:140](app/lists/page.tsx#L140):
     - היום: `transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)`.
     - חדש: `transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot מתון).
   - ה-`transition` ל-background מ-T2 נשאר.

3. **תיקון `startX` במשיכה חוזרת:**
   - היום: ב-`handleTouchStart` נרשם `startX = e.touches[0].clientX`. בשורה 76 מבוצע hack: `swipeX === 120 ? 120 + diff : diff` — אבל הזה לא מטפל ב-rubber-band או במצבי ביניים.
   - תיקון: ב-`handleTouchStart` לשמור `startSwipeX.current = swipeX`. ב-`handleTouchMove` המתמטיקה הופכת ל-`newX = startSwipeX.current + diff` (ואז rubber-band על הערך הזה). זה מטפל בכל מצב התחלה בלי קפיצה.

**Files likely touched:**
- [components/ListCard.tsx](components/ListCard.tsx) — שלוש פונקציות handler + style + ref חדש.
- [components/__tests__/ListCard.test.tsx](components/__tests__/ListCard.test.tsx) — טסטים חדשים.

**Test strategy:**
- Rubber-band: simulate touchStart ב-x=0, touchMove ל-x=150 (diff=150). expected swipeX = 120 + (150-120)*0.3 = 129. assert על style.transform.
- Rubber-band cap: simulate diff=300. expected swipeX = 180 (clamped). assert.
- Spring: assert ש-style.transition כולל `cubic-bezier(0.34, 1.56, 0.64, 1)` כשלא ב-drag.
- Bug fix: simulate סוויפ פתוח ל-120, touchEnd, ואז סוויפ חדש (touchStart ב-x=200, touchMove ל-x=210, diff=10). expected swipeX = 120+10=130 (לא 10, ולא קופץ ל-200+10). assert.

**Depends on:** T1, T2.

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים. כל הטסטים הקודמים ממשיכים לעבור.
- [ ] במסך אמיתי: סוויפ אגרסיבי מעבר ל-120px מרגיש "כבד יותר" (rubber-band). שחרור — הקרטיס "קופץ" קלות לפני שמתייצב.
- [ ] במסך אמיתי: פותחים קרטיס, נוגעים שוב ומתחילים סוויפ נוסף — אין קפיצה.
- [ ] אין regression — קליק רגיל עדיין פותח, טאפ על קרטיס חשוף עדיין סוגר.

**Estimated size:** ~80 LOC.

---

### T4 — Swipe-to-commit + threshold color signal

**Goal:** סוויפ ארוך מעבר ל-70% מרוחב הקרטיס + שחרור = `onDelete` ישיר (פותח את המודאל). חיווי ויזואלי לפני השחרור: צבע הרקע האדום מעמיק.

**Approach:**

1. **מדידת רוחב הקרטיס:**
   - להוסיף `const cardRef = useRef<HTMLDivElement>(null)` על ה-`<div>` החיצוני (העטוף שכבר קיים).
   - ב-`handleTouchEnd` (וגם ב-`handleTouchMove` עבור צבע הסף): `const cardWidth = cardRef.current?.offsetWidth ?? 280`. `const commitThreshold = cardWidth * 0.7`.

2. **חישוב חדש ב-`handleTouchEnd`:**
   - היום: `if (shouldOpen) setSwipeX(120); else setSwipeX(0);`.
   - חדש:
     ```
     if (swipeX >= commitThreshold) {
       onDelete();   // המודאל קופץ — הקרטיס נשאר במקומו עד שהמודאל יחליט
       return;
     }
     // אחרת — לוגיקת ה-snap הקיימת (60px / velocity > 0.5)
     ```
   - בקריאת `onDelete` אנחנו לא מאפסים את `swipeX` — המודאל הקיים מנהל את ה-state של הרשימה (מחיקה → ה-card יורד מה-DOM; ביטול → ה-card נשאר במצב חשוף; משתמש סוגר ידנית בטאפ).
   - **הערה**: אם המשתמש מבטל את המודאל ורוצה לסגור, צריך לוודא ש-`setSwipeX(0)` קורה. בדיקה ב-flow ידנית — ייתכן ושצריך לאפס בכל מקרה אחרי `onDelete()` נקרא (תלוי איך המודאל מסתיים). ראה Risks.

3. **חיווי צבע סף:**
   - היום: [page.tsx:124](app/lists/page.tsx#L124) — `className="absolute inset-y-0 left-0 flex items-center justify-center bg-red-500 transition-opacity"`.
   - חדש: לחשב `pastCommit = swipeX >= commitThreshold` ב-render. `className="... transition-all"` (כלל את ה-background-color).
   - background: dynamic — `style={{ width, opacity, pointerEvents, backgroundColor: pastCommit ? '#dc2626' /* red-600 */ : '#ef4444' /* red-500 */ }}`. (משתמשים ב-hex כי כבר היום הקובץ משלב className + inline style.)
   - הסיבה ל-hex inline ולא ל-Tailwind `bg-red-600` דינמי: סטטי יותר נקי. Tailwind dynamic classes (`bg-red-${variant}`) נשברים ב-JIT.

**Files likely touched:**
- [components/ListCard.tsx](components/ListCard.tsx) — `cardRef`, threshold calc, handler change, dynamic background.
- [components/__tests__/ListCard.test.tsx](components/__tests__/ListCard.test.tsx) — טסטים חדשים.

**Test strategy:**
- Mock `Element.prototype.offsetWidth` כך שיחזיר 300 → commitThreshold = 210.
- Touch sequence: touchStart ב-x=0, touchMove ל-x=250 (delta past threshold), touchEnd. assert: `onDelete` נקרא פעם אחת.
- Touch sequence: touchStart ב-x=0, touchMove ל-x=180 (delta under threshold), touchEnd. assert: `onDelete` לא נקרא. `setSwipeX(120)` נקרא (snap לחשיפה).
- Touch sequence: touchStart, touchMove ל-x=220 (past threshold, לפני שחרור), אז fragmented: assert ש-style.backgroundColor של האזור האדום הוא `#dc2626`. ל-x=180 — `#ef4444`.

**Depends on:** T1, T2, T3.

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים. כל הקודמים ממשיכים לעבור.
- [ ] במסך אמיתי: סוויפ עד הסוף + שחרור = המודאל קופץ מיד, בלי טאפ נוסף.
- [ ] במסך אמיתי: שחרור לפני הסף = הקרטיס נשאר חשוף; כפתור אדום עדיין עובד בטאפ (regression-safe).
- [ ] במסך אמיתי: כשעוברים את הסף (לפני שחרור) — האדום מעמיק.
- [ ] ביטול המודאל אחרי full-swipe לא משאיר את הקרטיס "תקוע" — נסגר באופן צפוי.

**Estimated size:** ~80 LOC.

---

## Build Order

```
T1 (extract + baseline tests) → T2 (press) → T3 (rubber-band + spring + bug) → T4 (swipe-to-commit + threshold color)
```

- **T1 חייב להיות ראשון** — בלעדיו אין רשת ביטחון ל-T2/T3/T4 (וקובץ של 130 שורות עם state ידני זה הרבה משטחי קצה לשבור).
- **T2 → T3 → T4** סדר טבעי של עלייה במורכבות. כל אחד מוסיף שכבת תחושה ועומד בפני עצמו.
- אפשר למרג' כל PR בנפרד. אחרי T2 כבר יש שיפור מורגש (press feedback). אחרי T3 — סוויפ מרגיש "חי". אחרי T4 — הזרם השלם.

---

## Risks

### Medium

1. **`fireEvent.touchStart` ב-jsdom לא תמיד עקבי** — חלק מהמימושים של React Touch Events דורשים שהאירוע יכלול `touches: [{clientX, clientY}]`. הדפוס: `fireEvent.touchStart(element, { touches: [{ clientX: 0, clientY: 0 }] })`. **Mitigation**: ב-T1, אחרי שכותבים את ה-touch tests, אם הם לא עוברים — לבדוק את ה-event shape. דוגמה מתועדת ב-React Testing Library issues.

2. **Modal cancellation flow ב-T4** — המודאל הקיים מנוהל מ-`ListsPage` (לא מ-`ListCard`). אחרי full-swipe-commit, אם המשתמש מבטל את המודאל, הקרטיס נשאר במיקום הסוויפ. צריך לוודא ש-state ה-`swipeX` מתאפס. **Mitigation**: ב-T4 — לבחון אם להעביר `onDelete` שמחזיר Promise<boolean> (true=נמחק, false=בוטל), ובהתאם להחליט אם לאפס את `swipeX`. אם זה דורש שינוי באב — לתעד ולשאול את ה-PM (אותך) לפני ה-PR.

### Low

3. **חישוב רוחב על mount ראשון** — `cardRef.current?.offsetWidth` ב-`handleTouchEnd` עובד כי ה-touch handler רץ אחרי mount. אבל אם ה-Card נוצר ומיד מקבל touch (server-side render hydration race), `cardRef.current` עשוי להיות `null` — ה-fallback (`?? 280`) מטפל בזה. **Mitigation**: ה-fallback קיים, אבל לשים `data-testid="list-card-root"` כדי שטסטים יוכלו למקם את ה-ref ולקבוע offsetWidth דרך Object.defineProperty.

4. **Tailwind JIT עם hex inline** — בחרנו hex inline ב-T4 במכוון, כי `bg-red-${dynamic}` לא נסרק על ידי Tailwind. **Mitigation**: לא להציע safelist; פשוט להישאר על inline. בעתיד אם זה משעמם, אפשר להוסיף `red-deep` token.

5. **Spring CSS וחתימת `cubic-bezier` חורגת מ-1** — `cubic-bezier(0.34, 1.56, 0.64, 1)` תקין ב-CSS לכל הדפדפנים מאז 2017. אין צורך ב-fallback.

---

## Out of scope reminders

מהוצא ב-brief — אל תוסיף את אלה:
- אנימציית כניסה/יציאה של הקרטיס מהרשימה לאחר מחיקה.
- שינוי לדפוס press בקומפוננטות אחרות (`.btn-*` נשארים כפי שהם).
- הוספת `navigator.vibrate` או הפטיק כלשהו.
- שינוי לכיוון הסוויפ או למיקום אזור המחיקה.
- הוספת ספריית גסטרים (`framer-motion`, `@use-gesture/react`).
- שינוי במודאל confirm-before-delete.
- הוספה/החלפה של design tokens (כולל `red-deep` או `easing-spring`) — נשאר inline בקבצים שמשתמשים בהם בלבד.
- שינוי ב-hook הלא-משומש [hooks/useSwipe.ts](hooks/useSwipe.ts).
