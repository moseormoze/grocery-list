---
status: pending-approval
date: 2026-05-19
brief: specs/features/02-partner-sharing/brief.md
design: specs/features/02-partner-sharing/design.md
---

# Tasks: Partner Sharing — Entry Point + Working Invitee Flow

## Overview

ארבעה טסקים, אחד מהם ב-DB ושלושה ב-Client. T1 ו-T2 הם המסלול הקריטי שגורם ל-flow לעבוד end-to-end. T3 ו-T4 הם UI/copy וניתן להריץ במקביל.

Stack assumptions (לפי [context/tech-stack.md](context/tech-stack.md) ולפי הקוד הקיים):
- DB: Supabase Postgres עם RLS
- Auth: Supabase magic-link
- Frontend: Next.js App Router + TypeScript + Tailwind
- Tests: Vitest (לפי [lib/db/__tests__/schema.test.ts](lib/db/__tests__/schema.test.ts))

---

## Task List

### T1 — RLS / RPC לולידציה של invite token עבור משתמשת חדשה

**Goal:** לאפשר ל-`validateInviteToken` ול-`consumeInviteToken` לעבוד עבור משתמשת מאומתת שעדיין לא ב-`public.users`. כיום ה-RLS policy `users can view household invites` דורש שה-caller כבר יהיה ב-household, מה שיוצר deadlock לזרם השותפה החדשה.

**Approach:** להפוך את שתי הפונקציות ל-Postgres RPCs עם `security definer` (כלומר הן רצות בהרשאות הבעלים ועוקפות RLS — בטוח כאן כי הולידציה היא לפי `token_hash` שאי-אפשר לנחש).

**Files likely touched:**
- [lib/db/schema.sql](lib/db/schema.sql) — להוסיף שתי פונקציות RPC:
  - `validate_invite_token(p_token_hash text)` → מחזירה (household_id, is_valid, reason)
  - `consume_invite_token(p_token_hash text, p_user_id uuid)` → מבצעת UPDATE על השורה ומחזירה household_id
  - שתיהן `security definer`, owner = `postgres`, מסומנות `revoke execute from anon` ו-`grant execute to authenticated`.
- [lib/supabase/invites.ts](lib/supabase/invites.ts) — לעבור מ-`supabase.from('invite_tokens')` ישיר לקריאת `supabase.rpc('validate_invite_token', { p_token_hash })`. אותו דבר ל-consume.
- [lib/db/__tests__/schema.test.ts](lib/db/__tests__/schema.test.ts) — להרחיב.

**Test strategy (Vitest, integration עם Supabase test instance או mock):**
- שותפה חדשה ש-auth שלה קיים אבל אין לה רשומה ב-`public.users` → `validate_invite_token` מצליחה ומחזירה household_id נכון.
- token שפג תוקף → מחזירה `is_valid=false, reason='EXPIRED'`.
- token שכבר נצרך → מחזירה `is_valid=false, reason='CONSUMED'`.
- token לא קיים → מחזירה `is_valid=false, reason='NOT_FOUND'`.
- `consume_invite_token` עם token תקף + user_id → מעדכנת `consumed_by_user_id`, ומונעת consume שני (atomic).
- `revoke from anon` — קריאה לא-מאומתת נכשלת.

**Depends on:** אין (מבוצע ב-DB ובספרייה).

**Done when:**
- [ ] טסטים חדשים נכתבים, רצים, ועוברים.
- [ ] שתי RPC ב-schema.sql, עם הרשאות נכונות.
- [ ] `lib/supabase/invites.ts` משתמשת ב-RPC במקום בגישה ישירה לטבלה. הודעות שגיאה ממופות ל-`reason` קודים אבל הפונקציה ב-TS ממשיכה להחזיר את אותו interface (`{success, error}`) כדי לא לשבור callers.
- [ ] קריאה ל-`createInviteToken` ממשיכה לעבוד דרך גישה ישירה (לא דורש RPC — המזמין כבר ב-household, RLS עובד).
- [ ] Smoke manual: בלי שינוי UI, לעלות עם משתמשת חדשה ב-Supabase, להריץ `validate_invite_token` דרך Supabase SQL Editor → מקבל תוצאה.

**Estimated size:** ~120-150 LOC (SQL + TS + tests).

---

### T2 — שמירת invite token מעבר ל-magic-link round-trip

