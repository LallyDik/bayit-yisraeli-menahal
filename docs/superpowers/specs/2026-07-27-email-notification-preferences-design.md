# העדפות מייל + ביטול הרשמה לתזכורות — עיצוב

תאריך: 2026-07-27

## מטרה

לתת לבעל דירה שליטה על קבלת מיילי התזכורת: קישור ביטול (unsubscribe) במייל
עצמו (ללא התחברות), ומתג במסך הגדרות באפליקציה. פונקציית `send-payment-reminders`
תכבד את ההעדפה ותדלג על מי שביטל.

התזכורות נשלחות לבעל הדירה (המשתמש), לא לשוכר — אימות: `send-payment-reminders`
שולף את המייל דרך `auth.admin.getUserById(ownerId)`.

## רכיבים וקבצים

| קובץ | שינוי | אחריות |
|---|---|---|
| `supabase/migrations/20260727120000_notification_settings.sql` | **חדש** | טבלת `notification_settings` + RLS |
| `supabase/functions/unsubscribe/index.ts` | **חדש** | ביטול דרך טוקן, ללא התחברות |
| `supabase/functions/send-payment-reminders/index.ts` | שינוי | דילוג על מי שביטל + קישור ביטול + כותרת List-Unsubscribe |
| `src/pages/Settings.tsx` | **חדש** | מסך הגדרות עם מתג קבלת תזכורות |
| `src/App.tsx` | שינוי | ראוט `/settings` מעל ה־catch-all |
| `src/pages/Index.tsx` | שינוי | כפתור "הגדרות" בכותרת; טיפול ב־`?unsubscribed=1` |
| `src/hooks/useNotificationSettings.ts` | **חדש** | hook לקריאה/עדכון של השורה עבור המשתמש הנוכחי |

## נתונים

### טבלה `notification_settings`

```sql
create table public.notification_settings (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  email_reminders   boolean not null default true,
  unsubscribe_token text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at        timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
```

- **RLS:** שלוש policies למשתמש על השורה שלו בלבד — `select`, `insert`, `update` עם
  `owner_id = auth.uid()` (מאפשר למסך ההגדרות לקרוא/לכתוב ישירות). פונקציית הביטול
  משתמשת ב־service role ועוקפת RLS.
- `unsubscribe_token` **יציב** (לא חד־פעמי) — כי מבטלים גם ממייל ישן. בעל דירה רואה
  את הטוקן של עצמו בלבד; זה חסר משמעות אבטחתית (מבטל את המיילים של עצמו).

## זרימות

### מסך הגדרות (`/settings`)

- ראוט חדש, מעל ה־catch-all. נגיש רק למחוברים: `loading → loader`, `!user → Navigate to "/"`.
- כפתור **"הגדרות"** (אייקון גלגל שיניים) בכותרת `Index.tsx`, ליד "מדריך"/התנתקות, מנווט ל־`/settings`.
- כותרת + קישור חזרה ל־"/".
- `useNotificationSettings` קורא את שורת המשתמש (או ברירת מחדל `email_reminders=true` אם אין), ומעדכן דרך upsert.
- **מתג** (shadcn `Switch`): "קבלת תזכורות תשלום במייל". שינוי → upsert `{ owner_id: auth.uid(), email_reminders }` → toast הצלחה. יש מקום להגדרות עתידיות.

### ביטול דרך המייל (`unsubscribe` Edge Function)

- קלט: `?token=<unsubscribe_token>`.
- שירות: service role → מוצא את השורה לפי הטוקן → `email_reminders=false`, `updated_at=now()`. **אידמפוטנטי** (לחיצה חוזרת → אותה תוצאה).
- **GET** (לחיצה על הקישור): `303` הפניה ל־`APP_URL?unsubscribed=1`. (Edge Functions של Supabase לא מגישות HTML כמו שצריך — לכן הפניה לאפליקציה, כמו `mark-charge-paid`.)
- **POST** (one-click של Gmail): מבצע את הביטול ומחזיר `200`.
- טוקן לא קיים → הפניה עם `?unsubscribed=invalid` (או 404 ל־POST). ללא התחברות — הטוקן הוא האישור.

