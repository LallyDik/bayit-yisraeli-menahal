# Email Notification Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a landlord opt out of payment-reminder emails — via a one-click unsubscribe link in the email and a toggle on a new `/settings` page — and make `send-payment-reminders` skip anyone opted out.

**Architecture:** A `notification_settings` table (RLS: owner reads/writes only their own row) holds `email_reminders` and a stable `unsubscribe_token`. A no-login `unsubscribe` edge function flips the flag off via the token (service role). The reminder function get-or-creates each owner's row, skips opted-out owners, and adds an unsubscribe link + `List-Unsubscribe` header. The app reads/writes the flag through a hook on a gated `/settings` page reached from a header gear.

**Tech Stack:** React 18 + TS + Vite, react-router-dom v6, react-helmet-async, shadcn/ui (Switch), sonner, Supabase (Postgres + Deno edge functions, `nodemailer`), Vitest (node env).

## Global Constraints

- **Reminders go to the OWNER (landlord)**, fetched via `auth.admin.getUserById(ownerId)` — not to tenants.
- Hebrew, RTL; logical Tailwind props only (`ps-`/`pe-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- Client import path: `import { supabase } from '@/lib/supabase';`.
- `unsubscribe_token` is **stable** (not single-use) and long/random (128 hex). Column default: `replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`.
- RLS on `notification_settings`: owner may `select`/`insert`/`update` only rows where `owner_id = auth.uid()`. The edge functions use the service role (bypass RLS).
- `unsubscribe` edge function: **verify_jwt = false** (token is the credential; no login).
- `send-payment-reminders` currently deploys with **verify_jwt = true** — PRESERVE that on redeploy (do not flip it).
- URLs: `UNSUB_URL = 'https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/unsubscribe'`; the unsubscribe endpoint redirects to `APP_URL = 'https://nihulschirut.com/'`.
- Routes go ABOVE the catch-all `<Route path="*">` in `src/App.tsx`.
- No React unit-test harness (Vitest is node-env, no jsdom/RTL — do NOT add). Verify UI with `npx tsc --noEmit` + `npm run build` + manual. `tsc` checks `src/` only (not Deno files).

---

### Task 1: notification_settings table + RLS test

**Files:**
- Create: `supabase/migrations/20260727120000_notification_settings.sql`
- Create: `tests/notification-settings-rls.test.ts`

**Interfaces:**
- Produces: table `public.notification_settings(owner_id uuid pk, email_reminders boolean, unsubscribe_token text unique, updated_at timestamptz)`. Task 2 reads/writes by `unsubscribe_token`; Task 3 upserts by `owner_id`; Task 4 reads/writes `email_reminders` by `owner_id`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260727120000_notification_settings.sql`:

```sql
-- Per-landlord email preferences. RLS lets each owner read/write only their
-- own row (the settings page uses the anon key with a user JWT). The
-- unsubscribe edge function flips email_reminders off via the service role,
-- looked up by the stable unsubscribe_token.
create table if not exists public.notification_settings (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  email_reminders   boolean not null default true,
  unsubscribe_token text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at        timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "notification_settings_select_own" on public.notification_settings
  for select using (owner_id = auth.uid());
create policy "notification_settings_insert_own" on public.notification_settings
  for insert with check (owner_id = auth.uid());
create policy "notification_settings_update_own" on public.notification_settings
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

- [ ] **Step 2: Write the failing RLS test**

Create `tests/notification-settings-rls.test.ts` (mirrors `tests/rls.test.ts` conventions; helpers in `tests/helpers/auth.ts`):

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signInAs, anonClient } from './helpers/auth';

const PASSWORD = 'test-password-1234';

let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceId: string;

beforeAll(async () => {
  alice = await signInAs('notif-alice@example.com', PASSWORD);
  bob = await signInAs('notif-bob@example.com', PASSWORD);
  const { data } = await alice.auth.getUser();
  aliceId = data.user!.id;
  // Create alice's row (owner_id must equal her uid per RLS).
  await alice.from('notification_settings').upsert({ owner_id: aliceId, email_reminders: true });
});

describe('RLS: notification_settings is per-owner', () => {
  it('owner reads their own row with a default token', async () => {
    const { data } = await alice.from('notification_settings').select('*').eq('owner_id', aliceId).maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.email_reminders).toBe(true);
    expect(typeof data!.unsubscribe_token).toBe('string');
    expect(data!.unsubscribe_token.length).toBeGreaterThan(30);
  });

  it("another user cannot see alice's row", async () => {
    const { data } = await bob.from('notification_settings').select('*').eq('owner_id', aliceId);
    expect(data).toEqual([]);
  });

  it("another user cannot update alice's row — zero rows affected", async () => {
    const { data } = await bob.from('notification_settings')
      .update({ email_reminders: false }).eq('owner_id', aliceId).select();
    expect(data).toEqual([]);
    const { data: still } = await alice.from('notification_settings').select('email_reminders').eq('owner_id', aliceId).maybeSingle();
    expect(still!.email_reminders).toBe(true);
  });

  it('anon cannot insert a row', async () => {
    const { error } = await anonClient().from('notification_settings').insert({ owner_id: aliceId });
    expect(error).not.toBeNull();
  });

  it('a user cannot insert a row owned by someone else', async () => {
    const { error } = await bob.from('notification_settings').insert({ owner_id: aliceId });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/notification-settings-rls.test.ts`
Expected: FAIL — the table does not exist yet (errors about a missing relation; `beforeAll` upsert fails).

- [ ] **Step 4: Apply the migration**

Apply `supabase/migrations/20260727120000_notification_settings.sql` to the hosted project via the Supabase MCP `apply_migration` tool (name `notification_settings`, body = the SQL from Step 1). The tool is pre-scoped to project `lwmddgwwfirkcaqaxdbh` (no project_id param).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/notification-settings-rls.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260727120000_notification_settings.sql tests/notification-settings-rls.test.ts
git commit -m "feat(notifications): notification_settings table with per-owner RLS"
```

---

### Task 2: unsubscribe edge function

**Files:**
- Create: `supabase/functions/unsubscribe/index.ts`

**Interfaces:**
- Consumes: `notification_settings` (Task 1), by `unsubscribe_token`.
- Produces: `GET|POST /functions/v1/unsubscribe?token=<t>`. GET → 303 redirect to `APP_URL?unsubscribed=1` (or `=invalid`); POST → 200. Task 3 links to it; Task 5 handles the `?unsubscribed` redirect in-app.

- [ ] **Step 1: Write the function**

Create `supabase/functions/unsubscribe/index.ts` (mirrors `mark-charge-paid`'s no-login redirect pattern):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

// No logged-in user: the stable unsubscribe_token in the link is the credential.
// Flipping email_reminders off is idempotent, so an old link still works.
const APP_URL = 'https://nihulschirut.com/';

function redirect(status: string) {
  const url = new URL(APP_URL);
  url.searchParams.set('unsubscribed', status);
  return new Response(null, { status: 303, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
}

async function optOut(token: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ email_reminders: false, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('owner_id');
  if (error) { console.error('unsubscribe failed', error); return false; }
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');

  // Gmail one-click (RFC 8058) POSTs to the List-Unsubscribe URL.
  if (req.method === 'POST') {
    if (token) await optOut(token);
    return new Response(null, { status: 200 });
  }

  // Visible link click.
  if (!token) return redirect('invalid');
  const ok = await optOut(token);
  return redirect(ok ? '1' : 'invalid');
});
```

- [ ] **Step 2: Deploy the function**

Deploy via Supabase MCP `deploy_edge_function`: name `unsubscribe`, entrypoint `index.ts`, **verify_jwt `false`**, files = this `index.ts`. No import map needed.

- [ ] **Step 3: Smoke test**

First insert a throwaway token to test against, then hit the endpoint. Using the service role via MCP `execute_sql`:

```sql
insert into public.notification_settings (owner_id, email_reminders, unsubscribe_token)
values ('00000000-0000-0000-0000-000000000000', true, 'smoke-test-token-xyz')
on conflict (owner_id) do update set email_reminders = true;
```

Then:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  "https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/unsubscribe?token=smoke-test-token-xyz"
```

Expected: `303 https://nihulschirut.com/?unsubscribed=1`. Confirm the flag flipped:

```sql
select email_reminders from public.notification_settings where unsubscribe_token = 'smoke-test-token-xyz';
```

Expected: `false`. A bad token → `303 ...?unsubscribed=invalid`. Then clean up:

```sql
delete from public.notification_settings where owner_id = '00000000-0000-0000-0000-000000000000';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/unsubscribe/index.ts
git commit -m "feat(notifications): unsubscribe edge function (token-based, no login)"
```

---

### Task 3: send-payment-reminders respects the preference

**Files:**
- Modify: `supabase/functions/send-payment-reminders/index.ts`

**Interfaces:**
- Consumes: `notification_settings` (Task 1); the `unsubscribe` endpoint (Task 2).
- Produces: reminder emails skip opted-out owners and carry an unsubscribe link + `List-Unsubscribe` header.

- [ ] **Step 1: Add the unsubscribe URL constant**

In `supabase/functions/send-payment-reminders/index.ts`, next to `MARK_PAID_URL` (line ~23), add:

```ts
const UNSUB_URL = 'https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/unsubscribe';
```

- [ ] **Step 2: Thread an unsubscribe link into buildEmail**

Change `buildEmail(rows: Row[])` to `buildEmail(rows: Row[], unsubscribeUrl: string)`. In its returned `html`, replace the final auto-sent footer paragraph:

```html
    <p style="margin:26px 0 0;color:#8A9AA8;font-size:12px;">
      נשלח אוטומטית ממערכת ניהול השכירות. תזכורות אינן נשלחות בשבת ובחגים.
    </p>
```

with:

```html
    <p style="margin:26px 0 6px;color:#8A9AA8;font-size:12px;">
      נשלח אוטומטית ממערכת ניהול השכירות. תזכורות אינן נשלחות בשבת ובחגים.
    </p>
    <p style="margin:0;color:#8A9AA8;font-size:12px;">
      לא רוצים לקבל תזכורות? <a href="${unsubscribeUrl}" style="color:#8A9AA8;">לחצו כאן לביטול</a>.
    </p>
```

- [ ] **Step 3: Skip opted-out owners and pass the token**

In `Deno.serve`, inside the `for (const [ownerId, ownerRows] of byOwner)` loop, right after the `if (!to || to.endsWith('@example.com'))` block, add:

```ts
      // Get-or-create the owner's settings row to read the preference and the
      // stable unsubscribe token. A missing row means opted-in (default true).
      await supabase.from('notification_settings')
        .upsert({ owner_id: ownerId }, { onConflict: 'owner_id', ignoreDuplicates: true });
      const { data: prefs } = await supabase.from('notification_settings')
        .select('email_reminders, unsubscribe_token').eq('owner_id', ownerId).maybeSingle();
      if (prefs && prefs.email_reminders === false) {
        results.push({ ownerId, to, sent: false, reason: 'unsubscribed' });
        continue;
      }
      const unsubscribeUrl = `${UNSUB_URL}?token=${prefs?.unsubscribe_token ?? ''}`;
```

Then change the `buildEmail(rowsWithTokens)` call to `buildEmail(rowsWithTokens, unsubscribeUrl)`, and in the dry-run branch (which also calls buildEmail? it does not — it uses `total`/`subject` from the same call) keep the single call feeding both branches: the existing code does `const { subject, html, total } = buildEmail(rowsWithTokens);` before the dryRun check — update that one call site to pass `unsubscribeUrl`.

- [ ] **Step 4: Add the List-Unsubscribe headers to the send**

In the `transporter!.sendMail({ ... })` call, add a `headers` field:

```ts
      await transporter!.sendMail({
        from: `"ניהול שכירות" <${gmailUser}>`,
        to,
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
```

- [ ] **Step 5: Verify the dry-run path locally is coherent**

There is no local runtime for Deno functions here; rely on the deploy + a dry-run call. Deploy via Supabase MCP `deploy_edge_function`: name `send-payment-reminders`, entrypoint `index.ts`, **verify_jwt `true`** (preserve current), files = `index.ts` + `shabbat.ts` + `deno.json` (the import map for `@hebcal/core`, read from `supabase/functions/deno.json`).

- [ ] **Step 6: Dry-run smoke test**

Trigger a dry run (does not send) for one owner to confirm no crash and that opted-out owners are skipped. Use the reminder secret if set; a dry run still exercises the new query path:

```bash
curl -s "https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/send-payment-reminders?dry=1&force=1" \
  -H "apikey: <ANON_KEY>" -H "x-reminder-secret: <SECRET>" | head -40
```

Expected: JSON with `results[]`; owners with `email_reminders=false` show `"reason":"unsubscribed"`, others show `dryRun:true`. (If you don't have the secret, note it in the report; the code path is still covered by the redeploy + the earlier unit of the unsubscribe function.)

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/send-payment-reminders/index.ts
git commit -m "feat(notifications): reminders skip opted-out owners and carry an unsubscribe link"
```

---

### Task 4: useNotificationSettings hook + Settings page + route

**Files:**
- Create: `src/hooks/useNotificationSettings.ts`
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `notification_settings` (Task 1); `useAuth` for `user`.
- Produces: `useNotificationSettings()` → `{ emailReminders: boolean, loading: boolean, saving: boolean, save: (v: boolean) => Promise<void> }`; route `/settings`.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useNotificationSettings.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function useNotificationSettings() {
  const { user } = useAuth();
  const [emailReminders, setEmailReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase.from('notification_settings').select('email_reminders').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setEmailReminders(data.email_reminders);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (value: boolean) => {
    if (!user) return;
    const prev = emailReminders;
    setSaving(true);
    setEmailReminders(value); // optimistic
    const { error } = await supabase.from('notification_settings')
      .upsert({ owner_id: user.id, email_reminders: value, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) { setEmailReminders(prev); throw error; }
  }, [user, emailReminders]);

  return { emailReminders, loading, saving, save };
}
```

- [ ] **Step 2: Create the Settings page**

Create `src/pages/Settings.tsx`:

```tsx
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const { emailReminders, loading, saving, save } = useNotificationSettings();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const onToggle = async (value: boolean) => {
    try {
      await save(value);
      toast.success(value ? 'תקבלו תזכורות תשלום במייל.' : 'ביטלת קבלת תזכורות תשלום במייל.');
    } catch {
      toast.error('לא הצלחנו לשמור את ההגדרה. נסו שוב.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>הגדרות | ניהול שכירות</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl">ניהול שכירות</span>
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה למערכת
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="font-display text-3xl">הגדרות</h1>
        <p className="mt-1 text-muted-foreground">ניהול ההעדפות של החשבון שלך.</p>
        <Card className="mt-6 rounded-2xl">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <Label htmlFor="email-reminders" className="text-base">תזכורות תשלום במייל</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                קבלת מייל תקופתי על חיובים שהגיע מועדם ועדיין לא סומנו כשולמו.
              </p>
            </div>
            <Switch
              id="email-reminders"
              checked={emailReminders}
              disabled={loading || saving}
              onCheckedChange={onToggle}
              aria-label="קבלת תזכורות תשלום במייל"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
```

- [ ] **Step 3: Register the route**

In `src/App.tsx`, add the import next to the other page imports:

```ts
import Settings from "./pages/Settings";
```

Add the route above the catch-all, with the others:

```tsx
              <Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Then `npm run dev`, sign in, open `/settings`: the toggle reflects your saved state, flipping it shows a toast and persists (reload → same). Open `/settings` while signed out → redirected to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotificationSettings.ts src/pages/Settings.tsx src/App.tsx
git commit -m "feat(settings): /settings page with an email-reminders toggle"
```

---

### Task 5: Header entry + unsubscribe confirmation

**Files:**
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: route `/settings` (Task 4); the `?unsubscribed=` redirect (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Import the icon and navigation**

In `src/pages/Index.tsx`, add `Settings` to the existing `lucide-react` import (the list that includes `LogOut`, `CircleHelp`, …), and add `useNavigate` to the existing `react-router-dom` import that already has `useSearchParams`:

```ts
import { useSearchParams, useNavigate } from 'react-router-dom';
```

Inside the `Index` component, near `const [searchParams, setSearchParams] = useSearchParams();`, add:

```tsx
  const navigate = useNavigate();
```

- [ ] **Step 2: Add the settings gear to the header**

In the header action row (the `<div className="flex flex-wrap items-center gap-2 sm:justify-end">` that holds the "מדריך" button, the email span, and the logout button), add a settings button next to the "מדריך" button:

```tsx
            <Button type="button" variant="outline" size="sm" className="rounded-full border-foreground/15 bg-white/55" onClick={() => navigate('/settings')} aria-label="הגדרות">
              <Settings className="h-4 w-4" />
              הגדרות
            </Button>
```

- [ ] **Step 3: Handle the `?unsubscribed=` confirmation**

Add this effect alongside the other `useEffect`s in `Index` (it runs before the `if (!user) return <LandingPage />` early return, so it fires whether or not the visitor is signed in; the global `Toaster` renders the toast either way):

```tsx
  useEffect(() => {
    const status = searchParams.get('unsubscribed');
    if (!status) return;
    if (status === '1') {
      toast.success('ביטלת קבלת תזכורות תשלום במייל. אפשר להפעיל מחדש בכל עת דרך ההגדרות.');
    } else {
      toast.error('הקישור לביטול אינו תקין.');
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('unsubscribed');
      return next;
    }, { replace: true });
  }, []); // once on mount
```

(`toast` from `sonner` is already imported in `Index.tsx`.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Then `npm run dev`: the header shows a "הגדרות" button that navigates to `/settings`. Visit `/?unsubscribed=1` → success toast + the param is stripped from the URL. Visit `/?unsubscribed=invalid` → error toast.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat(settings): header settings entry and unsubscribe confirmation"
```

---

## Final verification (manual, end-to-end)

- [ ] `npx tsc --noEmit`, `npm test` (incl. the RLS test), `npm run build` all pass.
- [ ] Sign in → header **הגדרות** → `/settings` → toggle off → toast + persists on reload.
- [ ] Trigger a dry-run reminder → the opted-out owner shows `"reason":"unsubscribed"`.
- [ ] Toggle back on → dry-run reminder now includes that owner, with an unsubscribe link.
- [ ] Click the unsubscribe link in a real reminder → lands on the app with the confirmation toast; `/settings` now shows the toggle off.
