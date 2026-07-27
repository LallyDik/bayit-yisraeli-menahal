# Billing-Timing Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two per-landlord timing knobs on `/settings`: how many days BEFORE a charge's due date it appears as "due" in the app, and how many days AFTER the due date the reminder email is sent.

**Architecture:** Two columns on the existing `notification_settings` row (`open_days_before` default 3, `reminder_offset_days` default 0). A pure `addDaysISO` date helper. `useNotificationSettings` reads/saves all fields; `/settings` gets a timing section; `Index.tsx`'s due filter shifts by `open_days_before`; `send-payment-reminders` holds each owner's charges until `reminder_offset_days` past due.

**Tech Stack:** React 18 + TS + Vite, Supabase (Postgres + Deno edge functions), Vitest (node env).

## Global Constraints

- Store on `notification_settings` (one row per owner). `open_days_before` default **3**, `reminder_offset_days` default **0**; each `integer`, range **0–30** (DB `check`).
- Missing settings row → defaults (3 / 0), consistent with the column defaults.
- `open_days_before` affects ONLY which charges display as "due" in the overview — NOT charge creation/materialization, NOT the mark-paid action.
- `reminder_offset_days` only DELAYS reminders (filter is a subset of `due_date <= today`); never sends earlier.
- Hebrew, RTL; logical Tailwind props only (`ps-`/`pe-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- `src/types/database.ts` edited BY HAND (no regeneration).
- `send-payment-reminders` redeploys with **verify_jwt = true** (preserve) and the `deno.json` import map (for `@hebcal/core` via `shabbat.ts`). Edge functions can't import from `src/`; the date math is duplicated inline there.
- No React unit-test harness (node-env Vitest, no jsdom/RTL — do NOT add). Only `addDaysISO` is unit-tested; UI via `tsc` + `build` + manual.

---

### Task 1: columns + types

**Files:**
- Create: `supabase/migrations/20260727140000_billing_timing_settings.sql`
- Modify: `src/types/database.ts` (the `notification_settings` block)

**Interfaces:**
- Produces: `notification_settings.open_days_before` (int, default 3) and `.reminder_offset_days` (int, default 0), and those fields on the generated `notification_settings` Row/Insert/Update types.

- [ ] **Step 1: Migration**

Create `supabase/migrations/20260727140000_billing_timing_settings.sql`:

```sql
-- Per-landlord timing: how many days before due a charge shows as "due" in the
-- app, and how many days after due the reminder email goes out. Additive; the
-- existing notification_settings RLS covers the new columns.
alter table public.notification_settings
  add column if not exists open_days_before integer not null default 3
    check (open_days_before between 0 and 30),
  add column if not exists reminder_offset_days integer not null default 0
    check (reminder_offset_days between 0 and 30);
```

- [ ] **Step 2: Apply**

Apply via Supabase MCP `apply_migration` (name `billing_timing_settings`, body = the SQL). Pre-scoped to `lwmddgwwfirkcaqaxdbh`.

- [ ] **Step 3: Types**

In `src/types/database.ts`, in the `notification_settings` table block, add to each shape (next to `email_reminders`):
- Row: `open_days_before: number` and `reminder_offset_days: number`
- Insert: `open_days_before?: number` and `reminder_offset_days?: number`
- Update: `open_days_before?: number` and `reminder_offset_days?: number`

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add supabase/migrations/20260727140000_billing_timing_settings.sql src/types/database.ts
git commit -m "feat(settings): add open_days_before + reminder_offset_days columns"
```

---

### Task 2: addDaysISO date helper

**Files:**
- Modify: `src/utils/date.ts`
- Create: `tests/date.test.ts`

**Interfaces:**
- Produces: `addDaysISO(iso: string, n: number): string` — the `YYYY-MM-DD` date `n` days after `iso` (n may be negative). Tasks 4 uses it; Task 5 duplicates the logic in Deno.

- [ ] **Step 1: Failing test**

Create `tests/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDaysISO } from '../src/utils/date';

describe('addDaysISO', () => {
  it('adds days', () => { expect(addDaysISO('2026-07-27', 3)).toBe('2026-07-30'); });
  it('subtracts days', () => { expect(addDaysISO('2026-07-27', -2)).toBe('2026-07-25'); });
  it('zero is identity', () => { expect(addDaysISO('2026-07-27', 0)).toBe('2026-07-27'); });
  it('crosses a month', () => { expect(addDaysISO('2026-07-30', 3)).toBe('2026-08-02'); });
  it('crosses a year', () => { expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01'); });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/date.test.ts`
Expected: FAIL — `addDaysISO` not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/date.ts`:

```ts
/** The YYYY-MM-DD date `n` days after `iso` (n may be negative). Noon anchor
 *  avoids DST edge cases shifting the calendar day. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/date.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/date.ts tests/date.test.ts
git commit -m "feat(date): addDaysISO helper"
```

---

### Task 3: useNotificationSettings + /settings timing section

**Files:**
- Modify: `src/hooks/useNotificationSettings.ts`
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: the new columns (Task 1).
- Produces: `useNotificationSettings()` returns `{ emailReminders: boolean, openDaysBefore: number, reminderOffsetDays: number, loading: boolean, saving: boolean, save: (patch: { email_reminders?: boolean; open_days_before?: number; reminder_offset_days?: number }) => Promise<void> }`. Task 4 reads `openDaysBefore`.

- [ ] **Step 1: Rewrite the hook**

Replace `src/hooks/useNotificationSettings.ts` with:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Settings = { email_reminders: boolean; open_days_before: number; reminder_offset_days: number };
const DEFAULTS: Settings = { email_reminders: true, open_days_before: 3, reminder_offset_days: 0 };

export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    supabase.from('notification_settings')
      .select('email_reminders, open_days_before, reminder_offset_days')
      .eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setSettings({
          email_reminders: data.email_reminders,
          open_days_before: data.open_days_before,
          reminder_offset_days: data.reminder_offset_days,
        });
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (patch: Partial<Settings>) => {
    if (!user) return;
    const prev = settings;
    setSaving(true);
    setSettings((s) => ({ ...s, ...patch })); // optimistic
    const { error } = await supabase.from('notification_settings')
      .upsert({ owner_id: user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) { setSettings(prev); throw error; }
  }, [user, settings]);

  return {
    emailReminders: settings.email_reminders,
    openDaysBefore: settings.open_days_before,
    reminderOffsetDays: settings.reminder_offset_days,
    loading, saving, save,
  };
}
```

- [ ] **Step 2: Update Settings.tsx — the existing toggle call**

In `src/pages/Settings.tsx`, the `onToggle` currently calls `await save(value)`. Change it to:

```tsx
      await save({ email_reminders: value });
```

Also pull the new fields from the hook:

```tsx
  const { emailReminders, openDaysBefore, reminderOffsetDays, loading, saving, save } = useNotificationSettings();
```

- [ ] **Step 3: Add the timing section**

In `src/pages/Settings.tsx`, add a handler and a second card after the existing email-reminders `Card`. Add this handler next to `onToggle`:

```tsx
  const onNumber = async (field: 'open_days_before' | 'reminder_offset_days', raw: string) => {
    const n = Math.max(0, Math.min(30, Math.round(Number(raw) || 0)));
    try { await save({ [field]: n }); } catch { toast.error('לא הצלחנו לשמור את ההגדרה. נסו שוב.'); }
  };
```

And after the email `Card` (before `</main>`), add:

```tsx
        <Card className="mt-4 rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="font-display text-lg">תזמון</h2>
              <p className="text-sm text-muted-foreground">שליטה על מתי חיובים נפתחים לסימון ומתי נשלחת התזכורת.</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="open-days" className="text-base">פתיחת חיוב לסימון</Label>
                <p className="mt-1 text-sm text-muted-foreground">כמה ימים לפני מועד התשלום החיוב מופיע כ„לתשלום”.</p>
              </div>
              <Input id="open-days" type="number" min={0} max={30} className="w-20 text-center ltr"
                defaultValue={openDaysBefore} disabled={loading || saving}
                onBlur={(e) => onNumber('open_days_before', e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="reminder-offset" className="text-base">שליחת תזכורת</Label>
                <p className="mt-1 text-sm text-muted-foreground">כמה ימים אחרי מועד התשלום נשלחת התזכורת (0 = ביום התשלום).</p>
              </div>
              <Input id="reminder-offset" type="number" min={0} max={30} className="w-20 text-center ltr"
                defaultValue={reminderOffsetDays} disabled={loading || saving}
                onBlur={(e) => onNumber('reminder_offset_days', e.target.value)} />
            </div>
          </CardContent>
        </Card>
```

Add `Input` to the imports: `import { Input } from '@/components/ui/input';`.

Note: the number inputs use `defaultValue` + `onBlur` (uncontrolled) so a save fires when the field loses focus, not on every keystroke. Because `defaultValue` only seeds the initial render, add `key={`open-${loading}`}` / `key={`offset-${loading}`}` to each `Input` so it re-seeds once the fetched value arrives (loading flips false).

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm test && npm run build` (all pass). Then `npm run dev`, sign in, `/settings`: the two number fields show 3 and 0 (or saved values); change one, blur, reload → persists.

```bash
git add src/hooks/useNotificationSettings.ts src/pages/Settings.tsx
git commit -m "feat(settings): timing section (charge-open window + reminder offset)"
```

---

### Task 4: Index due filter shifts by open_days_before

**Files:**
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `useNotificationSettings().openDaysBefore` (Task 3); `addDaysISO` (Task 2).

- [ ] **Step 1: Wire the hook + helper**

In `src/pages/Index.tsx`, add imports:

```ts
import { addDaysISO } from '@/utils/date';   // (localDateISO is already imported from here)
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
```

(If `localDateISO` is imported as `import { localDateISO } from '@/utils/date';`, change it to `import { localDateISO, addDaysISO } from '@/utils/date';` instead of adding a second line.)

Inside the `Index` component, near the other hook calls, add:

```tsx
  const { openDaysBefore } = useNotificationSettings();
```

- [ ] **Step 2: Shift the due threshold**

Find `dueActiveCharges`:

```tsx
  const dueActiveCharges = useMemo(() => {
    const today = localDateISO();
    return displayCharges.filter((charge) => activeTenancyIds.has(charge.tenancy_id) && charge.due_date <= today);
  }, [activeTenancyIds, displayCharges]);
```

Replace with:

```tsx
  const dueActiveCharges = useMemo(() => {
    const threshold = addDaysISO(localDateISO(), openDaysBefore);
    return displayCharges.filter((charge) => activeTenancyIds.has(charge.tenancy_id) && charge.due_date <= threshold);
  }, [activeTenancyIds, displayCharges, openDaysBefore]);
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm test && npm run build` (all pass). Then `npm run dev`: with `open_days_before = 3`, a charge whose due date is 2 days out appears in the "due" totals/preview on the overview; set it to 0 and it no longer does until the due date.

```bash
git add src/pages/Index.tsx
git commit -m "feat(overview): charges open for marking open_days_before days early"
```

---

### Task 5: reminder offset in send-payment-reminders

**Files:**
- Modify: `supabase/functions/send-payment-reminders/index.ts`

**Interfaces:**
- Consumes: `notification_settings.reminder_offset_days` (Task 1).

- [ ] **Step 1: Read the offset + filter the owner's charges**

In `supabase/functions/send-payment-reminders/index.ts`, the per-owner loop already fetches prefs:

```ts
      const { data: prefs } = await supabase.from('notification_settings')
        .select('email_reminders, unsubscribe_token').eq('owner_id', ownerId).maybeSingle();
      if (prefs && prefs.email_reminders === false) {
        results.push({ ownerId, to, sent: false, reason: 'unsubscribed' });
        continue;
      }
      const unsubscribeUrl = `${UNSUB_URL}?token=${prefs?.unsubscribe_token ?? ''}`;
```

Change the select to include the offset, and after the unsubscribed check add an offset filter:

```ts
      const { data: prefs } = await supabase.from('notification_settings')
        .select('email_reminders, unsubscribe_token, reminder_offset_days').eq('owner_id', ownerId).maybeSingle();
      if (prefs && prefs.email_reminders === false) {
        results.push({ ownerId, to, sent: false, reason: 'unsubscribed' });
        continue;
      }
      const unsubscribeUrl = `${UNSUB_URL}?token=${prefs?.unsubscribe_token ?? ''}`;

      // Hold this owner's reminders until reminder_offset_days past due. The
      // view already returns only due_date <= today, so this only DELAYS.
      const offset = prefs?.reminder_offset_days ?? 0;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - offset);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      const dueRows = offset > 0 ? ownerRows.filter((r) => r.due_date <= cutoffISO) : ownerRows;
      if (dueRows.length === 0) {
        results.push({ ownerId, to, sent: false, reason: 'not yet due (offset)' });
        continue;
      }
```

Then change the token-generation loop to iterate `dueRows` instead of `ownerRows` (the `for (const row of ownerRows)` that builds `rowsWithTokens` becomes `for (const row of dueRows)`), so only the currently-due charges are emailed.

- [ ] **Step 2: Deploy**

Deploy via Supabase MCP `deploy_edge_function`: name `send-payment-reminders`, entrypoint `index.ts`, **verify_jwt true** (confirm current via `list_edge_functions` first and match), files = `index.ts` + `shabbat.ts` + `deno.json` (import map). Read all three from disk.

- [ ] **Step 3: Dry-run smoke test**

Read the secret (`select value from private_settings where key='reminder_secret';` via MCP), then:

```bash
curl -s "https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/send-payment-reminders?dry=1&force=1" \
  -H "apikey: <ANON_KEY>" -H "x-reminder-secret: <SECRET>" | head -60
```

Expected: HTTP 200, valid JSON, no crash, `@hebcal/core` resolved. Owners whose charges are all inside the offset window show `reason: "not yet due (offset)"`; others show `dryRun:true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-payment-reminders/index.ts
git commit -m "feat(reminders): hold reminders until reminder_offset_days past due"
```

---

## Final verification

- [ ] `npx tsc --noEmit`, `npm test` (incl. `date.test.ts`), `npm run build` all pass.
- [ ] `/settings` shows the timing fields (default 3 / 0); changing them persists.
- [ ] Overview counts a charge as "due" `open_days_before` days early.
- [ ] Reminder dry-run defers owners within the offset window; `verify_jwt` still `true`.