### התזכורות מכבדות את ההעדפה (`send-payment-reminders`)

לכל בעל דירה בלולאה הקיימת, **לפני השליחה**:
1. `upsert` ל־`notification_settings` עם `{ owner_id }` ו־`onConflict: 'owner_id', ignoreDuplicates: true`, ואז `select` — get-or-create, כדי לקבל `email_reminders` ו־`unsubscribe_token`.
2. אם `email_reminders === false` → דילוג (`results.push({ ownerId, sent:false, reason:'unsubscribed' })`).
3. אחרת — בונים את המייל עם קישור ביטול בתחתית, ומוסיפים כותרות:
   - `List-Unsubscribe: <${UNSUB_URL}?token=${token}>`
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
   קישור גלוי בתחתית: *"לא רוצים לקבל תזכורות? לחצו לביטול"*.

`UNSUB_URL = 'https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/unsubscribe'` (כמו `MARK_PAID_URL`).

### אישור באפליקציה (`?unsubscribed=1`)

`Index.tsx` (או מנגנון האישור הקיים `PaidConfirmation`) יזהה `?unsubscribed=1` ויציג toast:
> "ביטלת קבלת תזכורות תשלום במייל. אפשר להפעיל מחדש בכל עת דרך ההגדרות."
ואז ינקה את הפרמטר מה־URL. `?unsubscribed=invalid` → toast ניטרלי ("הקישור אינו תקין").

## טיפול בשגיאות ומקרי קצה

| מצב | התנהגות |
|---|---|
| אין שורת הגדרות | נחשב כמנוי (ברירת מחדל `true`); התזכורות יוצרות שורה כדי לקבל טוקן |
| לחיצה כפולה על ביטול | אידמפוטנטי — אותו אישור |
| הפעלה מחדש | מתג בהגדרות → `email_reminders=true` |
| טוקן לא קיים בביטול | הפניה עם `unsubscribed=invalid` |
| כשל upsert בתזכורות | לוג + המשך (לא לחסום את שאר הבעלים) — אם אין טוקן, נשלח בלי קישור ביטול במקום להיכשל |

## החלטות אבטחה

- טבלת `notification_settings` עם RLS: המשתמש ניגש **רק** לשורה שלו. הביטול ללא־התחברות
  עובר דרך service role בלבד (Edge Function), בדיוק כמו `mark-charge-paid`.
- הטוקן הוא מזהה אקראי ארוך (128 hex), לא ניתן לניחוש.

## בדיקות

- **RLS** — בדיקת `tests/notification-settings-rls.test.ts`: בעל דירה קורא/מעדכן רק
  את שורתו; משתמש אחר לא רואה ולא משנה אותה (כמו `tests/rls.test.ts`).
- **לוגיקה טהורה** — אם תיווצר (למשל מיפוי סטטוס), בדיקת יחידה. אחרת אין.
- מסך ההגדרות + ה־Edge Function: `tsc` + `build` + בדיקה ידנית (אין הרנס לבדיקות React).
- ידני מקצה לקצה: ביטול מהמייל → אישור באפליקציה → הרצת תזכורת (dry) מוודאת דילוג → הפעלה מחדש בהגדרות → תזכורת נשלחת שוב.

## מחוץ לתחום

- העדפות ברמת פירוט גבוהה יותר (סוגי מיילים שונים) — כרגע מתג יחיד לתזכורות.
- ביטול עבור מיילי Auth (איפוס סיסמה וכו') — אלה טרנזקציוניים, לא שיווקיים, ואין להם ביטול.
- אופן התשלום של השוכר — **פיצ'ר נפרד**, יתוכנן אחרי זה.

## סיכונים

| סיכון | טיפול |
|---|---|
| בעל דירה מבטל בטעות | קל להפעיל מחדש בהגדרות; ה־toast מסביר איפה |
| קישור ביטול נשלח לכתובת הישנה (lovable) | `UNSUB_URL` על דומיין ה־Supabase (יציב); ה־redirect ל־`APP_URL` שכבר `nihulschirut.com` |
| שורה נוצרת בכל שליחה בטעות | upsert עם `ignoreDuplicates` — לכל היותר שורה אחת לבעל דירה |
