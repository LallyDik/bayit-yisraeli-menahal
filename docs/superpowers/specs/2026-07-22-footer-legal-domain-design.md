# פוטר, דפים משפטיים, פידבק ומעבר לדומיין nihulschirut.com

תאריך: 2026-07-22

## מטרה

לתת למערכת נוכחות ציבורית ראויה: פוטר עם קרדיט למפתחת, תנאי שימוש ומדיניות
פרטיות, ערוץ פידבק ממשתמשים, והעברת האתר מכתובת `nihul-schhirut.lovable.app`
לדומיין `nihulschirut.com` — בלי מנוי בתשלום ל־Lovable.

## החלטות מסגרת

| נושא | ההחלטה | הנימוק |
|---|---|---|
| מפעיל השירות | לאה דיקמן | פרילנסרית, אין ישות משפטית נפרדת |
| אחסון | Cloudflare Pages | דומיין + SSL + תעבורה בחינם; DNS, אחסון ומייל במקום אחד |
| מייל על הדומיין | Cloudflare Email Routing | חינם, ומשתלב עם ה־DNS שכבר יעבור ל־Cloudflare |
| נתיב הפידבק | דרך Edge Function | מונע כתיבה ישירה לטבלה מהדפדפן עם ה־anon key |
| מיקום הפוטר | דף נחיתה **וגם** מסך המערכת | הקישורים המשפטיים חייבים להיות נגישים גם למשתמש מחובר |

`nihulschirut.com` כבר נרכש ויש גישה ל־DNS.

---

## חלק א׳ — הקוד באפליקציה

### א.1 רכיב `SiteFooter`

קובץ חדש: `src/components/SiteFooter.tsx`.

מחליף את ה־`<footer>` הקיים ב־`LandingPage.tsx:88-90`, ומתווסף למסך המערכת
ב־`src/pages/Index.tsx` אחרי `</main>` (שם היום אין פוטר כלל).

תוכן, בשלושה חלקים:

1. שורת התיאור הקיימת: `ניהול שכירות — מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.`
2. קישורים: `תנאי שימוש` · `מדיניות פרטיות` · `שליחת משוב` (כפתור שפותח דיאלוג)
3. קרדיט: `פותח על ידי לאה דיקמן` → `https://leahdick-dev.com/`

הקישור לקרדיט: `target="_blank"` ו־`rel="noopener noreferrer"`. **בלי `nofollow`** —
זה קרדיט אמיתי וראוי שייספר כקישור נכנס.

עיצוב: ממשיך את הסגנון הקיים — `border-t px-5 py-8 text-center text-sm text-muted-foreground`,
עם שורת קישורים בפריסת flex שנשברת יפה במובייל.

### א.2 הודעת שלב הפיתוח

ב־`src/components/LandingPage.tsx`, מתחת לכפתורי ה־CTA בהירו (אחרי שורה 56):

> בשלב פיתוח ראשוני — השימוש חינם. פיצ'רים נוספים שייכנסו בהמשך יהיו בתשלום.

טקסט קטן ומעומעם (`text-sm text-foreground/60`), צמוד לכפתור "התחילו עכשיו — בחינם"
כדי שההסתייגות תופיע באותה נשימה עם ההבטחה.

ה־JSON-LD ב־`index.html:44` נשאר `"price": "0"` — זה נכון להיום.

### א.3 דפים משפטיים

ראוטים חדשים ב־`src/App.tsx`, **מעל** ה־catch-all `*`:

```
/terms    → src/pages/Terms.tsx
/privacy  → src/pages/Privacy.tsx
```

רכיב עטיפה משותף `src/components/LegalPage.tsx`: כותרת, קישור חזרה לדף הבית,
`<Helmet>` עם title/canonical/description ייחודיים, אזור תוכן בטיפוגרפיית prose,
ו־`SiteFooter`. כך כל דף תוכן נשאר קצר ומכיל רק את הטקסט שלו.

#### תנאי שימוש — סעיפים נדרשים

