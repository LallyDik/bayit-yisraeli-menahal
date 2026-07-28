# מערך טסטים מקצה לקצה (E2E) — עיצוב

תאריך: 2026-07-27

> **עדכון 2026-07-28 (במהלך היישום):** שתי החלטות מסגרת השתנו לבקשת המשתמש —
> (1) **בלי עלות:** במקום Supabase branch נפרד, ה-E2E רץ מול הפרויקט הקיים עם
> משתמש בדיקה מבודד (RLS מגביל אותו לשורות שלו), והניקוי נעשה דרך ה-client של
> משתמש הבדיקה עצמו — **בלי service-role key**. (2) **דפדפן:** חוסם רשת (netfree)
> חסם את ה-CDN של Playwright; אושר `cdn.playwright.dev` בנטפרי ונעשה שימוש
> ב-Chromium הסטנדרטי (fallback: Chrome מערכתי דרך `channel: 'chrome'`). התוכנית
> המעודכנת: `docs/superpowers/plans/2026-07-28-e2e-testing-suite.md`.

## מטרה

לבנות מערך טסטים **מקצה לקצה** שמריץ את האפליקציה האמיתית בדפדפן ומדמה משתמש
אמיתי — כניסה, לחיצות, מילוי טפסים, מעבר בין טאבים — מול backend אמיתי. המטרה:
לתפוס רגרסיות בזרימות המשתמש המרכזיות (אימות, יחידות, שוכרים, תשלומים) לפני שהן
מגיעות למשתמשים.

## החלטות מסגרת

- **כלי:** Playwright (`@playwright/test`), דפדפן Chromium בלבד בשלב זה.
- **Backend:** Supabase **branch** ייעודי לטסטים — סביבה מבודדת עם אותה סכימה,
  שלא נוגעת בנתוני production.
- **אימות + seeding:** משתמש בדיקה קבוע; התחברות פעם אחת ו-reuse דרך `storageState`;
  ניקוי נתונים לפני הריצה דרך service-role (עוקף RLS).
- **הרצה:** מקומית עכשיו. המבנה מוכן ל-CI בהמשך בלי לשנות את הטסטים — צריך רק
  workflow שמרים branch ומזין secrets.
- **זרימות בתחום:** אימות (כניסה/הרשמה/התנתקות), ניהול יחידות, ניהול שוכרים + שיוך
  ליחידה, תשלומים (סימון כשולם / תשלום חלקי / דיאלוג סיכום).

## למה גישה זו

הטסטים הקיימים (`tests/**/*.test.ts`, vitest בסביבת node) מכסים לוגיקה טהורה
ואינטגרציה מול Supabase, אבל **לא** מפעילים את ה-UI. E2E בדפדפן משלים את החסר:
בודק שהאפליקציה שהמשתמש רואה באמת עובדת. ה-branch נותן בידוד מלא בלי הסיכון של
נגיעה בנתונים אמיתיים, וה-`storageState` מקצר כל טסט (התחברות פעם אחת, לא בכל טסט).

חלופות שנדחו:
- **jsdom + Testing Library** — מהיר יותר אבל לא דפדפן אמיתי; לא "מקצה לקצה".
- **Playwright בלי service-role** — נמנע מהסוד, אבל איטי, תלוי באישור-מייל כבוי,
  וניקוי נתונים שביר.
- **seeding דרך API עם מעט UI** — לא בודק את זרימות היצירה; מנוגד למטרה.

## תשתית ותצורה

- תוספת devDependency: `@playwright/test`. התקנת דפדפן Chromium (`npx playwright install chromium`).
- `playwright.config.ts` בשורש:
  - `testDir: './e2e'`, קבצי טסט `**/*.spec.ts`.
  - `baseURL: 'http://localhost:8080'` (הפורט של `vite` מ-`vite.config.ts`).
  - `workers: 1`, `fullyParallel: false` — דטרמיניזם מול ה-branch המשותף (מוטציות נתונים).
  - `retries: 1` מקומית; `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`.
  - `webServer`: מריץ `npm run dev:e2e` (= `vite --mode e2e`) ומחכה ל-`baseURL`.
    Vite טוען אוטומטית את `.env.e2e` במצב `e2e`, כך שהאפליקציה מדברת עם ה-branch.
  - `projects`:
    - `setup` — `testMatch: /auth\.setup\.ts/`.
    - `chromium` — `dependencies: ['setup']`, `storageState: 'e2e/.auth/user.json'`.

