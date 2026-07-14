# מעבר ל-Supabase — שלב 1: בסיס

**תאריך:** 2026-07-14
**סטטוס:** אושר, ממתין לתוכנית מימוש
**פרויקט Supabase:** `lwmddgwwfirkcaqaxdbh`

---

## למה

המערכת רצה היום על Google Sheets דרך Google Apps Script, עם שלוש פרצות אבטחה קריטיות:

1. **סיסמאות עוברות ב-URL.** `apiCall('signin', {email, password})` בונה `?action=signin&email=...&password=...`. Apps Script רושם כל URL ביומן ההרצות; הסיסמה נשמרת שם בטקסט גלוי, וגם בהיסטוריית הדפדפן.
2. **אין סשן.** "המשתמש המחובר" הוא `localStorage.currentUser` בלבד. אין טוקן ואין אימות מול השרת. כל אחד יכול לכתוב `localStorage.setItem('currentUser', '{"id":"..."}')` ולהיות כל משתמש. ה-Web App חייב להיות פתוח ל"כל אחד" כדי שהדפדפן יוכל לקרוא לו, ולכן הנקודת קצה חשופה לחלוטין.
3. **אין בדיקת הרשאות בצד השרת.** `updateTenant` ו-`deleteTenant` מקבלים `id` ולא בודקים בעלות. משתמש א' יכול למחוק שוכרים של משתמש ב'.

בנוסף: גיבוב הסיסמאות הוא SHA-256 בלי מלח; שגיאות נבלעות בשקט בכל ה-hooks (מקור הבאג `ae2a290 "Payment data not updating on save"`); ו-`src/supabaseClient.ts` מכיל מפתחות מוטמעים לפרויקט נטוש שאף קובץ לא מייבא.

Supabase נותן מוכן את מה שכרגע בנוי ידנית ושבור: גיבוב סיסמאות תקין, סשן עם טוקן, איפוס סיסמה, ו-RLS שאוכף הרשאות ברמת הדאטהבייס.

## החלטות שהתקבלו

| נושא | החלטה |
|---|---|
| נתונים קיימים | נתוני בדיקה בלבד. **אין הגירת נתונים.** |
| מי מתחבר | **רק בעלי נכסים.** שוכרים לא מקבלים חשבון — הם יקבלו מיילים בלבד (שלב 5). |
| הרשמה | **פתוחה.** כל אחד יכול להירשם עם מייל וסיסמה. |
| מקור הסכומים | **הסכומים חיים על השוכר.** מה שרשום על היחידה הוא תבנית שממלאת את הטופס בלבד, ומתנתקת ברגע שנוצרה תקופת השכירות. עדכון יחידה לא משפיע על שוכר קיים. |
| שוכר שעוזב | **ארכיון, לא מחיקה.** יש לשמר היסטוריה: מי גר ביחידה, מתי, בכמה. |
| שותפים לדירה | **לא נתמך.** יחידה מחזיקה שוכר פעיל אחד בכל רגע, נאכף בדאטהבייס. |

## פירוק לתת-פרויקטים

הבקשה המלאה מכילה חמש תת-מערכות עצמאיות. כל אחת מקבלת ספק ותוכנית משלה.

