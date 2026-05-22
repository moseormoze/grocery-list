# Test Debt — Audit (2026-05-19)

## TL;DR
12 טסטים נכשלים על `feature/grocery-list-production`. כולם **stale tests**, לא רגרסיות. הקוד בפרודקשן תקין. ניתן לתקן בכל עת — אין דחיפות תפעולית.

## הטסטים הנופלים

### 1. `lib/offline/__tests__/queue.test.ts` — כל הקובץ נופל (~10 טסטים)
**שורש הבעיה:** הטסט מייבא `OfflineQueue` כקלאס ([line 2](../../lib/offline/__tests__/queue.test.ts#L2)):
```ts
import { OfflineQueue, NetworkSimulator, resolveConflict, getOfflineQueue } from '../queue';
```
אבל הקלאס לא מיוצא מ-[lib/offline/queue.ts:24](../../lib/offline/queue.ts#L24) — הוא בכוונה פנימי כדי לכפות singleton דרך `getOfflineQueue()`. תוצאה: ה-import נכשל, **כל** הסוויט מתקרס לפני שטסט אחד רץ.

**שגיאת TS תואמת:**
```
lib/offline/__tests__/queue.test.ts(2,10): error TS2724:
'"../queue"' has no exported member named 'OfflineQueue'.
Did you mean 'getOfflineQueue'?
```

**אופציות תיקון:**
- **(מומלץ)** לשכתב את הטסטים שישתמשו ב-`getOfflineQueue()` בכל מקום, ולנקות `localStorage` בין טסטים. שומר על דפוס ה-singleton בקוד הפרודקשן.
- (חלופי) להוסיף `export` לקלאס ולתעד שזה רק לטסטים. שובר את הסינגלטון.

### 2. `lib/supabase/__tests__/sync.test.ts` — ~2 טסטים בודדים נופלים
**שורש הבעיה:** ה-mock של supabase לא מטפל נכון בצ׳יין `.update().eq()`. הקוד בפרודקשן ([lib/supabase/sync.ts:89-96](../../lib/supabase/sync.ts#L89-L96)) עושה:
```ts
await supabase.from('items').update({...}).eq('id', mutation.itemId);
```
שלוש קריאות שרשורות. ה-mock ב-[שורות 102-104](../../lib/supabase/__tests__/sync.test.ts#L102-L104) מסתיים אחרי `update()` ולא מספק `.eq()` שמחזיר תוצאה — `.eq` בנפרד על `from()` לא תופס את הצ׳יין. תוצאה: ה-await נשבר וההחלפה (`synced=1`) לא קורה.

**אופציות תיקון:**
- לתקן את המוק כך ש-`update()` יחזיר `{ eq: vi.fn().mockReturnValue({ error: null }) }`. סדר נכון: `from().update().eq()` כל אחד מחזיר אובייקט עם המתודה הבאה.
- אופציה כללית יותר: לכתוב helper `createSupabaseMock()` שמקבל map של `{table: {method: result}}` ויוצר צ׳יין הגיוני אוטומטית.

## למה זה לא רגרסיה
- ה-singleton ב-`queue.ts` תקין: enqueue + getUnsyncedMutations + markSynced + localStorage persistence — כולם נראים נכון בקריאה.
- `replayOfflineMutations` ב-`sync.ts` תקין: ממיין לפי timestamp ([line 31](../../lib/supabase/sync.ts#L31)), בולע failures בודדים ב-try/catch ([line 38-43](../../lib/supabase/sync.ts#L38-L43)), מנקה synced בסוף.
- שינויי שותפים זורמים דרך הקוד הזה, וכרגע (לפי הפרודקשן) הסנכרון עובד.

## עדיפות
- **לא חוסם** את פיצ׳ר 04 (drag between sections) או כל פיצ׳ר אחר.
- **רצוי** לתקן לפני שמוסיפים פיצ׳רים נוספים שנוגעים ב-offline/sync — שם הטסטים יהיו רשת ביטחון אמיתית.
- **טווח זמן הגיוני:** משימה של ~1-2 שעות, מתאימה ל"day of cleanup" בין פיצ׳רים גדולים.

## משימה מוצעת
משימה אחת בלבד: שכתוב שני הסוויטים שיעברו. אין שינוי לקוד פרודקשן. אקבילי-PR.