אין התנגשות עם vitest: הקונפיג של vitest כולל רק `tests/**/*.test.ts`, וה-E2E יושב
תחת `e2e/**/*.spec.ts`.

## Backend — Supabase branch

- יוצרים branch ייעודי לטסטים (חד-פעמי, דרך Supabase MCP או הדשבורד). ה-branch
  יורש את ה-migrations ולכן בעל אותה סכימה.
- קרדנציאלס ב-`.env.e2e` (**gitignored**):
  - `VITE_SUPABASE_URL` — URL של ה-branch.
  - `VITE_SUPABASE_ANON_KEY` — anon key של ה-branch.
  - `SUPABASE_SERVICE_ROLE_KEY` — service-role key של ה-branch (ל-seeding/ניקוי בלבד; לא מגיע לדפדפן).
  - `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — פרטי משתמש הבדיקה.
- הערך `.env.example` יעודכן עם דוגמת `.env.e2e` (מפתחות בלבד, בלי ערכים) והסבר.

## אימות וניקוי נתונים

- `e2e/support/supabase-admin.ts` — client עם service-role. מספק:
  - `ensureTestUser()` — יוצר את משתמש הבדיקה עם `email_confirm: true` אם אינו קיים
    (כדי לא להיות תלויים בזרימת אישור-מייל).
  - `resetTestUserData()` — מוחק את נתוני משתמש הבדיקה בטבלאות האפליקציה
    (units, tenants, tenancies, charges, וכל טבלה תלויה) לפי `user_id`, בסדר שמכבד
    מפתחות זרים. service-role עוקף RLS.
- `e2e/auth.setup.ts` (פרויקט `setup`):
  1. `ensureTestUser()`.
  2. `resetTestUserData()` — בסיס נקי לריצה.
  3. התחברות דרך ה-UI (מילוי טופס הכניסה ב-`Auth`) ואימות שה-Dashboard נטען.
  4. שמירת `storageState` ל-`e2e/.auth/user.json`.
- שאר הפרויקטים עושים reuse ל-`storageState` ומתחילים כבר מחוברים.

## מבנה קבצים

```
playwright.config.ts
.env.e2e                     # gitignored — קרדנציאלס של ה-branch
e2e/
  auth.setup.ts              # ensureTestUser → reset → login → שמירת storageState
  tests/
    auth.spec.ts             # התחברות/התנתקות דרך ה-UI (בלי reuse ל-storageState)
    units.spec.ts            # empty-state → הוספה → עריכה → ארכוב → חיפוש
    tenants.spec.ts          # הוספת שוכר + שיוך ליחידה (שכ״ד + אמצעי תשלום) → עריכה → ארכוב
    payments.spec.ts         # סימון שכ״ד כשולם (תווית לפי אמצעי תשלום), תשלום חלקי, דיאלוג סיכום
  support/
    supabase-admin.ts        # service-role client: ensureTestUser, resetTestUserData
    fixtures.ts              # fixtures מותאמים + uniqueName()
  .auth/
    user.json                # storageState (gitignored)
