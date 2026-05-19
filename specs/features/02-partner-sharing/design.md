---
status: draft
date: 2026-05-19
brief: specs/features/02-partner-sharing/brief.md
---

# Design: Partner Sharing — Entry Point + Working Invitee Flow

## Screens Affected

- **Dashboard** ([app/lists/page.tsx](app/lists/page.tsx)) — שינוי ה-header למצב "אתה לבד" ולמצב "שניים"; הוספת `InvitePartnerBanner` מתחת ל-header כשמשק הבית מכיל חבר אחד בלבד.
- **יצירת הזמנה** ([app/invite/page.tsx](app/invite/page.tsx)) — שינוי מינורי: החלפת הודעת השגיאה האנגלית `Household not found` בעברית; עדכון הקופי "השותף שלך" → "השותפה שלך".
- **קבלת הזמנה** ([app/invite/[token]/page.tsx](app/invite/[token]/page.tsx)) — תיקון זרם signup כך שה-token שורד את ה-round-trip; עדכון הקופי לפנייה בלשון נקבה למשתמשת שנכנסת.
- **Signup ו-Auth callback** ([app/auth/signup/page.tsx](app/auth/signup/page.tsx), [app/auth/callback/page.tsx](app/auth/callback/page.tsx)) — קליטה ושמירה של ה-`invite_token` לפני magic-link, ו-redirect-back אליו אחרי signup מוצלח.

## Components

### New Components

- **`InvitePartnerBanner`** — כרטיס CTA שמופיע בדאשבורד כשיש רק חבר אחד במשק הבית.
  - Props: `onTap: () => void`
  - תוכן: אייקון `UserPlus` (lucide) ברקע `bg-accent-bg`, כותרת "הזמן את השותפה שלך", תיאור משני "שלחי לה קישור — היא תצטרף אליך בלחיצה" (ראה הערה ב-RTL/Hebrew Notes על מגדר), חץ chevron-left מימין (נקודת הצבעה לפעולה).
  - מיקום: רוחב מלא, מתחת ל-header, מעל רשימת הרשימות. הופך לכאילו "אינטגרלי" עם הכותרת בכך שהוא משתמש באותו `bg-accent-bg` רקוע ב-`rounded-xl`.
  - מתעלם מ-`isEmpty` של הרשימות — הוא מופיע *גם* אם אין רשימות, *גם* אם יש.