1. תיאור השירות ולמי הוא מיועד
2. **מודל תמחור:** השירות ניתן היום ללא תשלום בשלב פיתוח; ייתכנו תקלות, שינויים
   ואובדן זמינות. פיצ'רים עתידיים עשויים להיות בתשלום — בהודעה מראש, ובלי לגבות
   תשלום על פיצ'ר שכבר בשימוש ללא הסכמה מפורשת
3. פתיחת חשבון ואחריות המשתמש על סודיות הסיסמה
4. שימושים אסורים
5. **הבהרה שהמערכת אינה מסמך חשבונאי רשמי ואינה תחליף לייעוץ משפטי, חשבונאי או מס** —
   סעיף מהותי במערכת שמנהלת חיובים כספיים
6. השירות ניתן AS-IS; הגבלת אחריות
7. קניין רוחני
8. סיום שימוש ומחיקת חשבון
9. שינויים בתנאים
10. דין ישראלי וסמכות שיפוט

#### מדיניות פרטיות — סעיפים נדרשים

התוכן נגזר ממה שהקוד באמת עושה, לא מתבנית גנרית:

1. **מי המפעיל** — לאה דיקמן, כתובת ליצירת קשר: `info@nihulschirut.com`
2. **מה נאסף:**
   - כתובת מייל של בעל החשבון (Supabase Auth, או Google Sign-In)
   - נתונים שהמשתמש מזין: שוכרים (שם, טלפון, מייל), יחידות, תקופות שכירות,
     תשלומים, קריאות מונה, הערות
   - קבצים מצורפים ב־Supabase Storage
   - הודעות פידבק
3. **⚠️ אחריות בעל הדירה** — הוא זה שמזין את פרטי השוכרים, ולכן הוא בעל השליטה
   בנתונים ואחראי לכך שיש לו בסיס חוקי להזין אותם ולשלוח להם תזכורות
4. **ספקי משנה:** Supabase (בסיס נתונים, אימות, אחסון קבצים), Google (התחברות),
   Gmail SMTP (שליחת תזכורות), ימות המשיח (מענה טלפוני — `supabase/functions/ivr-payments`),
   Cloudflare (אחסון האתר, CDN, ניתוב מייל)
5. **עוגיות ואחסון מקומי** — session של Supabase ב־localStorage; אין מעקב פרסומי
6. **שמירה ומחיקה** — כמה זמן נשמר מידע וכיצד מבקשים מחיקה
7. **זכויות לפי חוק הגנת הפרטיות** — עיון, תיקון ומחיקה
8. **אבטחה** — RLS ברמת השורה, הצפנה בתעבורה
9. יצירת קשר ותאריך עדכון אחרון

> **הסתייגות:** המסמכים ייכתבו כמסמכים סטנדרטיים ומדויקים טכנית למה שהמערכת עושה,
> אך אינם ייעוץ משפטי. אם המערכת תעבור לגביית תשלום או לקהל רחב — כדאי שעו״ד יעבור עליהם.

> **תלות בסדר הביצוע:** שני המסמכים מפנים ל־`info@nihulschirut.com`. הכתובת נוצרת
> רק בשלב ב.3(5). לכן שלב ה־Email Routing חייב להסתיים לפני שהדפים המשפטיים עולים
> לאוויר על הדומיין החדש — אחרת המסמכים מפנים לכתובת שלא קיימת.

שני הדפים יתווספו ל־`public/sitemap.xml` ויהיו אינדקסביליים.

### א.3.1 היכן מוצג `SiteFooter`

מוצג ב־`LandingPage`, ב־`Index` (משתמש מחובר) ובשני הדפים המשפטיים.
**לא** מוצג ב־`NotFound` — דף 404 נשאר מינימלי בכוונה.

### א.4 פידבק

#### זרימה

```
FeedbackDialog  ──POST──►  submit-feedback  ──┬──► INSERT feedback (service_role)
  הודעה חופשית               (Edge Function)  │
  + מייל (אם לא מחובר)         ולידציה         └──► nodemailer → GMAIL_USER
  + honeypot מוסתר
```

