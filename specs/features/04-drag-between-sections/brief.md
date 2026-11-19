# Feature: Drag Between Sections (Edit Mode)

## Problem
כשמשתמש מוסיף פריט עם קטגוריה שגויה — בטעות, או כי שינה דעה — אין דרך לתקן אותו "במקום". הדרך היחידה היום היא למחוק ולהוסיף מחדש (איבוד שם הפריט, הכמות, וההיסטוריה). הגרירה הקיימת במצב עריכה מאפשרת רק סידור בתוך אותה סקציה — לא חציית סקציות. התוצאה: רשימות מתבלגנות עם הזמן, פריטים נשארים בקטגוריות הלא נכונות, או נמחקים ונוצרים מחדש.

## User Story
As a user organizing my shared grocery list, I want to drag a miscategorized item from one section to another in edit mode, so that I can fix the category in place without deleting and re-adding the item.

## Scope — What's In
- במצב עריכה (`isEditMode=true`), ה-drag handle הקיים (`≡`) מאפשר גרירה גם **לסקציה אחרת**, לא רק סידור פנימי.
- אזור drop = כל הרווח של סקציית היעד (לא רק הכותרת).
- בשחרור על סקציה אחרת: ה-`section_id` של הפריט מתעדכן ב-DB; הפריט מופיע **בסוף סקציית היעד**.
- ה-reorder הקיים בתוך אותה סקציה ממשיך לעבוד בדיוק כמו היום.
- ה-realtime הקיים מסנכרן את השינוי לפרטנר — הפריט מופיע אצלו בסקציה החדשה דרך ה-INSERT/UPDATE channel הקיים.
- Auto-scroll במובייל בזמן גרירה (`@dnd-kit` built-in).
- ריפקטור מבני: איחוד ה-`DndContext`-per-section הקיים ל-`DndContext` יחיד ב-root + `SortableContext` לכל סקציה. נדרש כדי לאפשר cross-container drag.

## Out of Scope
- **גרירה לסקציה ריקה** — סקציות בלי פריטים לא מצוירות ב-DOM. ידוע, מתועד כ-limitation ב-discovery doc, ידחה עד שיהיה pain מוכח.
- **בחירת מיקום בתוך סקציית היעד** בזמן הגרירה — תמיד נוחת בסוף.
- **למידה/auto-categorization** — אין מנגנון שזוכר ש"גבינה היא מוצרי חלב" כדי לסווג אוטומטית בהוספה הבאה.
- **אנימציית "פרטנר זז עכשיו"** או presence indicator תוך כדי גרירה.
- **גרירה במצב Shopping** (default view) — נשארת רק בעריכה.
- **חלופת tap-to-move modal** — נשקלה ונדחתה לטובת גרירה.

## Acceptance Criteria
- [ ] במצב עריכה, תפיסת פריט עם ה-handle `≡` ושחרור מעל אזור של סקציה אחרת מעבירה את הפריט לאותה סקציה.
- [ ] לאחר העברה, הפריט מופיע **בסוף** סקציית היעד.
- [ ] לאחר העברה, ה-`section_id` של הפריט ב-DB תואם את הסקציה החדשה (נבדק דרך re-render אחרי refresh / נתוני realtime).
- [ ] ה-reorder בתוך אותה סקציה ממשיך לעבוד כמו היום (regression-safe).
- [ ] שחרור על אזור לא תקף (מעל סקציית המקור, מחוץ לרשימה) מבטל את הגרירה — אין שינוי ב-DB.
- [ ] במכשיר נייד, גרירה כלפי קצה ה-viewport מפעילה auto-scroll עד שסקציה רחוקה נכנסת לתצוגה.
- [ ] במצב Shopping (לא-עריכה) הגרירה מנוטרלת לחלוטין — לא ניתן להזיז פריטים בין סקציות.
- [ ] Partner B שצופה ברשימה רואה את הפריט מופיע בסקציה החדשה אצלו אחרי שיתוף ה-realtime (latency דומה לפעולות אחרות).
- [ ] בדיקת RTL: כיוון הגרירה והאלמנט המוצג בזמן drag נראים נכון בעברית/RTL.

## Dependencies
- **Depends on:** `@dnd-kit` הקיים ב-[app/lists/[listId]/page.tsx](app/lists/[listId]/page.tsx); ה-Supabase realtime על `list_items` (כבר קיים — הפיצ׳ר רק מעדכן `section_id` בעוד שורה).
- **Blocks:** אין פיצ׳רים מתוכננים תלויים.

## Open Questions
*(None — closed.)*
