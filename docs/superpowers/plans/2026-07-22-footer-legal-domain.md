# Footer, Legal Pages, Feedback and nihulschirut.com Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a public-facing footer with a developer credit, terms and privacy pages, a user feedback channel, and move it from `nihul-schhirut.lovable.app` to `nihulschirut.com` on free Cloudflare Pages hosting.

**Architecture:** A single `SITE_URL` config module replaces eight hardcoded URLs. One shared `SiteFooter` renders on the landing page, the signed-in app, and both legal pages. Feedback never touches the database from the browser — the dialog POSTs to a `submit-feedback` Edge Function that writes with the service role and emails a copy, so the `feedback` table needs no anon-writable RLS policy.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind + shadcn/ui, react-router-dom v6, react-helmet-async, Supabase (Postgres + Deno Edge Functions), Vitest.

## Global Constraints

- **Language and direction:** every user-facing string is Hebrew, the app is RTL. Use logical CSS properties (`ps-`/`pe-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- **Canonical domain:** `https://nihulschirut.com` (no `www`, no trailing slash in the constant).
- **Contact address in legal documents:** `info@nihulschirut.com`.
- **Operator named in legal documents:** לאה דיקמן.
- **Credit link:** `https://leahdick-dev.com/`, text `פותח על ידי לאה דיקמן`, with `target="_blank"` and `rel="noopener noreferrer"`. Do **not** add `rel="nofollow"`.
- **Terms pricing clause:** free today, future features may be paid with advance notice. Do **not** promise never to charge for an existing feature — that commitment was considered and deliberately removed.
- **Hero notice copy, verbatim:** `בשלב פיתוח ראשוני — השימוש חינם. פיצ'רים נוספים שייכנסו בהמשך יהיו בתשלום.`
- **Test environment:** Vitest runs with `environment: 'node'`. There is no jsdom and no React Testing Library in this repo. **Do not add them.** Test pure logic modules only, following `tests/shabbat.test.ts` and `tests/yemot.test.ts`, which import helper modules directly out of `supabase/functions/*/`.
- **Secrets:** reuse the existing `GMAIL_USER` and `GMAIL_APP_PASSWORD` Edge Function secrets. Do not introduce new ones.
- **Verification before each commit:** `npm test` and `npx tsc --noEmit` must pass.

## File Structure

| File | Responsibility |
|---|---|
| `src/config/site.ts` | Single source of truth for the public URL; `SITE_URL` + `absoluteUrl()` |
| `src/components/SiteFooter.tsx` | Shared footer: tagline, legal links, feedback trigger, credit |
| `src/components/LegalPage.tsx` | Layout wrapper for legal documents: heading, back link, Helmet, prose container, footer |
| `src/pages/Terms.tsx` | Terms-of-use copy only |
| `src/pages/Privacy.tsx` | Privacy-policy copy only |
| `src/components/FeedbackDialog.tsx` | Feedback form dialog and its submit call |
| `supabase/functions/submit-feedback/validate.ts` | Pure validation of a feedback payload — unit tested |
| `supabase/functions/submit-feedback/index.ts` | HTTP handler: validate, insert with service role, email a copy |
| `supabase/migrations/20260722120000_feedback.sql` | `feedback` table, RLS on, no policies |
| `public/_redirects` | SPA fallback so deep links resolve on Cloudflare Pages |
| `docs/superpowers/plans/2026-07-22-cloudflare-runbook.md` | Manual dashboard steps (DNS, Pages, Auth, email) |

---

### Task 1: Site URL configuration

**Files:**
- Create: `src/config/site.ts`
- Create: `tests/site-config.test.ts`
- Modify: `src/pages/Index.tsx:492-493`
- Modify: `src/pages/NotFound.tsx:23,26`
- Modify: `index.html:21,23,31,42`

**Interfaces:**
- Consumes: nothing.
- Produces: `SITE_URL: string` (`'https://nihulschirut.com'`, no trailing slash) and `absoluteUrl(path: string): string`. Tasks 3, 4 and 7 import these.

- [ ] **Step 1: Write the failing test**

Create `tests/site-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SITE_URL, absoluteUrl } from '../src/config/site';

// Every canonical, og:url and sitemap entry is built from these, so a stray
// slash here shows up as a duplicate-content signal on every page at once.
describe('site config', () => {
  it('exposes the canonical origin without a trailing slash', () => {
    expect(SITE_URL).toBe('https://nihulschirut.com');
  });

  it('builds an absolute URL from a rooted path', () => {
    expect(absoluteUrl('/terms')).toBe('https://nihulschirut.com/terms');
  });

  it('tolerates a path that is missing its leading slash', () => {
    expect(absoluteUrl('privacy')).toBe('https://nihulschirut.com/privacy');
  });

  it('returns the bare origin with a trailing slash for the home page', () => {
    expect(absoluteUrl('/')).toBe('https://nihulschirut.com/');
  });

  it('never emits a double slash', () => {
    expect(absoluteUrl('//terms')).toBe('https://nihulschirut.com/terms');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/site-config.test.ts`
Expected: FAIL — `Failed to resolve import "../src/config/site"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/config/site.ts`:

```ts
// The public origin. Everything that needs an absolute URL — canonical tags,
// Open Graph, the sitemap — derives it from here, so moving domains is a
// one-line change instead of a search across eight files.
export const SITE_URL = 'https://nihulschirut.com';

/** Joins `path` onto the canonical origin, collapsing any repeated slashes. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/site-config.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Point the signed-in app at the config**

In `src/pages/Index.tsx`, add to the import block near the other `@/` imports:

```ts
import { absoluteUrl } from '@/config/site';
```

Replace lines 492-493:

```tsx
        <link rel="canonical" href="https://nihul-schhirut.lovable.app/" />
        <meta property="og:url" content="https://nihul-schhirut.lovable.app/" />
```

with:

```tsx
        <link rel="canonical" href={absoluteUrl('/')} />
        <meta property="og:url" content={absoluteUrl('/')} />
```

- [ ] **Step 6: Point the 404 page at the config**

Read `src/pages/NotFound.tsx` first to match its existing import style, then add:

```ts
import { absoluteUrl } from '@/config/site';
```

Replace the two template literals on lines 23 and 26 that read
`` `https://nihul-schhirut.lovable.app${location.pathname}` `` with:

```tsx
absoluteUrl(location.pathname)
```

so the canonical becomes `<link rel="canonical" href={absoluteUrl(location.pathname)} />` and the og:url becomes `<meta property="og:url" content={absoluteUrl(location.pathname)} />`.

- [ ] **Step 7: Update the static head tags**

In `index.html`, replace all four occurrences of the old host:

- Line 21: `<meta property="og:url" content="https://nihulschirut.com/" />`
- Line 23: `<meta property="og:image" content="https://nihulschirut.com/og-image.png" />`
- Line 31: `<meta name="twitter:image" content="https://nihulschirut.com/og-image.png" />`
- Line 42: `"url": "https://nihulschirut.com/",`

Leave `"price": "0"` on line 44 as it is — the service is free today.

- [ ] **Step 8: Verify no client-side references remain**

Run: `npx tsc --noEmit && npm test && grep -rn "nihul-schhirut" index.html src/`
Expected: tsc silent, tests pass, and grep prints **nothing** (exit code 1). Occurrences under `supabase/` and `public/` are handled in Task 4.

- [ ] **Step 9: Commit**

```bash
git add src/config/site.ts tests/site-config.test.ts src/pages/Index.tsx src/pages/NotFound.tsx index.html
git commit -m "feat(config): single source of truth for the public site URL"
```

---

### Task 2: SiteFooter and the development-stage notice

**Files:**
- Create: `src/components/SiteFooter.tsx`
- Modify: `src/components/LandingPage.tsx:56` (add notice), `:88-90` (replace footer)
- Modify: `src/pages/Index.tsx` (add footer after `</main>`)

**Interfaces:**
- Consumes: `absoluteUrl` is *not* needed here — legal links are internal router paths.
- Produces: `SiteFooter` — a default-exported-as-named component taking no props. Task 4 renders it inside `LegalPage`; Task 7 adds a feedback button to it.

- [ ] **Step 1: Create the footer component**

Create `src/components/SiteFooter.tsx`:

```tsx
import { Link } from 'react-router-dom';

// Rendered on the landing page, inside the signed-in app and on both legal
// pages, so the terms stay one click away no matter where the visitor is.
export const SiteFooter = () => (
  <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
    <p>ניהול שכירות — מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.</p>

    <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2" aria-label="קישורים משפטיים">
      <Link to="/terms" className="rounded hover:text-foreground hover:underline">תנאי שימוש</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy" className="rounded hover:text-foreground hover:underline">מדיניות פרטיות</Link>
    </nav>

    <p className="mt-4">
      <a
        href="https://leahdick-dev.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded hover:text-foreground hover:underline"
      >
        פותח על ידי לאה דיקמן
      </a>
    </p>
  </footer>
);
```

- [ ] **Step 2: Add the development-stage notice to the hero**

In `src/components/LandingPage.tsx`, directly after the closing `</div>` of the CTA button row (currently line 56, the `<div className="mt-8 flex flex-wrap justify-center gap-3">` block), insert:

```tsx
          <p className="mx-auto mt-4 max-w-md text-sm text-foreground/60">
            בשלב פיתוח ראשוני — השימוש חינם. פיצ'רים נוספים שייכנסו בהמשך יהיו בתשלום.
          </p>
```

It sits under `התחילו עכשיו — בחינם` on purpose: the caveat and the promise are read together.

- [ ] **Step 3: Swap the landing page footer**

Add to the imports at the top of `src/components/LandingPage.tsx`:

```ts
import { SiteFooter } from '@/components/SiteFooter';
```

Replace lines 88-90:

```tsx
    <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
      <p>ניהול שכירות — מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.</p>
    </footer>
```

with:

```tsx
    <SiteFooter />
```

- [ ] **Step 4: Add the footer to the signed-in app**

In `src/pages/Index.tsx`, add to the import block:

```ts
import { SiteFooter } from '@/components/SiteFooter';
```

Then place `<SiteFooter />` immediately after the closing `</main>` tag (currently line 737), before `<TenantPaymentSummaryDialog ... />`.

Leave `src/pages/NotFound.tsx` alone — the 404 page stays minimal by design.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all three succeed. `/terms` and `/privacy` do not exist yet — the links render but 404 until Task 3. That is expected at this checkpoint.

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteFooter.tsx src/components/LandingPage.tsx src/pages/Index.tsx
git commit -m "feat(footer): shared footer with credit and legal links, plus pricing notice"
```

---

### Task 3: Legal pages

**Files:**
- Modify: `tailwind.config.ts:100`
- Create: `src/components/LegalPage.tsx`
- Create: `src/pages/Terms.tsx`
- Create: `src/pages/Privacy.tsx`
- Modify: `src/App.tsx:11-12` (imports), `:32-34` (routes)

**Interfaces:**
- Consumes: `SiteFooter` from Task 2; `absoluteUrl` from Task 1.
- Produces: routes `/terms` and `/privacy`. Task 4 lists both in the sitemap.

- [ ] **Step 1: Register the typography plugin**

`@tailwindcss/typography` is already in `devDependencies` but is not registered, so `prose` classes currently do nothing. In `tailwind.config.ts`, add the import next to the existing `tailwindcssAnimate` import:

```ts
import typography from "@tailwindcss/typography";
```

and change line 100 from `plugins: [tailwindcssAnimate],` to:

```ts
	plugins: [tailwindcssAnimate, typography],
```

- [ ] **Step 2: Create the shared legal layout**

Create `src/components/LegalPage.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import { absoluteUrl } from '@/config/site';

interface LegalPageProps {
  title: string;
  description: string;
  path: string;
  updatedAt: string;
  children: ReactNode;
}

// Both legal documents share this shell so each page file holds nothing but
// its own copy.
export const LegalPage = ({ title, description, path, updatedAt, children }: LegalPageProps) => (
  <div className="flex min-h-screen flex-col bg-background">
    <Helmet>
      <title>{`${title} | ניהול שכירות`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={absoluteUrl(path)} />
      <meta property="og:url" content={absoluteUrl(path)} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </Helmet>

    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
      <span className="font-display text-xl">ניהול שכירות</span>
      <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        חזרה לדף הבית
      </Link>
    </header>

    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">עודכן לאחרונה: {updatedAt}</p>
      <div className="prose prose-slate mt-8 max-w-none prose-headings:font-display prose-headings:text-foreground prose-a:text-primary">
        {children}
      </div>
    </main>

    <SiteFooter />
  </div>
);
```

- [ ] **Step 3: Write the terms page**

Create `src/pages/Terms.tsx`:

```tsx
import { LegalPage } from '@/components/LegalPage';

const Terms = () => (
  <LegalPage
    title="תנאי שימוש"
    description="תנאי השימוש במערכת ניהול השכירות — מודל התמחור, אחריות המשתמש והגבלת אחריות."
    path="/terms"
    updatedAt="22 ביולי 2026"
  >
    <h2>1. השירות</h2>
    <p>
      „ניהול שכירות” היא מערכת מקוונת לניהול נכסים להשכרה: מעקב אחר יחידות, שוכרים,
      תקופות שכירות ותשלומים — שכר דירה, חשמל, מים וגז. השירות מיועד לבעלי דירות
      המנהלים את נכסיהם בעצמם. השימוש בשירות מהווה הסכמה לתנאים אלה.
    </p>

    <h2>2. מודל תמחור</h2>
    <p>
      השירות נמצא בשלב פיתוח ראשוני וניתן כיום ללא תשלום. בשלב זה ייתכנו תקלות,
      שינויים בממשק ובתכולה, וכן אי־זמינות זמנית.
    </p>
    <p>
      פיצ'רים נוספים המתוכננים להיכנס למערכת עשויים להיות בתשלום. תינתן על כך הודעה
      מראש לפני שיופעל חיוב כלשהו.
    </p>

    <h2>3. החשבון שלך</h2>
    <p>
      פתיחת חשבון מחייבת כתובת דוא״ל תקינה. האחריות לשמירת סודיות פרטי הכניסה ולכל
      פעולה שתתבצע בחשבון היא שלך. יש להודיע לנו מיד על חשד לשימוש לא מורשה.
    </p>

    <h2>4. שימושים אסורים</h2>
    <p>אין להשתמש בשירות כדי:</p>
    <ul>
      <li>להעלות תוכן בלתי חוקי, פוגעני או המפר זכויות של צד שלישי;</li>
      <li>לנסות לחדור לחשבונות אחרים או לעקוף מנגנוני אבטחה;</li>
      <li>להעמיס על המערכת בצורה אוטומטית או לשבש את פעילותה;</li>
      <li>להזין פרטי אדם אחר ללא בסיס חוקי לכך.</li>
    </ul>

    <h2>5. המערכת אינה מסמך חשבונאי ואינה ייעוץ</h2>
    <p>
      החישובים, הדוחות והסכומים המוצגים במערכת נועדו לניהול פנימי ולנוחות בלבד.
      <strong>
        {' '}אין בהם משום מסמך חשבונאי רשמי, קבלה, חשבונית או אסמכתא לרשויות המס, ואין
        בהם תחליף לייעוץ משפטי, חשבונאי או מיסויי.
      </strong>{' '}
      האחריות לבדיקת נכונות הנתונים ולעמידה בחובות הדיווח החלות עליך היא שלך בלבד.
    </p>

    <h2>6. אחריות והגבלתה</h2>
    <p>
      השירות ניתן כמות שהוא (AS-IS) וכפי שהוא זמין (AS-AVAILABLE), ללא התחייבות
      לזמינות, לדיוק או להתאמה לצורך מסוים. במידה המרבית המותרת בדין, לא נישא באחריות
      לנזק עקיף, תוצאתי או אובדן רווחים, הכנסות או נתונים הנובעים מהשימוש בשירות או
      מאי־היכולת להשתמש בו. מומלץ לשמור גיבוי עצמאי של נתונים חיוניים.
    </p>

    <h2>7. קניין רוחני</h2>
    <p>
      כל הזכויות במערכת, בקוד, בעיצוב ובתכנים שאינם מוזנים על ידי המשתמשים שמורות
      למפעילת השירות. הנתונים שהזנת נותרים בבעלותך.
    </p>

    <h2>8. סיום השימוש</h2>
    <p>
      ניתן להפסיק את השימוש ולבקש את מחיקת החשבון והנתונים בכל עת, בפנייה לכתובת
      המופיעה למטה. אנו רשאים להשעות חשבון המפר תנאים אלה.
    </p>

    <h2>9. שינויים בתנאים</h2>
    <p>
      תנאים אלה עשויים להתעדכן. תאריך העדכון האחרון מופיע בראש העמוד, ושינוי מהותי
      יובא לידיעת המשתמשים הרשומים.
    </p>

    <h2>10. דין וסמכות שיפוט</h2>
    <p>
      על תנאים אלה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית בכל מחלוקת נתונה
      לבתי המשפט המוסמכים במדינת ישראל.
    </p>

    <h2>11. יצירת קשר</h2>
    <p>
      מפעילת השירות: לאה דיקמן. לפניות: <a href="mailto:info@nihulschirut.com">info@nihulschirut.com</a>
    </p>
  </LegalPage>
);

export default Terms;
```

- [ ] **Step 4: Write the privacy page**

Create `src/pages/Privacy.tsx`:

```tsx
import { LegalPage } from '@/components/LegalPage';

const Privacy = () => (
  <LegalPage
    title="מדיניות פרטיות"
    description="איזה מידע נאסף במערכת ניהול השכירות, למי הוא מועבר, וכיצד מממשים זכות עיון, תיקון ומחיקה."
    path="/privacy"
    updatedAt="22 ביולי 2026"
  >
    <h2>1. מי אנחנו</h2>
    <p>
      מפעילת השירות „ניהול שכירות” היא לאה דיקמן. לכל שאלה בנושא פרטיות:{' '}
      <a href="mailto:info@nihulschirut.com">info@nihulschirut.com</a>
    </p>

    <h2>2. איזה מידע נאסף</h2>
    <ul>
      <li>
        <strong>פרטי החשבון:</strong> כתובת הדוא״ל שלך, ובהתחברות באמצעות Google — גם
        השם וכתובת הדוא״ל המשויכים לחשבון Google.
      </li>
      <li>
        <strong>מידע שאתה מזין:</strong> פרטי שוכרים (שם, טלפון, דוא״ל), יחידות ותיאורן,
        תקופות שכירות, סכומי שכר דירה, תשלומים, קריאות מונה חשמל, מים וגז, והערות חופשיות.
      </li>
      <li>
        <strong>קבצים:</strong> מסמכים שאתה מעלה, כגון חוזי שכירות, הנשמרים באחסון מאובטח.
      </li>
      <li>
        <strong>פניות:</strong> תוכן הודעות משוב שאתה שולח, וכתובת הדוא״ל אם ציינת אותה.
      </li>
    </ul>

    <h2>3. אחריותך כבעל הנכס</h2>
    <p>
      פרטי השוכרים נאספים על ידך ובאחריותך. אתה בעל השליטה במידע זה, ועליך לוודא שיש
      לך בסיס חוקי להחזיק בו, לשמור אותו במערכת ולשלוח על בסיסו תזכורות תשלום. אנו
      פועלים ביחס למידע זה כמי שמעניק לך שירות אחסון ועיבוד בלבד.
    </p>

    <h2>4. למה המידע משמש</h2>
    <p>
      המידע משמש אך ורק להפעלת השירות: הצגת הנתונים שלך, חישוב חיובים, שליחת תזכורות
      תשלום, מענה טלפוני אוטומטי לבירור מצב תשלומים, ומענה לפניותיך. איננו מוכרים מידע
      ואיננו עושים בו שימוש פרסומי.
    </p>

    <h2>5. ספקי שירות</h2>
    <p>לצורך הפעלת השירות אנו נעזרים בספקים הבאים, שכל אחד מהם חשוף רק למידע הדרוש לתפקידו:</p>
    <ul>
      <li><strong>Supabase</strong> — בסיס הנתונים, מנגנון ההתחברות ואחסון הקבצים.</li>
      <li><strong>Google</strong> — התחברות באמצעות חשבון Google, ושליחת הודעות דוא״ל דרך שרתי Gmail.</li>
      <li><strong>ימות המשיח</strong> — מערכת המענה הטלפוני האוטומטי.</li>
      <li><strong>Cloudflare</strong> — אחסון האתר, רשת ההפצה וניתוב הדוא״ל של הדומיין.</li>
    </ul>

    <h2>6. עוגיות ואחסון מקומי</h2>
    <p>
      המערכת שומרת בדפדפן שלך אסימון התחברות (session) כדי שלא תידרש להזדהות מחדש בכל
      כניסה. אין במערכת עוגיות פרסום ואין מעקב אחר גלישה באתרים אחרים.
    </p>

    <h2>7. שמירה ומחיקה</h2>
    <p>
      המידע נשמר כל עוד החשבון פעיל. ניתן למחוק שוכרים, יחידות וקבצים מתוך המערכת בכל
      עת. לבקשת מחיקה מלאה של החשבון וכל הנתונים המשויכים אליו — פנה לכתובת המופיעה
      בסעיף 1, והבקשה תטופל בתוך זמן סביר.
    </p>

    <h2>8. הזכויות שלך</h2>
    <p>
      בהתאם לחוק הגנת הפרטיות, התשמ״א־1981, אתה זכאי לעיין במידע המוחזק עליך, לבקש את
      תיקונו אם אינו נכון, שלם או מעודכן, ולבקש את מחיקתו. לפנייה בעניין זה יש להשתמש
      בכתובת שבסעיף 1.
    </p>

    <h2>9. אבטחת מידע</h2>
    <p>
      התקשורת עם המערכת מוצפנת (HTTPS). הפרדת הנתונים בין המשתמשים נאכפת ברמת בסיס
      הנתונים באמצעות מדיניות הרשאות לכל שורה (Row Level Security), כך שמשתמש אחד אינו
      יכול לגשת לנתוני משתמש אחר. עם זאת, אין מערכת חסינה לחלוטין, ואיננו יכולים
      להתחייב לאבטחה מוחלטת.
    </p>

    <h2>10. שינויים במדיניות</h2>
    <p>
      מדיניות זו עשויה להתעדכן. תאריך העדכון האחרון מופיע בראש העמוד.
    </p>
  </LegalPage>
);

export default Privacy;
```

- [ ] **Step 5: Register the routes**

In `src/App.tsx`, add after the `NotFound` import on line 12:

```ts
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
```

Then add the two routes above the catch-all, so the block reads:

```tsx
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

Then run `npm run dev` and open `http://localhost:8080/terms` and `http://localhost:8080/privacy`. Confirm: the Hebrew headings render RTL, the `prose` spacing is applied (paragraphs are separated, headings are larger — if everything is cramped and unstyled, Step 1 did not take effect), the "חזרה לדף הבית" link returns to `/`, and the footer appears at the bottom of both pages.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts src/components/LegalPage.tsx src/pages/Terms.tsx src/pages/Privacy.tsx src/App.tsx
git commit -m "feat(legal): add terms of use and privacy policy pages"
```

---

### Task 4: Static hosting files and Edge Function URLs

**Files:**
- Create: `public/_redirects`
- Modify: `public/sitemap.xml`
- Modify: `public/robots.txt:16`
- Modify: `supabase/functions/mark-charge-paid/index.ts:16`
- Modify: `supabase/functions/send-payment-reminders/index.ts:22`

**Interfaces:**
- Consumes: routes `/terms` and `/privacy` from Task 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the SPA fallback**

Create `public/_redirects` with exactly this line:

```
/*    /index.html   200
```

Without it, Cloudflare Pages serves `index.html` only at the root and returns a hard 404 for a direct load of `/terms` or `/privacy`. Vite copies everything in `public/` into `dist/`, which is where Cloudflare Pages looks for this file.

- [ ] **Step 2: Rewrite the sitemap**

Replace the whole of `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://nihulschirut.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://nihulschirut.com/terms</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://nihulschirut.com/privacy</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

- [ ] **Step 3: Update robots.txt**

In `public/robots.txt`, change line 16 to:

```
Sitemap: https://nihulschirut.com/sitemap.xml
```

- [ ] **Step 4: Update both Edge Function URLs**

In `supabase/functions/mark-charge-paid/index.ts` line 16 and in `supabase/functions/send-payment-reminders/index.ts` line 22, change each to:

```ts
const APP_URL = 'https://nihulschirut.com/';
```

Keep the trailing slash — both files pass this straight into `new URL(APP_URL)` and then append query parameters.

These constants only affect links in *newly sent* mail. Links in already-delivered reminders keep pointing at the Lovable URL, which stays live, so nothing breaks retroactively.

- [ ] **Step 5: Verify every reference is migrated**

Run: `grep -rn "nihul-schhirut" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .`
Expected: matches appear **only** inside `docs/` (the design spec quotes the old URL as history). No matches in `src/`, `public/`, `index.html` or `supabase/`.

Then run: `npm run build && ls dist/_redirects dist/sitemap.xml`
Expected: build succeeds and both files exist in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add public/_redirects public/sitemap.xml public/robots.txt supabase/functions/mark-charge-paid/index.ts supabase/functions/send-payment-reminders/index.ts
git commit -m "feat(domain): point sitemap, robots and email links at nihulschirut.com"
```

---

### Task 5: Feedback table migration

**Files:**
- Create: `supabase/migrations/20260722120000_feedback.sql`
- Create: `tests/feedback-rls.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: table `public.feedback` with columns `id, created_at, user_id, email, message, page, user_agent`. Task 6 inserts into it with the service role.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260722120000_feedback.sql`:

```sql
-- User feedback submitted from the footer dialog.
--
-- RLS is enabled with no policies at all, which denies every request that
-- carries a user or anon JWT. That is deliberate: the anon key ships in the
-- browser bundle, so an insert policy for anon would hand anyone on the
-- internet a write endpoint into this table. The submit-feedback Edge Function
-- writes here with the service role, which bypasses RLS, and validates first.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  message     text not null,
  page        text,
  user_agent  text,
  constraint feedback_message_length check (char_length(message) between 1 and 2000)
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
```

- [ ] **Step 2: Write the failing test**

Create `tests/feedback-rls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { anonClient, signInAs } from './helpers/auth';

const PASSWORD = 'test-password-1234';

// The whole point of routing feedback through an Edge Function is that no
// browser-held key can touch this table. If a policy is ever added by mistake,
// these tests are what catches it.
describe('RLS: feedback is closed to browser keys', () => {
  it('rejects an insert from an anonymous client', async () => {
    const { error } = await anonClient()
      .from('feedback')
      .insert({ message: 'anon should not get in' });
    expect(error).not.toBeNull();
  });

  it('rejects an insert from a signed-in user', async () => {
    const user = await signInAs('feedback-probe@example.com', PASSWORD);
    const { error } = await user
      .from('feedback')
      .insert({ message: 'authenticated should not get in either' });
    expect(error).not.toBeNull();
  });

  it('returns no rows to a signed-in user', async () => {
    const user = await signInAs('feedback-probe@example.com', PASSWORD);
    const { data } = await user.from('feedback').select('*');
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/feedback-rls.test.ts`
Expected: FAIL — the table does not exist yet, so the errors returned mention a missing relation rather than a policy violation, and the third assertion fails because `data` is `null`.

- [ ] **Step 4: Apply the migration**

Apply `supabase/migrations/20260722120000_feedback.sql` to the hosted project. Use the `apply_migration` Supabase MCP tool with name `feedback` and the SQL body from Step 1, or paste it into the SQL editor in the Supabase dashboard.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/feedback-rls.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260722120000_feedback.sql tests/feedback-rls.test.ts
git commit -m "feat(feedback): add feedback table with RLS closed to browser keys"
```

---

### Task 6: submit-feedback Edge Function

**Files:**
- Create: `supabase/functions/submit-feedback/validate.ts`
- Create: `tests/feedback-validate.test.ts`
- Create: `supabase/functions/submit-feedback/index.ts`

**Interfaces:**
- Consumes: the `feedback` table from Task 5; the `GMAIL_USER` / `GMAIL_APP_PASSWORD` secrets already used by `send-payment-reminders`.
- Produces: `POST /functions/v1/submit-feedback` accepting JSON
  `{ message: string; email?: string; page?: string; website?: string }`
  and returning `{ ok: true }` on success or `{ error: string }` with status 400 or 500.
  `website` is the honeypot. Task 7's dialog posts exactly this shape.

- [ ] **Step 1: Write the failing test**

Create `tests/feedback-validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateFeedback } from '../supabase/functions/submit-feedback/validate';

// validateFeedback returns a discriminated union, so the accepted-shape fields
// are only reachable after narrowing. This does the narrowing once and fails
// loudly if a case that should pass validation does not.
const accepted = (input: Record<string, unknown>) => {
  const result = validateFeedback(input);
  if (!result.ok) throw new Error(`expected acceptance, got: ${result.error}`);
  return result;
};

describe('validateFeedback', () => {
  it('accepts a normal message', () => {
    expect(validateFeedback({ message: 'הכפתור של התשלומים לא נטען' }))
      .toEqual({ ok: true, message: 'הכפתור של התשלומים לא נטען', email: null, page: null });
  });

  it('trims surrounding whitespace', () => {
    expect(validateFeedback({ message: '  יש באג  ' }))
      .toEqual({ ok: true, message: 'יש באג', email: null, page: null });
  });

  it('rejects a missing message', () => {
    expect(validateFeedback({})).toEqual({ ok: false, error: 'message is required' });
  });

  it('rejects a message that is only whitespace', () => {
    expect(validateFeedback({ message: '   ' })).toEqual({ ok: false, error: 'message is required' });
  });

  it('rejects a message over 2000 characters', () => {
    expect(validateFeedback({ message: 'x'.repeat(2001) })).toEqual({ ok: false, error: 'message is too long' });
  });

  it('accepts a message of exactly 2000 characters', () => {
    const result = validateFeedback({ message: 'x'.repeat(2000) });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-string message', () => {
    expect(validateFeedback({ message: 42 })).toEqual({ ok: false, error: 'message is required' });
  });

  // A bot fills every field it finds; a human never sees this one.
  it('rejects a filled honeypot', () => {
    expect(validateFeedback({ message: 'hello', website: 'http://spam.example' }))
      .toEqual({ ok: false, error: 'rejected' });
  });

  it('ignores an empty honeypot', () => {
    expect(validateFeedback({ message: 'hello', website: '' }).ok).toBe(true);
  });

  it('keeps a plausible email and drops a malformed one', () => {
    expect(accepted({ message: 'hi', email: 'a@b.co' }).email).toBe('a@b.co');
    expect(accepted({ message: 'hi', email: 'not-an-email' }).email).toBeNull();
  });

  it('truncates an overlong page value rather than rejecting the message', () => {
    expect(accepted({ message: 'hi', page: '/'.repeat(500) }).page).toHaveLength(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/feedback-validate.test.ts`
Expected: FAIL — `Failed to resolve import ".../submit-feedback/validate"`.

- [ ] **Step 3: Write the validator**

Create `supabase/functions/submit-feedback/validate.ts`:

```ts
// Pure input validation, kept in its own module so it can be unit tested with
// Vitest without booting Deno — the same split as shabbat.ts and yemot.ts.

export const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 200;

export type FeedbackValidation =
  | { ok: true; message: string; email: string | null; page: string | null }
  | { ok: false; error: string };

export function validateFeedback(input: Record<string, unknown>): FeedbackValidation {
  // Bots fill every input they can find. This one is hidden from humans, so
  // anything in it means the submission is automated.
  const honeypot = input.website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: false, error: 'rejected' };
  }

  const raw = input.message;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'message is required' };
  }

  const message = raw.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: 'message is too long' };
  }

  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

  // A wrong page value is not worth losing the feedback over, so clamp it.
  const rawPage = typeof input.page === 'string' ? input.page.trim() : '';
  const page = rawPage === '' ? null : rawPage.slice(0, MAX_PAGE_LENGTH);

  return { ok: true, message, email, page };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/feedback-validate.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write the handler**

Create `supabase/functions/submit-feedback/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { validateFeedback } from './validate.ts';

// Feedback is written here with the service role rather than from the browser:
// the feedback table has RLS on and no policies, so the anon key that ships in
// the client bundle cannot reach it. Validation happens before the insert.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const validated = validateFeedback(body);
  if (!validated.ok) {
    // The honeypot answers 200 so a bot cannot tell it was caught.
    if (validated.error === 'rejected') return json({ ok: true });
    return json({ error: validated.error }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Identify the sender from their JWT when there is one; anonymous feedback
  // from the landing page is still accepted.
  let userId: string | null = null;
  let userEmail: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    userId = data.user?.id ?? null;
    userEmail = data.user?.email ?? null;
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    email: validated.email ?? userEmail,
    message: validated.message,
    page: validated.page,
    user_agent: req.headers.get('User-Agent')?.slice(0, 500) ?? null,
  });
  if (error) {
    console.error('feedback insert failed', error);
    return json({ error: 'could not save feedback' }, 500);
  }

  // The row is already safe. A mail failure must not turn a saved submission
  // into an error the user sees and retries.
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });
    try {
      await transporter.sendMail({
        from: `"ניהול שכירות" <${gmailUser}>`,
        to: gmailUser,
        replyTo: validated.email ?? userEmail ?? undefined,
        subject: 'משוב חדש מהמערכת',
        text: [
          validated.message,
          '',
          `מאת: ${validated.email ?? userEmail ?? 'לא צוין'}`,
          `מסך: ${validated.page ?? 'לא צוין'}`,
        ].join('\n'),
      });
    } catch (e) {
      console.error('feedback mail failed', e);
    } finally {
      transporter.close?.();
    }
  }

  return json({ ok: true });
});
```

- [ ] **Step 6: Deploy and smoke test**

Deploy the function (Supabase MCP `deploy_edge_function` with name `submit-feedback`, or `supabase functions deploy submit-feedback`).

Then, substituting your project ref and anon key:

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/submit-feedback" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"message":"בדיקת שליחה","page":"/"}'
```

Expected: `{"ok":true}`. Then confirm the row landed:

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/submit-feedback" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"message":""}'
```

Expected: HTTP 400 with `{"error":"message is required"}`.

Check the `feedback` table in the Supabase dashboard: exactly one row, and a mail arrived at the `GMAIL_USER` inbox.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/submit-feedback tests/feedback-validate.test.ts
git commit -m "feat(feedback): add submit-feedback edge function with validated input"
```

---

### Task 7: FeedbackDialog and footer wiring

**Files:**
- Create: `src/components/FeedbackDialog.tsx`
- Modify: `src/components/SiteFooter.tsx`

**Interfaces:**
- Consumes: the `submit-feedback` endpoint from Task 6; `SiteFooter` from Task 2; `useAuth` from `@/hooks/useAuth`; the Supabase client from `@/integrations/supabase/client` — **open that file first and match the exported name it actually uses** before writing the import.
- Produces: `FeedbackDialog` with props `{ open: boolean; onOpenChange: (open: boolean) => void }`.

- [ ] **Step 1: Confirm the Supabase client export**

Run: `grep -rn "export" src/integrations/supabase/client.ts`
Note the exported identifier and use it in the next step instead of guessing.

- [ ] **Step 2: Create the dialog**

Create `src/components/FeedbackDialog.tsx`, replacing the client import on line 4 with whatever Step 1 reported:

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX_LENGTH = 2000;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim() === '') return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('submit-feedback', {
        body: {
          message,
          email: user ? undefined : email,
          page: `${window.location.pathname}${window.location.search}`,
          website,
        },
      });
      if (error) throw error;
      toast.success('תודה! המשוב נשלח.');
      setMessage('');
      setEmail('');
      onOpenChange(false);
    } catch {
      // The dialog stays open with the typed text intact so nothing is lost.
      toast.error('לא הצלחנו לשלוח את המשוב. נסו שוב.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">שליחת משוב</DialogTitle>
          <DialogDescription>
            מה עובד, מה חסר ומה מעצבן? כל הערה עוזרת.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-message">ההודעה שלך</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_LENGTH}
              required
              rows={5}
              placeholder="כתבו כאן..."
            />
            <p className="text-end text-xs text-muted-foreground">{message.length} / {MAX_LENGTH}</p>
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="feedback-email">כתובת מייל (לא חובה)</Label>
              <Input
                id="feedback-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="כדי שנוכל לחזור אליכם"
              />
            </div>
          )}

          {/* Honeypot: hidden from people and from screen readers, visible to bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="feedback-website">Website</label>
            <input
              id="feedback-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={sending} aria-busy={sending}>
            {sending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {sending ? 'שולח...' : 'שליחה'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 3: Add the trigger to the footer**

Rewrite `src/components/SiteFooter.tsx` to hold the dialog state:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FeedbackDialog } from '@/components/FeedbackDialog';

// Rendered on the landing page, inside the signed-in app and on both legal
// pages, so the terms stay one click away no matter where the visitor is.
export const SiteFooter = () => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <footer className="border-t px-5 py-8 text-center text-sm text-muted-foreground">
      <p>ניהול שכירות — מערכת לניהול נכסים, שוכרים ותשלומים לבעלי דירות.</p>

      <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2" aria-label="קישורים משפטיים">
        <Link to="/terms" className="rounded hover:text-foreground hover:underline">תנאי שימוש</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="rounded hover:text-foreground hover:underline">מדיניות פרטיות</Link>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="rounded hover:text-foreground hover:underline"
          onClick={() => setFeedbackOpen(true)}
        >
          שליחת משוב
        </button>
      </nav>

      <p className="mt-4">
        <a
          href="https://leahdick-dev.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded hover:text-foreground hover:underline"
        >
          פותח על ידי לאה דיקמן
        </a>
      </p>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </footer>
  );
};
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

Then `npm run dev` and, **signed out** on `/`: open the dialog from the footer, confirm the optional email field is visible, send a message, and confirm the success toast. Sign in and repeat from the app footer — the email field must now be absent. Confirm both rows arrived in the `feedback` table with `user_id` null for the first and populated for the second.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedbackDialog.tsx src/components/SiteFooter.tsx
git commit -m "feat(feedback): footer dialog for sending feedback"
```

---

### Task 8: Cloudflare deployment runbook

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-cloudflare-runbook.md`

**Interfaces:**
- Consumes: `public/_redirects` from Task 4.
- Produces: nothing in code. These steps are performed by hand in third-party dashboards and cannot be automated from this repo.

- [ ] **Step 1: Write the runbook**

Create `docs/superpowers/plans/2026-07-22-cloudflare-runbook.md` containing the ordered steps below, each with a checkbox. Order matters: the site is proved on a throwaway URL before the real domain points at it.

1. **Record existing DNS.** In the current registrar's DNS panel, screenshot or copy every existing record for `nihulschirut.com`. Switching nameservers drops anything not recreated at Cloudflare.
2. **Add the site to Cloudflare.** Cloudflare dashboard → Add a site → `nihulschirut.com` → Free plan. Copy the two nameservers it issues and set them at the registrar. Propagation is usually minutes, up to 24 hours.
3. **Create the Pages project.** Workers & Pages → Create → Pages → Connect to Git → repository `LallyDik/bayit-yisraeli-menahal`, production branch `main`. Framework preset: Vite. Build command `npm run build`. Output directory `dist`.
4. **Set the build environment variables.** In the Pages project → Settings → Environment variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the values from the local `.env`, for the Production environment. Without them the build still succeeds but the app throws on load.
5. **Verify on the temporary URL.** Open the `*.pages.dev` URL. Check: the landing page renders; a **direct** load of `<url>/terms` returns the page rather than a 404 (this proves `public/_redirects` shipped); email/password sign-in works.
6. **Enable Email Routing — before the domain goes live.** Cloudflare → Email → Email Routing → enable (it adds the MX and SPF records) → create address `info@nihulschirut.com` forwarding to the Gmail account → confirm the verification mail. Send a test message to `info@nihulschirut.com` and confirm it arrives. This only needs the nameservers from step 2, not the Pages domain. **It must be done before step 9**: both legal pages print `info@nihulschirut.com` as the contact address, and publishing a document that names an address which bounces is worse than publishing nothing.
7. **Let Gmail send as the new address.** Gmail → Settings → Accounts and Import → "Send mail as" → add `info@nihulschirut.com`. The confirmation code arrives via the forwarding rule from step 6.
8. **Update Supabase Auth.** Supabase dashboard → Authentication → URL Configuration: set Site URL to `https://nihulschirut.com` and add both `https://nihulschirut.com/**` and the `*.pages.dev` URL to Redirect URLs.
9. **Update Google OAuth.** Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 client used by Supabase → add `https://nihulschirut.com` to Authorized JavaScript origins. Leave the existing Supabase callback URL in place. Skipping this breaks Google sign-in on the new domain — it is the most common failure in this migration.
10. **Attach the custom domain.** Pages project → Custom domains → add `nihulschirut.com` and `www.nihulschirut.com`. Cloudflare creates the DNS records and issues the certificate automatically. Then add a Redirect Rule sending `www` to the apex.
11. **Verify on the real domain.** Load `https://nihulschirut.com`, then `https://nihulschirut.com/terms` directly, then sign in **with Google**, then send a feedback message, then click the `info@nihulschirut.com` link on the privacy page and confirm a message to it arrives.
12. **Search Console.** Add `nihulschirut.com` as a property, verify it (the existing `google-site-verification` meta tag in `index.html` is served on the new domain too), and submit `https://nihulschirut.com/sitemap.xml`.

Note under the list: `nihul-schhirut.lovable.app` keeps working on the free Lovable tier. The canonical tags now point at the new domain, so Google consolidates the two over a few weeks, and "mark paid" links in already-sent reminder emails keep resolving.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-22-cloudflare-runbook.md
git commit -m "docs: runbook for the Cloudflare Pages and domain migration"
```

---

## Final verification

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no errors
- [ ] `npm run build` — succeeds, and `dist/_redirects` exists
- [ ] `grep -rn "nihul-schhirut" src/ public/ index.html supabase/` — no matches
- [ ] Direct load of `/terms` and `/privacy` works on the deployed site
- [ ] Google sign-in works on `nihulschirut.com`
- [ ] A feedback message reaches both the `feedback` table and the inbox