**Goal:** לתקן את הזרם של "שותפה חדשה לוחצת על קישור הזמנה ועוברת ל-signup". כיום ה-token אובד; אחרי signup היא נוחתת ב-`/lists` במקום ב-`/invite/<token>`. נשמור את ה-token לפני המעבר ל-signup, ונאחזר אותו ב-callback.

**Approach:**
- **Persistence**: `sessionStorage` עם מפתח `pending_invite_token`. בחירה זו ולא cookie/URL כי: (א) פשוט יותר, (ב) ה-magic-link מהאימייל נפתח באותו browser שבו לחצו על הקישור המקורי (זו ההנחה הסבירה לזרם WhatsApp → click → email-app → click). אם בדפדפן in-app של WhatsApp ה-session storage נמחק בין לבין — חוזרים לפלן (ג) URL state ב-`emailRedirectTo`. ראה Risks.

**Files likely touched:**
- `lib/auth/pendingInvite.ts` (חדש) — שני helpers: `savePendingInvite(token)`, `consumePendingInvite()` (קוראת + מנקה).
- [app/invite/[token]/page.tsx](app/invite/[token]/page.tsx) — לפני `router.push('/auth/signup')` בשורה 27, קריאה ל-`savePendingInvite(token)`.
- [app/auth/callback/page.tsx](app/auth/callback/page.tsx) — אחרי `getUser()` ולפני הבדיקה אם יש profile, לבדוק `consumePendingInvite()`. אם יש token → `router.push(`/invite/${token}`)`.
- בדיקה: גם משתמש שכבר יש לו profile (returning user שלוחץ על קישור הזמנה אחרי שכבר חידש magic-link) צריך להגיע ל-`/invite/<token>` ולא ל-`/lists`. הסדר: `pending_invite_token` קודם, ואז `userProfile`, ואז fallback ל-`/lists`.

**Test strategy:**
- Unit (Vitest): `savePendingInvite('abc')` → `consumePendingInvite()` מחזיר 'abc' ומנקה את ה-storage; קריאה שנייה מחזירה null.
- Integration (Component test על [app/auth/callback/page.tsx](app/auth/callback/page.tsx)):
  - Mock `getUser` להחזיר משתמש, mock `sessionStorage` עם `pending_invite_token=abc123`. → צריך לקרוא ל-`router.push('/invite/abc123')`.
  - אותו setup בלי pending token, בלי profile → `/auth/name`.
  - אותו setup בלי pending token, עם profile → `/lists`.

**Depends on:** אין (לא תלוי ב-T1). אבל ה-end-to-end עובד רק כשגם T1 וגם T2 מוטמעים.

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים.
- [ ] `lib/auth/pendingInvite.ts` נוצר עם API מתועד.
- [ ] [app/invite/[token]/page.tsx](app/invite/[token]/page.tsx) שומר את ה-token לפני redirect ל-signup.
- [ ] [app/auth/callback/page.tsx](app/auth/callback/page.tsx) מנתב לפי הסדר: pending invite → name (אם אין profile) → lists.
- [ ] Manual E2E: בדפדפן רגיל, פותחים `/invite/<token>` כשמתחילים בלי auth → מבצעים signup מלא → נוחתים ב-`/invite/<token>` ולא ב-`/lists`. מזינים שם → רואים את הדאשבורד עם שני dots.

**Estimated size:** ~80 LOC.

---

### T3 — דאשבורד: InvitePartnerBanner + MemberDot עם אייקון בן/בת

**Goal:** ליישם את שינויי ה-UI בדאשבורד לפי [design.md](specs/features/02-partner-sharing/design.md): באנר "הזמן את השותפה שלך" כשמשק הבית מכיל חבר אחד, ו-MemberDot עם 👨/👩 דרך `EmojiIcon` עבור מצב שני חברים.