#### מיגרציה

`supabase/migrations/20260722120000_feedback.sql` — טבלת `feedback`:

| עמודה | טיפוס | הערות |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `created_at` | `timestamptz` | `now()` |
| `user_id` | `uuid` | nullable, FK ל־`auth.users` עם `on delete set null` |
| `email` | `text` | nullable — למשתמש לא מחובר |
| `message` | `text` | `not null`, `check (char_length(message) between 1 and 2000)` |
| `page` | `text` | nullable — מאיזה מסך נשלח |
| `user_agent` | `text` | nullable |

**RLS מופעל, ובלי אף policy.** service_role עוקף RLS, ולכן רק ה־Edge Function
ניגשת לטבלה. זו החלטה מכוונת: policy של `insert` ל־anon הופכת את הטבלה ליעד
ספאם לכל מי שמחזיק ב־anon key (שהוא פומבי מעצם הגדרתו).

קריאת הפידבק נעשית דרך דשבורד Supabase ודרך המייל הנשלח.

#### Edge Function

`supabase/functions/submit-feedback/index.ts`:

- CORS preflight
- ולידציה: `message` באורך 1–2000; שדה honeypot חייב להיות ריק
- `user_id` נגזר מה־JWT אם נשלח header של `Authorization`, אחרת `null`
- INSERT עם service_role
- שליחת מייל עם nodemailer דרך `smtp.gmail.com:465` — **אותם secrets קיימים**,
  `GMAIL_USER` ו־`GMAIL_APP_PASSWORD` (בשימוש היום ב־`send-payment-reminders/index.ts:116-117`).
  אין הגדרת secrets חדשה.
- כישלון בשליחת המייל לא יפיל את הבקשה — הרשומה כבר נשמרה, וזה מה שחשוב

#### UI

`src/components/FeedbackDialog.tsx` — Dialog של shadcn:

- `Textarea` עם `maxLength={2000}` ומונה תווים
- שדה מייל **רק כשהמשתמש לא מחובר** (למחובר הכתובת כבר ידועה מה־session)
- שדה honeypot מוסתר מהעין ומקוראי מסך
- מצב שליחה עם `LoaderCircle`, ואז toast הצלחה וסגירה
- כשלון → toast שגיאה, הדיאלוג נשאר פתוח עם הטקסט שהוקלד

---

## חלק ב׳ — דומיין, אחסון ומייל

### ב.1 מקור אמת יחיד ל־URL

קובץ חדש `src/config/site.ts`:

```ts
export const SITE_URL = 'https://nihulschirut.com';
```

כל צרכני ה־URL בצד הלקוח מייבאים ממנו. ה־Edge Functions רצות ב־Deno ומחוץ
ל־build של Vite, ולכן שומרות `APP_URL` משלהן.

### ב.2 קבצים שמשתנים

| קובץ | מה משתנה |
|---|---|
| `src/config/site.ts` | **חדש** |
| `index.html:21,23,31,42` | `og:url`, `og:image`, `twitter:image`, JSON-LD `url` |
| `src/pages/Index.tsx:492-493` | canonical + `og:url` |
| `src/pages/NotFound.tsx:23,26` | canonical + `og:url` |
| `public/sitemap.xml` | דומיין חדש + `/terms` + `/privacy` |
| `public/robots.txt:16` | שורת `Sitemap:` |
| `public/_redirects` | **חדש** — `/* /index.html 200` |
| `supabase/functions/mark-charge-paid/index.ts:16` | `APP_URL` |
| `supabase/functions/send-payment-reminders/index.ts:22` | `APP_URL` |

> `public/_redirects` הוא קריטי. Cloudflare Pages מגישה `index.html` רק לשורש;
> בלי הקובץ, כניסה ישירה ל־`nihulschirut.com/terms` תחזיר 404. Vite מעתיק את
> `public/` אל `dist/` בבנייה, ולכן זה המיקום הנכון.

### ב.3 פעולות בדשבורדים