```

## תוכן הטסטים

| קובץ | מכסה |
|---|---|
| `auth.spec.ts` | מדף הנחיתה מוצג ללא משתמש; כניסה דרך הטופס → Dashboard נטען; התנתקות → חזרה לנחיתה. רץ **ללא** `storageState` (`test.use({ storageState: { cookies: [], origins: [] } })`). |
| `units.spec.ts` | מצב ריק ("מתחילים מהיחידה הראשונה"); הוספת יחידה → מופיעה ברשימה; עריכת שם; ארכוב; חיפוש (כשיש >3 יחידות). |
| `tenants.spec.ts` | הוספת שוכר עם שיוך ליחידה, שכ״ד ואמצעי תשלום; השוכר מופיע עם היחידה והשכ״ד; עריכה; ארכוב. |
| `payments.spec.ts` | על tenancy קיים: סימון שכ״ד כשולם — כפתור הסימון נושא תווית לפי אמצעי התשלום (`markPaidLabel`); תשלום חלקי מעדכן יתרה; דיאלוג סיכום התשלומים של שוכר נפתח ומציג נתונים. |

## סלקטורים

מעדיפים סלקטורים נגישים ויציבים, לפי סדר עדיפות:
1. `getByRole` עם שם נגיש (כפתורים, כותרות) — למשל `getByRole('button', { name: 'הוספת יחידה' })`.
2. `getByLabel` / `getByPlaceholder` לשדות טופס.
3. `getByText` לטקסט ייחודי.
4. ניצול `data-guide`/`data-tour` הקיימים לניווט (טאבים, כפתורי הוספה).
5. הוספת `data-testid` **רק** במקומות בודדים שבהם טקסט חוזר/דו-משמעי (למשל כרטיס
   שוכר ספציפי ברשימה). מספר התוספות יישאר מינימלי.

## סקריפטים ו-gitignore

`package.json`:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report",
"dev:e2e": "vite --mode e2e"
```

`.gitignore` (תוספות):
```
.env.e2e
e2e/.auth/
playwright-report/
test-results/
```

## טיפול בשגיאות ומקרי קצה

| מצב | טיפול |
|---|---|
| משתמש הבדיקה לא קיים ב-branch חדש | `ensureTestUser()` יוצר אותו עם `email_confirm: true`. |
| נתונים משאריות ריצה קודמת | `resetTestUserData()` מנקה לפני כל ריצה; שמות ייחודיים מפחיתים התנגשות. |
| ה-branch ריק מ-migrations | ה-branch יורש migrations מה-parent; אם ריק — מריצים אותם על ה-branch כחלק מההקמה. |
| session פג באמצע ריצה | הריצה קצרה (worker יחיד); ה-JWT תקף מספיק. אם יתגלה — לרענן `storageState` ב-setup. |
| טסט שנכשל | trace + screenshot נשמרים; `test:e2e:report` להצגה. |

## מחוץ לתחום

- workflow של CI (GitHub Actions) — המבנה מוכן, אך היישום בהמשך.
- דפדפנים נוספים (Firefox/WebKit) ובדיקות רספונסיביות/מובייל.
- זרימות משניות: איפוס סיסמה, הגדרות התראות, עמודי חוק (תנאים/פרטיות), משוב.
- בדיקות ויזואליות (visual regression).

## אימות שהמערך עובד

1. יצירת ה-branch ומילוי `.env.e2e`.
2. `npm run test:e2e` — כל הסוויטה ירוקה מול ה-branch (ראיה לפני הצהרה).
3. הרצה חוזרת מוודאת דטרמיניזם (ה-reset מחזיר בסיס נקי).

## סיכונים

| סיכון | טיפול |
|---|---|
| service-role key נחשף בטעות | רק ב-`.env.e2e` (gitignored), נטען בצד Node של Playwright בלבד, לעולם לא ב-`VITE_`/דפדפן. |
| טסטים שבירים בגלל תזמון (async/toasts) | ברירת מחדל של Playwright — auto-waiting על סלקטורים; assertions עם `expect(...).toBeVisible()` שממתינים. |
| בידוד RTL/כיווניות בטפסי Radix | הטסטים מריצים את האפליקציה האמיתית עם `DirectionProvider`, כך שהתנהגות זהה לפרודקשן. |
| התנגשות בין הרצות מקבילות | `workers: 1` + `fullyParallel: false` מונעים מרוץ על נתוני המשתמש היחיד. |
