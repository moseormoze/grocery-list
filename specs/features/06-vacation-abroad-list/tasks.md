# Tasks: רשימת חופשה בחו״ל מוכנה מראש

## Task List

### T1 — סוג רשימה, תבנית ו-UI מקצה לקצה

**Goal:** להוסיף את `vacation_abroad` כסוג רשימה מלא: schema, יצירה טרנזקציונית עם 46 פריטים, שבע קטגוריות, תצוגה ושפת אריזה. זו משימה אנכית אחת כדי שה-DB וה-UI לא יגיעו לענפים נפרדים שאינם שמישים לבדם.

**Approach:**

1. להגדיר מקור אמת משותף ל-`ListType` ולמטא-דאטה של ארבעת הסוגים, ולהחליף את שלושת ה-`Record`-ים הכפולים במסכים וב-`ListCard`.
2. להרחיב את `SECTIONS_BY_TYPE` בשבע קטגוריות החופשה לפי הסדר והצבעים מה-design.
3. להוסיף מקור תוכן יחיד לתבנית החופשה. שמות הקטגוריות, הפריטים והקופי החדש מגיעים מ-`messages/he.json`; הלוגיקה מקצה לכל אחד מ-46 הפריטים `section_id` ו-`order_index`.
4. להרחיב את constraints של `lists.type` ושל `categorizations_cache.list_type` ל-`vacation_abroad`.
5. להוסיף RPC בשם `create_list_with_items` שרץ כפעולה טרנזקציונית אחת תחת RLS: מאמת חברות במשק הבית דרך הפוליסות הקיימות, יוצר רשימה, ואז יוצר את מערך הפריטים עם `created_by_user_id = auth.uid()`. כשל כלשהו מבטל את כל הפעולה.
6. להוסיף helper ב-`lib/supabase/lists.ts` שקורא ל-RPC עם תבנית רק עבור `vacation_abroad` ומערך ריק עבור הסוגים הקיימים.
7. לעדכן את `/lists`: אפשרות סוג רביעית, placeholder, loading נעול, שגיאה inline, count נכון ועדכון state עם 46 הפריטים שהוחזרו/נוצרו.
8. לעדכן את `ListCard` ואת `/lists/[listId]`: chip ואייקון, קופי ההתקדמות, placeholders, הסתרת „סיימתי קניות” וקטגוריית „אחר” כברירת מחדל.
9. להוסיף מיפויי Lucide לאייקון המזוודה ולאייקוני הקטגוריות.

**Files likely touched:**

- `messages/he.json`
- `lib/list-types.ts` (חדש)
- `lib/list-templates.ts` (חדש)
- `lib/list-progress.ts` (חדש, אם נדרש כדי לבדוק את התנהגות הקופי)
- `lib/categories.ts`
- `lib/db/types.ts`
- `lib/db/schema.sql`
- `lib/db/__tests__/schema.test.ts`
- `lib/__tests__/list-templates.test.ts` (חדש)
- `lib/supabase/lists.ts` ו-`lib/supabase/__tests__/lists.test.ts` (חדשים)
- `lib/icon-map.tsx`
- `app/lists/page.tsx`
- `components/ListCard.tsx` ו-`components/__tests__/ListCard.test.tsx`
- `app/lists/[listId]/page.tsx`

**Test strategy:**

- **Schema unit:** ה-constraints כוללים `vacation_abroad`; ה-RPC קיים, משתמש ב-`auth.uid()`, מכניס items באותה פונקציה, מוגבל ל-`authenticated` ואינו זמין ל-`anon`.
- **Template unit:** בדיוק 46 פריטים, כל שם לא ריק וייחודי, בדיוק שש קטגוריות לא ריקות, `other` קיים בקטגוריות אך לא בתבנית, כל `order_index` ייחודי ורציף, ולכל פריט אין כמות או מצב מסומן.
- **Supabase helper unit:** סוג חופשה שולח 46 פריטים ל-RPC; סוגים קיימים שולחים מערך ריק; שגיאת RPC חוזרת כתוצאה בטוחה ואינה מדווחת כהצלחה.
- **ListCard component:** תווית „חופשה בחו״ל”, מצב „הכול ארוז”, ושמירת „הכל בעגלה” לסופר.
- **Progress unit/component:** שלושת מצבי האריזה וההחלטה שלא להציג complete-trip ברשימת חופשה.
- **Regression:** כל suite הקיים, TypeScript ו-build.

**Depends on:** אין.

**Done when:**

- [ ] כל הטסטים נכתבו תחילה ונכשלו לפני המימוש המתאים.
- [ ] `npm test -- --run` עובר.
- [ ] `npx tsc --noEmit` עובר ללא שגיאות חדשות וללא `any` חדש.
- [ ] `npm run build` עובר.
- [ ] יצירת רשימת חופשה קוראת פעם אחת ל-RPC ומחזירה רשימה עם 46 פריטים; אין insert נפרד בצד הלקוח שיכול להשאיר מצב חלקי.
- [ ] פתיחה ורענון רק קוראים את הפריטים הקיימים ואינם מפעילים seeding.
- [ ] ארבעת הסוגים מוצגים ב-create sheet; רק חופשה כוללת תוכן מוכן.
- [ ] שבע הקטגוריות מופיעות בבורר, ו„אחר” אינה מוצגת כסקציה ריקה בגוף הרשימה.
- [ ] שפת האריזה מופיעה רק ב-`vacation_abroad`; שלושת הסוגים הקיימים נשארים עם שפת הקניות.
- [ ] „סיימתי קניות” אינו מרונדר ברשימת חופשה.
- [ ] loading, retry, RTL ב-375px ו-`eSIM` נבדקו ידנית בדפדפן.
- [ ] ה-commit מפנה ל-`06-vacation-abroad-list` ול-T1.

## Build Order

T1 בלבד — vertical slice מלא.

## Risks

- **Schema קיים:** `create table if not exists` אינו משנה constraint שכבר נפרס. קובץ ה-schema חייב לכלול `drop constraint if exists` + `add constraint` עבור התקנה קיימת, לא רק הגדרת create חדשה.
- **טרנזקציה/RLS:** ה-RPC חייב להישאר security-invoker או לבצע בדיקת household מפורשת לפני כל כתיבה. אין להשתמש ב-`security definer` ללא בדיקה מפורשת.
- **תגובה מ-RPC:** PostgREST עשוי להחזיר composite יחיד כאובייקט או מערך; ה-helper מנרמל את שתי הצורות ובודק שאין `null`.
- **נפח:** התוכן כולל 46 שורות נתונים, אך אין להרחיב את המשימה למנוע תבניות כללי, התאמה ליעד או „חופשה בארץ”.
- **ענף קיים:** העבודה מתחילה מענף ה-production ולא מענף `04-drag-between-sections`, כדי לא לכלול פיצ׳ר לא ממוזג. קבצים לא קשורים בעץ העבודה נשמרים ללא שינוי.
