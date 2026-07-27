# תזמון פתיחת חיוב + שליחת תזכורת — עיצוב

תאריך: 2026-07-27

## מטרה

לתת לבעל דירה שליטה על שני מועדים:
1. **פתיחת חיוב לסימון** — כמה ימים *לפני* מועד התשלום החיוב מופיע כ"לתשלום" בסקירה.
2. **שליחת תזכורת** — כמה ימים *אחרי* מועד התשלום נשלח מייל התזכורת (0 = ביום התשלום).

שני ערכים פר־בעל־דירה, על מסך `/settings` הקיים.

## החלטות מסגרת

- **אחסון:** הרחבת טבלת `notification_settings` הקיימת (שורה אחת לכל בעל דירה), לא טבלה חדשה.
- **ברירות מחדל:** `open_days_before = 3` (פתיחה 3 ימים מוקדם), `reminder_offset_days = 0` (תזכורת ביום התשלום). טווח כל אחד: 0–30.
- **הערה מוצרית:** ברירת המחדל `3` **משנה התנהגות לכל בעלי הדירות** — חיובים יופיעו כ"לתשלום" 3 ימים מוקדם יותר. הוחלט במפורש; ניתן לשינוי פר־בעל־דירה.

## נתונים

```sql
alter table public.notification_settings
  add column if not exists open_days_before integer not null default 3
    check (open_days_before between 0 and 30),
  add column if not exists reminder_offset_days integer not null default 0
    check (reminder_offset_days between 0 and 30);
```

- אדיטיבי; RLS הקיים על `notification_settings` מכסה את העמודות.
- שורות קיימות מקבלות את ברירת המחדל (3 / 0). בעלי דירות ללא שורה — האפליקציה
  והפונקציה מתייחסות לחוסר שורה כברירת המחדל (3 / 0), עקבי עם ה־default.
- עדכון `src/types/database.ts` ידנית: הוספת `open_days_before: number` ו־
  `reminder_offset_days: number` ל־Row של `notification_settings`, ו־`?: number`
  ל־Insert/Update.

## עזר תאריך — `src/utils/date.ts`

הוספת פונקציה טהורה (הקובץ כבר קיים עם `localDateISO`):

```ts
/** YYYY-MM-DD `n` days after `iso` (n may be negative). */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
```

זו הלוגיקה בת־הבדיקה (בדיקת יחידה).

## זרימות

### הרחבת `useNotificationSettings`

ה־hook יחזיר גם `openDaysBefore: number` ו־`reminderOffsetDays: number` (ברירת מחדל
3 / 0 כשאין שורה), ו־`save` יקבל אובייקט חלקי `{ email_reminders?, open_days_before?, reminder_offset_days? }`
במקום בוליאני יחיד — או פונקציית שמירה נפרדת לכל שדה. הבחירה המדויקת נקבעת בתוכנית;
העיקרון: קריאה + upsert של שלושת השדות על שורת המשתמש.

### מסך `/settings` — סעיף "תזמון"

מתחת למתג "תזכורות תשלום במייל", כרטיס/סעיף "תזמון" עם שני שדות מספר (0–30):
- "פתיחת חיוב לסימון — ימים לפני מועד התשלום"
- "שליחת תזכורת — ימים אחרי מועד התשלום (0 = ביום התשלום)"
שינוי → upsert → toast. מושבת בזמן טעינה/שמירה.

### פתיחה מוקדמת באפליקציה (`open_days_before`)

ב־`Index.tsx`, החישוב `dueActiveCharges` מסנן כיום `charge.due_date <= today`
(כאשר `today = localDateISO()`). ישתנה ל:
```ts
const threshold = addDaysISO(today, openDaysBefore);
... charge.due_date <= threshold ...
```
`openDaysBefore` מגיע מ־`useNotificationSettings` (ש־`Index` יתחיל להשתמש בו).
כך חיובים נכנסים ל"לתשלום" `open_days_before` ימים מוקדם יותר. הכפתורים והפעולות
עצמם לא משתנים — רק אילו חיובים נספרים כ"לתשלום עכשיו".

### דחיית תזכורת (`reminder_offset_days`)

ב־`send-payment-reminders`, שכבר שולף את שורת `notification_settings` של כל בעל דירה,
נוסיף קריאה של `reminder_offset_days` וסינון של חיוביו:
```ts
const cutoff = addDaysLocal(today, -offset); // YYYY-MM-DD, offset ימים אחורה
const rowsDue = ownerRows.filter((r) => r.due_date <= cutoff);
if (rowsDue.length === 0) { results.push({ ownerId, sent: false, reason: 'not yet due (offset)' }); continue; }
```
(הפונקציה רצה ב־Deno; `addDaysISO` יוגדר בתוכה או תשוכפל לוגיקת התאריך — לא ניתן
לייבא מ־`src/`.) `v_outstanding_charges` כבר מחזיר רק `due_date <= today`, אז הסינון
הוא תת־קבוצה (offset רק *מעכב*, לעולם לא מקדים). פריסה מחדש של הפונקציה (verify_jwt=true נשמר).

## טיפול בשגיאות ומקרי קצה

| מצב | התנהגות |
|---|---|
| אין שורת הגדרות | ברירת מחדל 3 / 0 (עקבי עם ה־column default) |
| ערך מחוץ ל־0–30 | ה־check ב־DB דוחה; ה־UI מגביל את הקלט (min/max) |
| offset גדול מ־0 וכל החיובים עדיין בטווח | הבעלים מדולג עם reason 'not yet due (offset)' |
| open_days_before משנה סקירה | רק תצוגת "לתשלום"; לא נוגע ביצירת/סימון חיובים |

## מחוץ לתחום

- תזמון ברמת שוכר/תקופה (זה פר־בעל־דירה).
- שינוי מנגנון ה־cron של התזכורות (רק הסינון בתוך הפונקציה משתנה).
- פתיחה מוקדמת המשנה מתי חיובים *נוצרים* (materialization) — רק תצוגת "לתשלום".

## בדיקות

- `tests/date.test.ts` (חדש או הרחבה) — בדיקת יחידה ל־`addDaysISO` (חיובי, שלילי, מעבר חודש/שנה).
- מיגרציה אדיטיבית; אין policy חדש.
- `npx tsc --noEmit`, `npm run build`, ובדיקה ידנית: שינוי הערכים ב־`/settings` → נשמר;
  חיוב עם מועד בעוד יומיים מופיע כ"לתשלום" כשהפתיחה 3; dry-run של התזכורות עם offset מדלג נכון.

## סיכונים

| סיכון | טיפול |
|---|---|
| ברירת מחדל 3 מפתיעה בעלי דירות קיימים | הוחלט במפורש; ניתן לשינוי ב־`/settings` |
| כפילות לוגיקת תאריך ב־Deno vs `src/` | פונקציה קטנה ומתועדת בשני המקומות; בדיקת יחידה בצד `src/` |
| offset מסנן יותר מדי | הסינון הוא תת־קבוצה של `due_date <= today`; offset רק מעכב |
