# Design: List Card Tactility

## Screens Affected

- **`/lists`** (Lists overview): `ListCard` ב-[app/lists/page.tsx:51-179](app/lists/page.tsx#L51-L179) מקבל מצב press ויזואלי + שכבת מחווה מעודכנת (rubber-band, spring, swipe-to-commit, חיווי סף).
- אין שינוי במסכים אחרים. אין שינוי בעמוד הרשימה הפנימית `/lists/[listId]`.

## Components

- **New:** אין קומפוננטות חדשות.
- **Reused:** [DeleteListModal](app/lists/page.tsx) (המודאל הקיים שמופעל דרך `onDelete`); design tokens קיימים מ-[tailwind.config.ts](tailwind.config.ts) ו-[app/globals.css](app/globals.css).
- **Modified:** `ListCard` ב-[app/lists/page.tsx:51-179](app/lists/page.tsx#L51-L179):
  - מוסיף state פנימי `isPressed` (boolean), נפרד מ-`isDragging`.
  - לוגיקת `handleTouchMove` משתנה: rubber-band במקום `Math.min(newX, 120)`; reset של `startX` כשמתחילים סוויפ ממצב פתוח.
  - לוגיקת `handleTouchEnd` משתנה: חישוב סף קומיט יחסי לרוחב הקרטיס (`commitThreshold = cardWidth * 0.7`); מעבר לסף קורא ל-`onDelete` במקום `setSwipeX(120)`.
  - inline styles מקבלים את ה-spring החדש על שחרור.
  - הרקע האדום משתנה דינמית: `bg-red-500` מתחת לסף, `bg-red-600` מעליו.

## User Flow

### A. לחיצה רגילה (לפתיחת רשימה)
1. משתמש שם את האצבע על קרטיס.
2. תוך 16ms (פריים אחד) — הקרטיס מצטמצם ל-`scale(0.965)` והרקע משתנה ל-`bg-ink-06`.
3. משתמש מרים אצבע בלי לזוז (תזוזה ≤ 5px).
4. הקרטיס חוזר ל-`scale(1)` ול-`bg-surface` תוך 120ms.
5. `onOpen()` נקרא — ניווט ל-`/lists/[id]`.

### B. סוויפ חלקי (חשיפת מחיקה — דפוס קיים, עם פוליש)
1. משתמש שם את האצבע על קרטיס.
2. תוך 16ms — מצב press מופיע (scale 0.965 + bg-ink-06).
3. ברגע שהתזוזה > 5px ימינה — `isPressed` נקבע ל-`false`, `isDragging` ל-`true`, הקרטיס חוזר ל-scale רגיל ומתחיל לעקוב אחרי האצבע.
4. הקרטיס נע 1:1 עם האצבע עד 120px.
5. מעבר ל-120px — מתחיל rubber-band: כל פיקסל אצבע = 0.3px קרטיס. מקסימום 180px.
6. הרקע האדום מתגלה משמאל, רוחבו = `swipeX`.
7. אם `swipeX < commitThreshold` כשהמשתמש מרים אצבע:
   - `swipeX >= 60` → snap ל-120px (חשוף) עם spring `cubic-bezier(0.34, 1.56, 0.64, 1)` ב-250ms.
   - `swipeX < 60` → snap ל-0 (סגור) עם אותו spring.
8. במצב חשוף: טאפ על הקרטיס סוגר (snap ל-0). טאפ על האזור האדום קורא ל-`onDelete`.

### C. סוויפ מלא לקומיט (חדש)
1. משתמש שם את האצבע על קרטיס.
2. מצב press מופיע, ואז נעלם כשהתזוזה > 5px.
3. הקרטיס עוקב אחרי האצבע — עובר 120px, rubber-band מתחיל.
4. כשעוברים את `commitThreshold` (~70% מרוחב הקרטיס):
   - הרקע האדום מעמיק מ-`bg-red-500` ל-`bg-red-600` תוך 150ms.
   - חיווי ויזואלי שאומר "מעבר לסף — אם תשחרר עכשיו, זה קורה".
5. המשתמש מרים אצבע מעבר לסף → `onDelete()` נקרא מיד. הקרטיס נשאר במקומו (במיקום הסף) עד שהמודאל נסגר/מאושר.
6. המודאל הקיים נפתח. אם המשתמש מאשר — הקרטיס נעלם. אם מבטל — הקרטיס חוזר ל-0 עם spring.

### D. סוויפ חוזר ממצב פתוח (תיקון באג)
1. הקרטיס חשוף (`swipeX === 120`).
2. משתמש שם אצבע על הקרטיס ומתחיל סוויפ. תיקון: `startX` נרשם ביחס למיקום הנוכחי, לא מיקום האצבע הגולמי. אין קפיצה.
3. סוויפ ימינה → ממשיך מ-120px עם rubber-band.
4. סוויפ שמאלה → סוגר.

## Motion Specs

### Press feedback

| Property | Value |
|---|---|
| `transform` | `scale(1)` → `scale(0.965)` |
| `background` | `bg-surface` → `bg-ink-06` |
| `transition` | `transform 120ms ease-out, background-color 120ms ease-out` |
| Trigger | JS state `isPressed === true` (לא `:active` pseudo-class) |
| מנוטרל מתי | בזמן `isDragging`, ולאחר התחלת drag (`Math.abs(diff) > 5`) |

**הערה:** ה-scale `0.965` מיושר עם הדפוס הקיים ב-[globals.css:47-50](app/globals.css#L47-L50) שמשמש את כל הכפתורים (`.btn-primary:active`, `.btn-accent:active` וכו'). אנחנו לא מציגים scale שונה לקרטיס.

### Drag — rubber-band

| מצב | מתמטיקה |
|---|---|
| `swipeX ∈ [0, 120]` | `swipeX = clamp(diff, 0, 120)` (לא יורד מתחת ל-0) |
| `swipeX > 120` (rubber-band) | `swipeX = 120 + (diff - 120) * 0.3`, עד מקסימום 180 |

### Snap / spring on release

| תוצאה | יעד | משך | easing |
|---|---|---|---|
| Snap ל-0 (סגור) | `translateX(0)` | 250ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Snap ל-120 (חשוף) | `translateX(120px)` | 250ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Commit (מעבר ל-70% רוחב) | נשאר במקומו, `onDelete` נקרא | — | — |

ה-easing מספק overshoot מתון של ~5-7% — מורגש כ"קפיצי" בלי להיראות מוגזם. החלפת ה-`cubic-bezier(0.32, 0.72, 0, 1)` הנוכחי שמרגיש שטוח.

### חיווי סף ויזואלי

| מצב | רקע אזור המחיקה | מעבר |
|---|---|---|
| `swipeX < commitThreshold` | `bg-red-500` | — |
| `swipeX >= commitThreshold` | `bg-red-600` | `background-color 150ms ease-out` |

### חישוב סף הקומיט

```
commitThreshold = cardWidth * 0.7
```

- נמדד בזמן ריצה (`ref.current?.offsetWidth`).
- רספונסיבי — עובד נכון גם ב-viewport קטן יותר.
- במקרה ש-`cardWidth` לא זמין (`null`), fallback ל-280px.

## States

- **Loading**: לא רלוונטי — הפיצ׳ר הוא קוסמטי על קרטיס שכבר קיים. אין loading state חדש.
- **Empty**: לא רלוונטי — אין שינוי במצב הרשימה הריקה.
- **Error**: אם `onDelete` נכשל (מודאל מבטל, או DB error מבפנים), הקרטיס חוזר ל-0 עם spring. אין error UI חדש ב-`ListCard` — שייך למודאל.
- **Success**: לאחר אישור מחיקה במודאל, הקרטיס מוסר מה-DOM (הרשימה נדחפת מחדש דרך הסטייט הקיים). **אנימציית יציאה לא בסקופ הזה** (יצא ב-Out of Scope).

### Press states — visual table

| מצב | scale | bg | shadow |
|---|---|---|---|
| Idle (default) | `1` | `bg-surface` | `shadow-card` |
| Pressed (`isPressed=true`) | `0.965` | `bg-ink-06` | `shadow-card` (ללא שינוי) |
| Dragging | `1` | `bg-surface` | `shadow-card` |

**הערה על shadow:** ה-`shadow-card` הקיים ([tailwind.config.ts](tailwind.config.ts)) הוא `0 1px 0 rgba(28,27,23,0.06), 0 1px 2px rgba(0,0,0,0.03)` — דק מאוד. ניסוי של "drop shadow on press" אינו מורגש ויזואלית. החלטה: לא מורידים shadow במצב press. ה-scale + bg יספיקו.

## RTL / Hebrew Notes

- **Final Hebrew copy**: אין UI copy חדש. כל הטקסט בקרטיס (שם רשימה, תווית קטגוריה, תאריך) נשאר זהה.
- **Mirrored elements**: אין מראות חדשים. כיוון הסוויפ (ימינה) ומיקום אזור המחיקה (משמאל) נשארים כפי שהם — נכון ל-RTL כי בעברית ה-trailing edge הוא שמאל (תואם iOS Mail בעברית).
- **Mixed-direction edge cases**: תאריך עברי (`he-IL` locale) ושם רשימה (שעלול להכיל אנגלית) — כבר עובדים היום. הפיצ׳ר לא משפיע עליהם.

## Design System Impact

- **אין tokens חדשים.** כל הצבעים, רדיוסים, צללים, ו-easings נשענים על קיימים.
- **חריגה מודעת מהדפוס:** הדפוס הקיים של press feedback הוא pure CSS `:active` ב-`.btn-*` ב-[globals.css:47-50](app/globals.css#L47-L50). ב-`ListCard` בחרנו ב-JS state (`isPressed`) במקום `:active`, כי `:active` יופעל גם בתחילת drag ויגרום ל-flicker. **נימוק**: זה לא צריך להפוך לדפוס מערכת — רק `ListCard` מצריך את הניטרול הזה כי רק לו יש סוויפ. שאר הכפתורים נשארים על CSS `:active`.
- **תוספת easing חדשה לפרויקט:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring) — מופיע רק בתוך `ListCard` כ-inline style. **אם** ייקחו אותו לעוד מקומות בעתיד, כדאי להפוך אותו ל-token ב-`tailwind.config.ts` תחת `transitionTimingFunction`. כרגע, לא ב-scope.
- **תוספת easing חדשה לפרויקט:** הפנייה ל-`bg-red-600` ולא ל-token של design system. **דגל**: ה-design system לא הגדיר scale של אדומים — רק `danger: #B14A33` ו-`error: #B14A33` ב-[tailwind.config.ts](tailwind.config.ts). הקרטיס משתמש ב-`bg-red-500` של Tailwind ברירת מחדל ([page.tsx:124](app/lists/page.tsx#L124)) — כלומר כבר היום יש חריגה מהמערכת. ההצעה: לא להחמיר את החריגה — להישאר עם `red-500`/`red-600` של Tailwind, ולסמן בעתיד צורך ב-`danger`/`danger-deep` בטוקנים.

## Open Questions

*(None — closed.)*