1. **בסיס** — התחברות, יחידות, שוכרים, תקופות שכירות, RLS. ← *המסמך הזה*
2. **מנוע תשלומים** — סוגי תשלום שהמשתמש מגדיר בעצמו (ועד בית וכו'), תדירויות (חודשי/דו-חודשי/תלת-חודשי), תאריך חיוב עם ברירת מחדל לועזית או עברית.
3. **מדים וחישוב צריכה** — היסטוריית קריאות מונה, מחיר לקוט"ש עם ברירת מחדל, חישוב אוטומטי של החוב מהפרש הקריאות.
4. **קבצים ומדיה** — חוזים סרוקים, תמונות יחידה, שרטוטים, מידות, מצב הדירה.
5. **תזכורות מייל + עדכון בתשובה למייל** — הגדול והמסוכן שבהם. דורש שרת מיילים נכנסים, פרסור טקסט חופשי בעברית, והתאמה לשוכר הנכון כולל טיפול בעמימות (שני שוכרים בשם "משה"). פרויקט בפני עצמו.

## היקף שלב 1

**נכנס:** Supabase Auth, יחידות, שוכרים, תקופות שכירות, RLS, שכבת נתונים על React Query, בדיקות RLS.

**נמחק:**

| קובץ | סיבה |
|---|---|
| `GOOGLE_APPS_SCRIPT_CODE.js` | ה-backend הישן במלואו |
| `src/services/googleSheetsApi.ts` | שכבת ה-API שמעבירה סיסמאות ב-URL |
| `src/components/GoogleSheetsSetup.tsx` | מסך הדבקת Script URL |
| `src/supabaseClient.ts` | מפתחות מוטמעים; נבנה מחדש ב-`src/lib/supabase.ts` |
| `src/hooks/useAuth.ts` | ה"סשן" של localStorage; נכתב מחדש על Supabase Auth |

**יורד זמנית, חוזר בשלב 2:** `src/components/PaymentManagement.tsx`, `src/hooks/usePayments.ts`. הם בנויים על חמש עמודות קבועות (שכ"ד/חשמל/מים/ועד/גז) — בדיוק המודל שנחלף בסוגי תשלום מוגדרי-משתמש.

**נשאר:** `src/utils/hebrewDates.ts` — יידרש לתאריכי חיוב עבריים בשלב 2.

**תפר ידוע:** בשלב 1 שכר דירה הוא עמודה על תקופת השכירות, כי זה המינימום לפתוח שוכר. בשלב 2 ייתכן שנגלה ששכר דירה הוא פשוט עוד סוג תשלום ונמזג אותו למנוע הכללי. ההחלטה נדחית במכוון — אין מספיק מידע כרגע, ואין נתונים אמיתיים, ולכן מיגרציה כזו לא תעלה כלום.

## סכמה

```sql
create table units (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null check (length(trim(name)) > 0),   -- השדה היחיד שחובה
  default_rent numeric(10,2),        -- תבנית בלבד; לא משפיעה על שוכר קיים
  notes        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, owner_id)
);

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(trim(name)) > 0),    -- השדה היחיד שחובה
  phone       text,
  email       text,                  -- יידרש לתזכורות בשלב 5
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (id, owner_id)
);

create table tenancies (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users on delete cascade,
  tenant_id    uuid not null,
  unit_id      uuid not null,
  monthly_rent numeric(10,2) not null default 0,
  start_date   date not null default current_date,
  end_date     date,                 -- null = פעיל היום
  created_at   timestamptz not null default now(),

  check (end_date is null or end_date >= start_date),
  foreign key (tenant_id, owner_id) references tenants (id, owner_id) on delete restrict,
  foreign key (unit_id,   owner_id) references units   (id, owner_id) on delete restrict
);

create unique index one_active_tenancy_per_unit
  on tenancies (unit_id) where end_date is null;

create index on units     (owner_id);
create index on tenants   (owner_id);
create index on tenancies (owner_id);
create index on tenancies (unit_id);
create index on tenancies (tenant_id);
```

### שלוש החלטות סכמה שאינן מובנות מאליהן

**`owner_id` עם `default auth.uid()`.** הלקוח לעולם לא שולח את השדה. הדאטהבייס ממלא אותו מהטוקן, ולכן אי אפשר לזייף אותו.

**מפתחות זרים מורכבים `(unit_id, owner_id)` — הנקודה הקריטית.** RLS לבדו אינו מספיק: בדיקות מפתח זר **עוקפות RLS**. עם מפתח זר רגיל, משתמש א' יכול היה ליצור תקופת שכירות שמצביעה על יחידה של משתמש ב' — הוא לא היה רואה אותה, אך היה יוצר קשר אליה, וצירוף join היה עלול לדלוף. הצירוף של `unique (id, owner_id)` והמפתח הזר הכפול מכריח את המנוע לוודא שהיחידה שייכת לאותו בעלים.

**`on delete restrict` על יחידה ועל שוכר כאחד.** אי אפשר למחוק יחידה שגרו בה, ואי אפשר למחוק שוכר שהייתה לו תקופת שכירות — מחיקה כזו הייתה משמידה בשקט את ההיסטוריה שביקשנו לשמר. `archived_at` על שתי הטבלאות הוא הנתיב הנכון: הרשומה נעלמת מהמסך, ההיסטוריה נשארת. מחיקה אמיתית אפשרית רק ליחידה או לשוכר שמעולם לא נקשרו לתקופת שכירות.

## RLS

```sql
alter table units     enable row level security;
alter table tenants   enable row level security;
alter table tenancies enable row level security;

create policy owner_all on units
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on tenants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on tenancies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

`using` חוסם קריאת שורות זרות. `with check` חוסם כתיבת שורות זרות. חור ההרשאות נסגר ברמת הדאטהבייס — גם באג עתידי ב-React לא יעקוף אותו.

## שכבת נתונים

```
src/lib/supabase.ts                              קליינט ממשתני סביבה
src/types/database.ts                            טיפוסים שנוצרים מהדאטהבייס
src/api/{units,tenants,tenancies}.ts             פונקציות שאילתה; זורקות בכישלון
src/hooks/{useUnits,useTenants,useTenancies}.ts  React Query
```

**מפתחות.** `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` ב-`.env.local` (מחוץ ל-git), עם `.env.example` בתוך ה-git. ה-anon key ציבורי מעצם טבעו — הוא נשלח לדפדפן של כל מבקר. **המעבר למשתני סביבה הוא סדר, לא אבטחה. מה שמגן זה ה-RLS.**

**טיפוסים.** נוצרים מהדאטהבייס, לא נכתבים ביד. ה-`Tenant` הקיים מצהיר `createdAt: Date` בזמן שמהגיליון מגיע string — פער שנעלם כשהטיפוסים מגיעים מהמקור.

**שגיאות.** פונקציית API זורקת → `useMutation` תופס → `sonner` (כבר מותקן) מציג. אין נתיב שבו כישלון נבלע. זה סוגר את מחלקת הבאגים של `ae2a290`.

**React Query** מחליף את `useState` + `fetchTenants()` הידני, שמושך היום את כל השוכרים אחרי כל עדכון קטן.

## בדיקות

אין כרגע ולו בדיקה אחת בפרויקט. מוסיפים Vitest וחבילת בדיקות RLS עם שני משתמשים:

- ב' מבקש רשימת יחידות → לא רואה את היחידה של א'
- ב' מנסה לעדכן את היחידה של א' → **0 שורות** הושפעו
- ב' מנסה למחוק אותה → **0 שורות**
- ב' מנסה ליצור תקופת שכירות שמצביעה על היחידה של א' → **נכשל** (המפתח הזר הכפול)
- משתמש לא מחובר → לא רואה כלום

**המלכודת:** כש-RLS חוסם עדכון, Postgres **לא זורק שגיאה** — הוא מעדכן אפס שורות ומחזיר הצלחה. בדיקה שרק מוודאת "לא נזרקה חריגה" תעבור גם על מדיניות שבורה לחלוטין. **הבדיקות חייבות לספור שורות, לא חריגות.**

## דרישות מהדשבורד

**כבה אימות מייל** (Authentication → Providers → Email → Confirm email = off). זה מאפשר לבדיקות להירשם דרך ה-anon key, ובכך מייתר את הצורך בהחזקת service-role key בסביבת הפיתוח — מפתח כזה עוקף RLS לחלוטין.

## מטלות המשך שנרשמו במכוון

- **פרויקט פרודקשן נפרד עם אימות מייל דלוק.** `Confirm email` כובה בפרויקט הפיתוח (2026-07-14) כדי שבדיקות ה-RLS יוכלו להירשם דרך ה-anon key. ההחלטה תקפה לפיתוח בלבד.
- **מחיקת פרויקט Supabase הנטוש** `sdjgcirhmvlihgoafxxi`, כדי לוודא שאין טבלאות ישנות בלי RLS.
- **הכרעה בתפר של שכר הדירה** בתחילת שלב 2.

### נסגר

- **ה-PAT שנחשף** (שרת MCP `supabase-branch`) — נבדק ונמצא ששייך לחשבון בדיקות של צד שלישי, לא לחשבון של בעל הפרויקט. אין סיכון. השרת חסום ברמת הפרויקט ב-`.claude/settings.json` כדי למנוע כתיבה בטעות לדאטהבייס לא נכון.