**Files likely touched:**
- `components/InvitePartnerBanner.tsx` (חדש) — לפי המפרט בעיצוב: `bg-accent-bg rounded-xl p-4`, אייקון `UserPlus`, כותרת "הזמן את השותפה שלך", תיאור משני, `ChevronLeft`. prop יחיד: `onTap`.
- [app/lists/page.tsx](app/lists/page.tsx):
  - לעדכן `MemberDot` ([שורות 21-30](app/lists/page.tsx#L21-L30)) לעבור מ-`<div>{emoji}</div>` ל-`<EmojiIcon emoji={emoji} />`.
  - לעדכן את ההקצאה ([שורות 159-164](app/lists/page.tsx#L159-L164)): `emoji: i === 0 ? '🧑' : '👩'` → `emoji: i === 0 ? '👨' : '👩'`.
  - להוסיף `.order('created_at', { ascending: true })` ל-query של [שורות 154-157](app/lists/page.tsx#L154-L157) כדי שסדר ה-dots יהיה דטרמיניסטי (אחרת ה-male/female ייתכן ויחליפו לסירוגין בין refreshes).
  - אחרי ה-header (אחרי [שורה 260](app/lists/page.tsx#L260)), בלוק חדש: `{householdMembers.length === 1 && <InvitePartnerBanner onTap={() => router.push('/invite')} />}` — עטוף ב-`px-6 pb-3` כדי שיהיה מיושר עם ה-header.

**Test strategy:**
- Unit (Vitest + React Testing Library):
  - `InvitePartnerBanner` עם prop `onTap` — מקליק → קורא ל-onTap; כותרת מכילה את הטקסט הצפוי.
  - דאשבורד: render עם household.length===1 → באנר נראה, ה-dot היחיד עם emoji `'👨'`.
  - render עם household.length===2 → באנר לא נראה, שני dots עם `'👨'` ו-`'👩'` לפי הסדר.
- Manual visual: לבדוק ב-mobile viewport 375px ש-banner לא חורג ב-RTL וה-chevron מצביע לכיוון הנכון.

**Depends on:** אין (יכול לרוץ במקביל ל-T1/T2/T4).

**Done when:**
- [ ] טסטים חדשים נכתבים ועוברים.
- [ ] `InvitePartnerBanner` קיים ועושה רק את מה שאמור.
- [ ] ה-query של householdUsersData מסודרת לפי `created_at`.
- [ ] ה-dot של המשתמש הראשון מציג 👨 (לא 🧑); השני 👩.
- [ ] בדאשבורד עם חבר אחד הבאנר נראה; עם שניים — לא.
- [ ] Manual check: ב-RTL 375px ה-layout נקי, chevron בכיוון של הפעולה.

**Estimated size:** ~80-100 LOC.

---

### T4 — Hebrew copy + cleanup ב-/invite ו-/invite/[token]

**Goal:** ליישם את כל החלפות הקופי לפי הטבלה ב-[design.md](specs/features/02-partner-sharing/design.md) (סעיף RTL/Hebrew Notes), להחליף הודעת השגיאה האנגלית הגנרית של "Household not found" בעברית, ולהסיר את ההערה המטעה ב-`lib/supabase/invites.ts:120`.

**Files likely touched:**
- [app/invite/page.tsx](app/invite/page.tsx):
  - שורה 80: "Household not found" → "לא הצלחנו לזהות את משק הבית שלך. נסה להתחבר מחדש."
  - שורה 91: "הזמן את השותף שלך" → "הזמן את השותפה שלך".
- [app/invite/[token]/page.tsx](app/invite/[token]/page.tsx):
  - שורה 137: "הצטרף לרשימה" → "הצטרפי לרשימה".
  - שורה 138: "היוו חלק מהרשימה המשותפת" → "ברגע שתאשרי, תופיעי ברשימה המשותפת."
  - שורה 143: "שם מלא" → "השם שלך".
  - שורה 148 (placeholder): "שם שלך" → "למשל: רעות".
  - שורה 166: "מצטרף..." / "קבל הזמנה" → "מצטרפת..." / "הצטרפי".
  - מיפוי הודעות שגיאה: אם error מ-`validateInviteToken` הוא אנגלית (`'This invite has already been used'`, `'Invite token has expired'`, `'Invite token not found'`) — לעטוף בהמרה לעברית לפני הצגה. עדיף לעשות זאת ב-page (לא ב-lib) כי lib עדיין מחזירה strings אנגלית — מחוץ ל-scope לשכתב.
- [lib/supabase/invites.ts](lib/supabase/invites.ts):
  - להסיר את ההערה המטעה בשורה 120 ("`In a real app, you'd update user's household_id`"). יש מקום להחליפה בהערה חד-שורתית אם משהו לא ברור.

**Test strategy:**
- Component tests (Vitest + RTL): רנדור של כל מצב (success, error קוד שונה) ובדיקת ה-strings העבריות.
- Manual: לעבור על שלושת מסכי השגיאה (פג תוקף, נצרך, כבר במשק בית אחר) ולוודא קופי תקין.

**Depends on:** אין. (יכול לרוץ במקביל ל-T1/T2/T3.)

**Done when:**
- [ ] כל ה-strings האנגלית הגלויות למשתמש (לפי הטבלה ב-design) הוחלפו.
- [ ] שום עיגון לטקסטים חדשים באנגלית בקובץ JSX (grep verification).
- [ ] טסטים פר state של `/invite/[token]` מוודאים את הקופי הסופי.
- [ ] ההערה המיושנת ב-[lib/supabase/invites.ts:120](lib/supabase/invites.ts#L120) הוסרה.

**Estimated size:** ~60 LOC.

---

## Build Order

```
T1 (DB/RPC) ─┐
T2 (auth flow) ─┤─► End-to-end working
T3 (UI banner + icons) ─ (parallel)
T4 (copy + cleanup) ─ (parallel)
```

- **T1 + T2** הם המסלול הקריטי. בלעדיהם — לחיצה על קישור הזמנה ע"י משתמשת חדשה לא יוצאת לפועל. שניהם דורש לפני שאפשר באמת לבצע end-to-end manual test.
- **T3** הוא מה שהמשתמש (אתה) בעיקר יחווה — הבאנר הוא ה-entry point הראשון.
- **T4** UI cleanup — לא חוסם אבל משלים את החוויה.

מומלץ: T1 → T2 → T3 → T4. או, אם רוצים feedback ויזואלי מהר, אפשר להתחיל ב-T3 (העבודה היחידה שלא משפיעה על השגיאות הקיימות).

---

## Risks

### High

1. **WhatsApp in-app browser ו-sessionStorage** — אם השותפה לוחצת על הקישור מתוך WhatsApp, ייתכן שה-link ייפתח ב-in-app webview, ואחר כך magic-link מהאימייל ייפתח בדפדפן ראשי שונה. במקרה כזה `sessionStorage` לא נשמר בין השניים. **Mitigation**: לתעד ב-T2 שאם זה קורה אפילו פעם אחת, להוסיף fallback של URL state (`/auth/signup?invite=<token>` שמועבר דרך `emailRedirectTo` כ-`/auth/callback?invite=<token>`). לא לסבך את ה-MVP מראש — לחכות לבדיקה ידנית.
2. **Supabase `emailRedirectTo` allowlist** — Supabase מחייב לרשום את כל ה-URLs המותרים ב-redirect. אם תהיה הוספת URL state ב-T2 fallback, יידרש לעדכן את ה-Supabase project settings. **Mitigation**: לוודא שב-Supabase כבר מוגדר `/auth/callback` ולתעד אם נוסיף query params.

### Medium

3. **RLS policy migration על production DB** — הוספת RPCs ושינוי הרשאות דורש מיגרציה מסודרת. **Mitigation**: ה-SQL ב-schema.sql הוא `create or replace` / `create if not exists`, אז re-running בטוח. אבל יש לוודא שהאפליקציה ב-production לא נופלת לרגע בין ה-deploy של ה-SQL לבין ה-deploy של ה-TS.
4. **בדיקות קיימות ב-`lib/db/__tests__/schema.test.ts`** — אם הן בודקות SELECT ישיר על invite_tokens, ה-RPCs לא משנות את ההתנהגות שלהן (RLS ה-policy לא נשבר, רק נוספת דרך-עוקפת). **Mitigation**: לקרוא את הטסטים הקיימים לפני T1 ולוודא שהם עדיין עוברים.

### Low

5. **בחירת `created_at` כסדר MemberDots** — אם יום אחד נוסיף יכולת "להחליף את המגדר של משתמש" או של משתמש שני שמצטרף לפני המזמין (לא תרחיש ב-MVP), הסדר הזה ישבר. **Mitigation**: זה לא קורה ב-MVP; נדחה לעתיד עם feature flag.
6. **RTL של ה-chevron בבאנר** — `ChevronLeft` תחת `dir="rtl"` של ה-`<html>` עלול להראות הפוך ממה שמצופה. **Mitigation**: לבדוק ידנית בדפדפן ולהחליף ל-`ChevronRight` אם נדרש.

---

## Out of scope reminders

מהוצא ב-brief — אל תוסיף את אלה:
- שם המזמין בעמוד הנחיתה.
- מסך Settings מלא.
- כפתור שיתוף ברמת רשימה ספציפית.
- תמיכה ביותר משני משתמשים.
- בחירה ידנית של מגדר.
- מיפוי שגיאות סדרתי ב-lib (השארה כפי שהוא — מיפוי בפועל ב-page).