- **`MemberDot` (modified)** — קיים ב-[app/lists/page.tsx:21-30](app/lists/page.tsx#L21-L30). נשאר מקבל `emoji` כפי שהוא היום (אין צורך לשנות חתימה).
  - האייקונים: `👨` עבור המשתמש הראשון (male), `👩` עבור השני (female). הם רצים דרך `<EmojiIcon emoji={...} />` ([lib/icon-map.tsx](lib/icon-map.tsx)) שנופל חזרה ל-emoji אם אין מיפוי lucide (וכרגע אין — lucide לא מספק זוג איקונים מובחנים-מגדר). ההבחנה הוויזואלית מובהקת ועקבית עם הסטנדרט בקודבייס.
  - הקוד הנוכחי משתמש ב-emoji ישיר (`<div>{emoji}</div>`) ב-MemberDot — לעבור לעטיפה דרך `EmojiIcon` כדי לקבל את ה-future-proofing (אם lucide יוסיף בעתיד איקונים מגדריים, רק נוסיף ל-`EMOJI_TO_ICON` והם יעברו אוטומטית).

### Reused Components

- **כפתורים**: `btn btn-accent`, `btn btn-soft`, `icon-btn` — קיימים ב-[app/globals.css](app/globals.css).
- **Toast/error block** ב-`/invite` ו-`/invite/[token]` (`bg-danger/10 text-danger`) — נשמר.

### Modified Existing Components

- **Header של [app/lists/page.tsx](app/lists/page.tsx) (שורות 242-260)**:
  - לוגיקה: לבדוק `householdMembers.length`. אם === 1, להציג רק את חבר משק הבית הקיים + `InvitePartnerBanner` מתחת. אם === 2, להציג שני dots + שני שמות.
  - להחליף את `emoji: i === 0 ? '🧑' : '👩'` ב-`iconKey: i === 0 ? 'male' : 'female'`.
  - מערך הצבעים נשאר: `['#C7D8BB', '#F2C9B1', '#E8C4B8', '#D4E5D8']`. בפועל ב-MVP יוצגו רק שני הראשונים.
  - הסדר נקבע על-ידי `users.created_at` עולה — המשתמש הראשון (שיצר את משק הבית) הוא `male`, השנייה (שהצטרפה דרך הזמנה) היא `female`. ראה הערה ב-RTL/Hebrew Notes.
  - כפתור Settings קיים ב-[app/lists/page.tsx:256-258](app/lists/page.tsx#L256-L258) **נשאר no-op בפיצ'ר זה** (לא חוסם, לא הוצא — לא בסקופ).

- **[app/invite/page.tsx](app/invite/page.tsx)**:
  - שגיאת `householdId` ריק: להחליף "⚠️ Household not found" ב-"⚠️ לא הצלחנו לזהות את משק הבית שלך. נסה להתחבר מחדש."
  - הקופי "הזמן את השותף שלך" → "הזמן את השותפה שלך".
  - שאר ה-flow נשאר זהה.

- **[app/invite/[token]/page.tsx](app/invite/[token]/page.tsx)**:
  - אם המשתמשת לא מחוברת, במקום `router.push('/auth/signup')` ישיר — לשמור את ה-token ב-`sessionStorage` (מפתח: `pending_invite_token`), ואז לעבור ל-signup. **המנגנון המדויק (sessionStorage / URL state / cookie) שייך ל-Tech Lead**, כאן רק הסיפור הוויזואלי-זרמי.
  - שום שינוי וויזואלי. הזרם הוא רץ-ברקע: המשתמשת לוחצת על הקישור → מסך טעינה קצר → מסך signup → אימייל magic-link → לחיצה → מסך טעינה קצר → מסך שמה ("הצטרפי לרשימה" קיים) → מצטרפת לדאשבורד.
  - הקופי: "הצטרף לרשימה" → "הצטרפי לרשימה"; "היוו חלק מהרשימה המשותפת" → "ברגע שתאשרי, תופיעי ברשימה המשותפת עם {שם המזמין}." — שם המזמין דורש שאילתת DB נוספת ו-**מחוץ ל-scope** של הפיצ'ר הזה. fallback: "ברגע שתאשרי, תופיעי ברשימה המשותפת."
  - "שם מלא" → "השם שלך". "שם שלך" (placeholder) → "למשל: רעות".
  - "קבל הזמנה" → "הצטרפי".
  - שגיאות (להחליף הודעות גנריות באנגלית):
    - `validation.error` ריק → "הקישור לא תקף או שכבר נוצל."
    - `'This invite has already been used'` → "ההזמנה כבר נוצלה."
    - `'Invite token has expired'` → "פג תוקף ההזמנה. בקשי קישור חדש מהשותף שלך."
    - `'חשבון זה כבר קשור לבית אחר'` נשמר.
  - **הערה לא-ויזואלית** שתעבור ל-Tech Lead: כל הודעות השגיאה הללו צריכות לחזור מהשרת/לוגיקה בעברית; אם `validateInviteToken` ב-`lib/supabase/invites.ts` מחזירה את ה-strings האנגליות כפי שהן עכשיו, הקריאה ב-page צריכה למפות אותן.

### לא-משתנים בפיצ'ר זה

- `/auth/name`, `CreateListSheet`, רשימות בדאשבורד, פריטים — שום שינוי.

## User Flow

### Flow A — המזמין (משתמש קיים, לבד במשק הבית)

```
1. נכנס לדאשבורד (/lists)
2. רואה ב-header: שם שלו + dot עם אייקון "male"
3. מתחת ל-header: InvitePartnerBanner — "הזמן את השותפה שלך"
4. לוחץ על הבאנר → נווט ל-/invite
5. מסך /invite טוען (קצר), לוחץ "צור קישור הזמנה"
6. מקבל URL + כפתור "העתק"
7. מעתיק, פותח WhatsApp ושולח לשותפה
```

### Flow B — שותפה חדשה לחלוטין שמקבלת קישור

```
1. פותחת WhatsApp, לוחצת על הקישור (/invite/<token>) בדפדפן
2. /invite/[token] טוען → מזהה שאין auth →
   שומר את ה-token (sessionStorage או דומה) → redirect ל-/auth/signup
3. ב-/auth/signup: מזינה אימייל, לוחצת "שלח לי קישור"
4. עוברת לאימייל, לוחצת על magic-link
5. נוחתת ב-/auth/callback → Supabase משלים session →
   הקוד בודק אם יש pending_invite_token → אם כן, redirect ל-/invite/<token>
   (במקום ל-/lists כפי שהיום)
6. /invite/[token] טוען שוב, הפעם עם auth → מציג מסך קליטת שם
7. מזינה שם, לוחצת "הצטרפי"
8. consumeInviteToken + createUserProfile רצים → redirect ל-/lists
9. בדאשבורד: שני dots (male + female), שני שמות
```

### Flow C — שותפה שכבר נרשמה במכשיר זה ולוחצת על קישור

```
1. לוחצת על הקישור, /invite/[token] טוען
2. יש auth, אבל אין רשומה ב-public.users → ממשיכים כרגיל (מסך קליטת שם)
   או יש רשומה ושהיא ב-household אחר → שגיאה ("חשבון זה כבר קשור לבית אחר")
   (זה כבר עובד בקוד הקיים)
```

### Flow D — המזמין בודק את הדאשבורד אחרי הצטרפות השותפה

```
1. הוא פותח את האפליקציה (או refresh)
2. useEffect של דאשבורד טוען משק בית → רואה 2 חברים
3. ה-Header מציג: dot-male + dot-female, "שמו ושמה" (e.g. "אילון ורעות")
4. InvitePartnerBanner נעלם (התנאי isOnly===true כבר false)
```

## States

### Loading

- **/invite/[token] בזמן בדיקת token + auth**: "טוען..." במרכז (כמו היום).
- **/invite/[token] בזמן הצטרפות בפועל (`submitting`)**: כפתור "מצטרפת..." disabled (כמו היום).
- **InvitePartnerBanner**: ללא מצב loading משלו — הוא מוצג רק אם household נטען וגודלו === 1.

### Empty

- **דאשבורד שאתה לבד בו ובלי רשימות**: הבאנר מופיע *מעל* ה-empty state הקיים "אין רשימות עדיין", לא מחליף אותו.
- **דאשבורד שאתה לבד בו עם רשימות**: הבאנר מופיע מעל רשימת ה-`ListCard`s.

### Error

- **/invite/[token] עם token שגוי/פג/נצרך**: מסך מלא עם אייקון `bg-danger/10` (קיים), כותרת "שגיאה", הודעה בעברית (לפי הטבלה למעלה), כפתור "חזור לבית" שמנווט ל-`/lists` (קיים).
- **InvitePartnerBanner אם הלחיצה נכשלה לנווט**: לא תרחיש מציאותי (נוויגציה client-side). ללא state נפרד.
- **/auth/callback אם יש pending_invite_token שפג בין-לבין**: redirect ל-`/invite/<token>` שיעבור ל-error state שלו (פג תוקף ההזמנה).

### Success

- **/invite/[token] אחרי הצטרפות**: redirect מיידי ל-`/lists`. הדאשבורד הוא ה-confirmation — שני האייקונים מופיעים.
- **InvitePartnerBanner אחרי שהשותפה הצטרפה**: בטעינת הדאשבורד הבאה — הבאנר נעלם, ה-header עובר מ-1 dot ל-2 dots.

## RTL / Hebrew Notes

### Final Hebrew Copy

| מיקום | קופי |
|---|---|
| InvitePartnerBanner — כותרת | "הזמן את השותפה שלך" |
| InvitePartnerBanner — תיאור | "שלח לה קישור — היא תצטרף אליך בלחיצה" |
| /invite — כותרת (קיימת) | "הזמן את השותפה שלך" (היה "השותף שלך") |
| /invite — תיאור | "שתפו קישור הזמנה כדי להתחיל יחד" (נשאר) |
| /invite — שגיאת household ריק | "לא הצלחנו לזהות את משק הבית שלך. נסה להתחבר מחדש." |
| /invite/[token] — כותרת | "הצטרפי לרשימה" (היה "הצטרף לרשימה") |
| /invite/[token] — תיאור | "ברגע שתאשרי, תופיעי ברשימה המשותפת." |
| /invite/[token] — תווית שדה שם | "השם שלך" (היה "שם מלא") |
| /invite/[token] — placeholder | "למשל: רעות" |
| /invite/[token] — כפתור אישור | "הצטרפי" (היה "קבל הזמנה") |
| /invite/[token] — שגיאה token שגוי | "הקישור לא תקף או שכבר נוצל." |
| /invite/[token] — שגיאה token נצרך | "ההזמנה כבר נוצלה." |
| /invite/[token] — שגיאה token פג | "פג תוקף ההזמנה. בקשי קישור חדש מהשותף שלך." |
| /invite/[token] — שגיאה כבר ב-household | "חשבון זה כבר קשור לבית אחר." (נשאר) |
| /invite/[token] — כפתור חזרה משגיאה | "חזור לבית" (נשאר) |

### החלטות מגדר — חשוב

- ה-MVP מניח **משתמש זכר** (המזמין) ו**שותפה נקבה** (המקבלת). זה מתאים ל-mission.md ("the user and his girlfriend"), והוא מקודד-מערכת ב-MVP.
- הקופי בדאשבורד וב-`/invite` פונה למזמין **בלשון זכר** ("הזמן", "השותפה שלך").
- הקופי ב-`/invite/[token]` פונה לשותפה **בלשון נקבה** ("הצטרפי", "תאשרי").
- אייקון "male" עבור המשתמש הראשון (`created_at` הוותיק); אייקון "female" עבור השנייה.
- **הערה ל-product**: אם בעתיד נרצה לתמוך בזוגות אחרים — צריך לבחור איך לקבוע מגדר (שאלה ב-signup? בחירה ידנית בהגדרות?). כרגע מחוץ ל-scope. כל הקופי שמעורב מתועד למעלה כדי שיהיה קל למצוא ולשנות.

### Mirrored Elements

- **Chevron בבאנר**: ב-RTL, החץ צריך להצביע שמאלה (לעבר ה-CTA). ב-lucide זה `ChevronLeft` ב-RTL = החץ הוויזואלי לכיוון הפעולה. נכון.
- **UserPlus**: סימטרי, לא דורש mirroring.
- **User / User2 (lucide)**: סימטריים.

### Mixed-Direction Edge Cases

- **קישור ההזמנה ב-/invite**: `<code class="ltr">` כבר קיים — נשמר.
- **שמות באנגלית של משתמש** (לדוגמה "Reut"): שדה השם הוא `dir="auto"` כבר. נכון.

### Font

- ללא שינוי. ירש מ-`01-mvp`.

## Layout & Visual Detail

### InvitePartnerBanner — Mockup ASCII

```
┌──────────────────────────────────────────────┐
│ הרשימות שלנו                       [⚙️ אייקון]│
│ • Eilon                                       │
├──────────────────────────────────────────────┤  ← gap-3
│ ┌──────────────────────────────────────────┐ │
│ │ [👥+]   הזמן את השותפה שלך             ‹ │ │  ← bg-accent-bg, rounded-xl, p-4
│ │         שלח לה קישור — היא תצטרף         │ │
│ │         אליך בלחיצה                       │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│                                              │
│  [רשימות / empty state]                     │
└──────────────────────────────────────────────┘
```

### InvitePartnerBanner — מפרט סטיילינג

- `<button>` (לא div) — כל הבאנר לחיץ, accessibility-correct.
- רוחב: `w-full` בתוך padding 6 של הדאשבורד (`px-6`).
- רקע: `bg-accent-bg`.
- פינות: `rounded-xl`.
- padding: `p-4`.
- מבנה: `flex items-center gap-3`.
- שמאל (RTL = ימין): ריבוע `w-12 h-12 rounded-full bg-accent flex items-center justify-center` עם אייקון `UserPlus size={22}` בצבע `text-ink`.
- מרכז: `flex-1 flex flex-col gap-0.5 text-right`. כותרת ב-`text-base font-bold text-ink`, תיאור ב-`text-xs text-ink-70 leading-relaxed`.
- ימין (RTL = שמאל): `ChevronLeft size={18}` ב-`text-ink-70`.
- אינטראקציה: `onPointerDown` → `scale(0.985)`, חזרה ב-`onPointerUp`. תואם לסגנון הקיים של `ListCard`.

### Header במצב "אתה לבד" — לפני ואחרי

```
לפני (מצב נוכחי, באג):
[ 🧑 ]  Eilon
הרשימות שלנו
[⚙️]

אחרי:
[ 👤 ]  Eilon          ← אייקון male בלבד
הרשימות שלנו
[⚙️]
+ באנר מתחת
```

### Header במצב "שניים"

```
[ 👤 ][ 👤 ]  Eilon ו-Reut    ← male + female דוטים, שמות עם ו- מחבר
הרשימות שלנו
[⚙️]
(אין באנר)
```

## Design System Impact

### תוספות חדשות

- אין. ה-Banner משתמש ב-tokens קיימים (`bg-accent-bg`, `bg-accent`, `rounded-xl`, `text-ink`, `text-ink-70`).

### Lucide icons נוספים שיידרשו

- `UserPlus` (חדש בשימוש בבאנר)
- `ChevronLeft` (כבר בשימוש בדאשבורד)

### Emoji בשימוש (דרך `EmojiIcon`)

- `👨` ו-`👩` עבור MemberDot. נופלים חזרה ל-emoji מקורי דרך ה-fallback של `EmojiIcon` (lucide לא מספק זוג איקונים מובחנים-מגדר נכון להיום).

### החלטות שמועברות ל-Tech Lead

1. **Persistence של ה-pending invite token** דרך magic-link round-trip: sessionStorage / cookie / URL param בקריאת ה-Supabase `redirectTo`. בחר את הכי אמין שגם עובד בדפדפנים מסוג in-app browser של WhatsApp.
2. **RLS issue**: ה-policy "users can view household invites" ב-[lib/db/schema.sql](lib/db/schema.sql) משאיר את `validateInviteToken` לא-קריא עבור משתמשת שעברה signup אבל עוד לא ב-`public.users` (כי הצטרפותה ל-household קודמת ליצירת השורה ב-`public.users`). יש שלוש דרכים: (א) להוסיף policy שמאפשרת קריאה לכל authenticated user לפי `token_hash`, (ב) להפוך את `validateInviteToken` ל-Postgres RPC (`security definer`), (ג) להעביר את הולידציה ל-server route handler. אני ממליץ על (ב) כי זה גם פותר את ה-consume.
3. **RLS issue שני**: ה-INSERT policy של `users` הוא `with check (true)` — מתיר לכל authenticated user להכניס שורה לכל household_id, כולל של אחרים. לא חוסם את הפיצ'ר אבל הזדמנות לסגור. דיווח ולא פעולה — מחוץ ל-scope.
4. **מיפוי הודעות שגיאה לעברית**: ב-`lib/supabase/invites.ts` חוזרות strings באנגלית. אופציה: לשנות שם להחזיר קודי שגיאה (`'EXPIRED' | 'CONSUMED' | 'NOT_FOUND'`) ולמפות ב-page. נקי יותר. מחוץ ל-scope של הפיצ'ר אבל ראוי לציון.
5. **בחירת אייקון בן/בת — נסגר**: 👨 ו-👩 דרך `EmojiIcon` (ראה "Emoji בשימוש" למעלה).

## Open Questions

*אין.* כל ה-open items שנותרו (RLS, persistence של ה-token) הם של Tech Lead — תועדו למעלה ב-"החלטות שמועברות ל-Tech Lead".

## Next Phase: Tech Lead

Tech Lead יקבל את ה-design ויפרק לטסקים:
1. Database — האם RLS דורש שינוי? (כן, לפי ההמלצה למעלה.)
2. Auth callback — לוגיקה של pending token + redirect.
3. UI — `InvitePartnerBanner` חדש, Header מעודכן, קופי מעודכן ב-2 עמודי invite.
4. Lib — מיפוי הודעות שגיאה (אופציונלי).