מבוצעות ידנית על ידי המשתמשת; ההוראות המדויקות ייכתבו בתוכנית היישום.

1. **Cloudflare DNS** — הוספת האתר, קבלת nameservers, החלפתם אצל הרשם.
   ⚠️ אם קיימות רשומות DNS פעילות על הדומיין — להעתיק אותן קודם. החלפת
   nameservers מנתקת כל מה שלא הועתק.
2. **Cloudflare Pages** — חיבור ל־`LallyDik/bayit-yisraeli-menahal`,
   build `npm run build`, output `dist`, ושני משתני סביבה:
   `VITE_SUPABASE_URL` ו־`VITE_SUPABASE_ANON_KEY`. בלעדיהם הבנייה עוברת אבל
   האפליקציה נופלת בטעינה.
3. **דומיין ו־SSL** — הוספת `nihulschirut.com` ו־`www` ב־Pages.
4. **⚠️ Supabase Auth ו־Google OAuth** — הוספת `https://nihulschirut.com`
   ל־Site URL ול־Redirect URLs ב־Supabase, ול־Authorized JavaScript origins
   ב־Google Cloud Console. בלי זה ההתחברות עם Google נשברת בדומיין החדש.
5. **Cloudflare Email Routing** — יצירת `info@nihulschirut.com` והעברה ל־Gmail.
   אחר כך ב־Gmail: הגדרות ← חשבונות ← "שלח דואר בשם", עם קוד האימות שמגיע
   דרך ההעברה.
6. **Search Console** — הוספת הדומיין כנכס והגשת ה־sitemap.

### ב.4 סדר ביצוע

1. Cloudflare Pages על כתובת `*.pages.dev` זמנית — לוודא שהבנייה עוברת ושהאפליקציה עולה
2. עדכון Supabase Auth ו־Google OAuth
3. חיבור הדומיין
4. Email Routing
5. Search Console

הרעיון: אם משהו נשבר, הוא נשבר על כתובת שאף אחד לא מכיר.

### ב.5 הכתובת הישנה

Lovable ממשיכה להגיש את `nihul-schhirut.lovable.app` בחינם. ה־canonical מצביע
לדומיין החדש, ולכן גוגל תאחד את שתיהן תוך שבועות. קישורי "סמן כשולם" במיילים
שכבר נשלחו ממשיכים לעבוד — הם מכילים את הכתובת הישנה, שעדיין חיה.

---

## סיכונים

| סיכון | חומרה | טיפול |
|---|---|---|
| Google Sign-In נשבר בדומיין החדש | גבוהה | שלב 4 לפני חיבור הדומיין; בדיקה ידנית של התחברות אחרי המעבר |
| `/terms` מחזיר 404 בטעינה ישירה | גבוהה | `public/_redirects`; בדיקה ידנית של טעינה ישירה ורענון |
| ספאם לטבלת `feedback` | בינונית | אין policy ל־anon; honeypot; הגבלת אורך |
| משתני סביבה חסרים ב־Pages | בינונית | שלב 1 על `*.pages.dev` חושף את זה לפני שהדומיין מחובר |
| החלפת nameservers מנתקת רשומות קיימות | בינונית | תיעוד הרשומות הקיימות לפני ההחלפה |

## מחוץ לתחום

- מסך ניהול פידבק בתוך האפליקציה (קריאה דרך דשבורד Supabase ומייל)
- גביית תשלום בפועל ומנגנון מנויים
- תרגום הדפים המשפטיים לאנגלית
- הסרת האפליקציה מ־Lovable

## בדיקות

- בדיקות רכיב ל־`SiteFooter` ול־`FeedbackDialog` (ולידציה, מצב שליחה, מצב שגיאה)
- בדיקה שהראוטים `/terms` ו־`/privacy` נטענים ומרנדרים כותרת
- `npm test`, `npx tsc --noEmit`, `npm run build` עוברים
- בדיקה ידנית אחרי העלייה: טעינה ישירה של `/terms`, התחברות עם Google, שליחת פידבק
