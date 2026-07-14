# Supabase Foundation — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-14-supabase-foundation-design.md` — read it first.

**Goal:** Replace the Google Sheets / Apps Script backend with Supabase — real auth, a relational schema for units/tenants/tenancies, and Row Level Security proven by tests — closing three critical security holes.

**Architecture:** Postgres schema where every row carries `owner_id` defaulted from `auth.uid()`. RLS restricts all access to `owner_id = auth.uid()`. Composite foreign keys `(unit_id, owner_id)` prevent cross-owner references that plain FKs would allow (FK checks bypass RLS). The React app talks to Postgres directly through `@supabase/supabase-js`, wrapped in React Query hooks.

**Tech Stack:** Vite 5, React 18, TypeScript 5.5, shadcn/ui, Tailwind, `@supabase/supabase-js` 2.50, `@tanstack/react-query` 5.56 (already installed and already wired in `src/App.tsx`), `sonner` (already installed and already mounted in `src/App.tsx`), Vitest (to be added).

## Global Constraints

- **Supabase project ref:** `lwmddgwwfirkcaqaxdbh`. Never target any other project. The MCP server `supabase-branch` points at an unrelated account and is denied in `.claude/settings.json` — do not use it.
- **UI language is Hebrew, RTL.** All user-facing strings in Hebrew. Match the existing tone in `src/components/Auth.tsx`.
- **Only `name` is required** on a unit and on a tenant. Every other field is optional. This is a product requirement, not a suggestion — the user must be able to create a unit by typing a name and nothing else.
- **Amounts live on the tenancy, not the unit.** `units.default_rent` is a form-prefill template only. Changing it must never alter an existing tenancy.
- **Never introduce a service-role key** into this repo or into `.env.local`. It bypasses RLS entirely. Tests sign up through the anon key (email confirmation is already disabled in the dev project).
- **The anon key is public by design** — it ships to every browser. RLS is the protection, not key secrecy. Do not add code that treats it as a secret.
- **No data migration.** Existing Google Sheets content is throwaway test data.
- `.gitignore` already contains `*.local`, which covers `.env.local`. Verify, don't re-add.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/supabase.ts` | The one Supabase client, built from env vars. Throws a clear error if env is missing. |
| `src/types/database.ts` | Types generated from the live database. Never hand-edited. |
| `src/api/units.ts` | Unit queries: list, create, update, archive. Throws on error. |
| `src/api/tenants.ts` | Tenant queries. Throws on error. |
| `src/api/tenancies.ts` | Tenancy queries: list with joins, create, end. Throws on error. |
| `src/hooks/useUnits.ts` | React Query wrapper over `src/api/units.ts`. |
| `src/hooks/useTenancies.ts` | React Query wrapper over `src/api/tenancies.ts`. |
| `src/components/UnitForm.tsx` | Create/edit a unit. Only `name` required. |
| `src/components/UnitCard.tsx` | One unit + its active tenant. |
| `src/components/TenancyForm.tsx` | Assign a tenant to a unit with a monthly rent. |
| `tests/rls.test.ts` | The security proof: two users, cross-access denied. |
| `tests/helpers/auth.ts` | Test helper that signs in (or signs up) an isolated client. |
| `vitest.config.ts` | Test runner config. |
| `.env.example` | Committed template. |
| `.env.local` | Real values. Gitignored via the existing `*.local` rule. |

**Rewritten:** `src/hooks/useAuth.ts`, `src/hooks/useTenants.ts`, `src/components/Auth.tsx`, `src/components/TenantForm.tsx`, `src/components/TenantCard.tsx`, `src/pages/Index.tsx`, `src/types/index.ts`.

**Deleted:** `src/supabaseClient.ts`, `src/services/googleSheetsApi.ts`, `src/components/GoogleSheetsSetup.tsx`, `src/components/PaymentManagement.tsx`, `src/hooks/usePayments.ts`, `GOOGLE_APPS_SCRIPT_CODE.js`.

**Untouched:** `src/utils/hebrewDates.ts` (needed in phase 2), everything under `src/components/ui/`.

**Note on task ordering:** Task 3 removes the entire Google Sheets stack and reduces `src/pages/Index.tsx` to an authenticated shell. Between Task 3 and Task 6 the app compiles and runs but shows no tenant data — that is intended. There are no real users and no real data, so there is nothing to preserve.

---

### Task 1: Supabase client from environment variables

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `.env.local`, `.env.example`
- Delete: `src/supabaseClient.ts`
- Test: `tests/supabase-client.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script + devDependencies)

**Interfaces:**
- Produces: `supabase` — a `SupabaseClient<Database>` exported from `src/lib/supabase.ts`. Every later task imports this and nothing else for DB access.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2.1.0
```

- [ ] **Step 2: Create `vitest.config.ts`**

Vitest runs on Vite, so it loads `.env.local` and exposes `VITE_`-prefixed vars on `import.meta.env` automatically. No dotenv package needed.

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
```

`fileParallelism: false` matters: the RLS tests in Task 2 create and delete rows against a shared remote database, and parallel files would race.

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block, alongside the existing `dev`/`build`/`lint`/`preview` entries, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `.env.example` (committed)**

```
# Supabase project: lwmddgwwfirkcaqaxdbh
# Both values are safe to expose — the anon key ships to every browser.
# RLS is what protects the data, not the secrecy of this key.
VITE_SUPABASE_URL=https://lwmddgwwfirkcaqaxdbh.supabase.co
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Create `.env.local` (gitignored) with the real anon key**

Fetch the real publishable/anon key with the MCP tool `mcp__supabase__get_publishable_keys`, and the URL with `mcp__supabase__get_project_url`. Write them in:

```
VITE_SUPABASE_URL=https://lwmddgwwfirkcaqaxdbh.supabase.co
VITE_SUPABASE_ANON_KEY=<the key returned by get_publishable_keys>
```

Then confirm git ignores it:

```bash
git check-ignore -v .env.local
```

Expected: a line showing `.gitignore:*.local` matched it. If it prints nothing, STOP — the file would be committed. Add `.env.local` to `.gitignore` before continuing.

- [ ] **Step 6: Write the failing test**

`tests/supabase-client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('supabase client', () => {
  it('is configured from environment variables', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toContain('lwmddgwwfirkcaqaxdbh');
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeTruthy();
  });

  it('can reach the project', async () => {
    // Deliberately bad credentials. A reachable project answers with an auth
    // error; an unreachable one fails at the network layer. Distinguishing the
    // two is the whole point of this test.
    //
    // Do NOT rewrite this to query a table. Task 2 replaces the `Database`
    // placeholder with generated types, and a made-up table name would then
    // stop type-checking.
    const { error } = await supabase.auth.signInWithPassword({
      email: 'definitely-not-a-user@example.com',
      password: 'definitely-not-the-password',
    });
    expect(error).not.toBeNull();
    expect(error!.message).not.toMatch(/fetch failed|ENOTFOUND|ECONNREFUSED/i);
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

```bash
npm test -- tests/supabase-client.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/supabase"`.

- [ ] **Step 8: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.',
  );
}

export const supabase = createClient<Database>(url, anonKey);
```

`src/types/database.ts` does not exist yet — Task 2 generates it. Until then, create a one-line placeholder so TypeScript resolves:

```ts
// src/types/database.ts — replaced by generated types in Task 2
export type Database = any;
```

- [ ] **Step 9: Run the test and watch it pass**

```bash
npm test -- tests/supabase-client.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 10: Delete the old hardcoded client**

```bash
git rm src/supabaseClient.ts
```

Nothing imports it — verify:

```bash
npx tsc --noEmit
```

Expected: no errors mentioning `supabaseClient`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: supabase client from env vars, add vitest

Replaces src/supabaseClient.ts, which hardcoded the URL and anon key for
an abandoned project and was imported by nothing."
```

---

### Task 2: Schema, RLS, and the two-user security proof

This is the task the whole phase exists for. The tests are written **first** and must fail against an empty database, then pass once the migration lands.

**Files:**
- Create: `tests/helpers/auth.ts`
- Create: `tests/rls.test.ts`
- Replace: `src/types/database.ts` (generated)
- Applies a migration to Supabase project `lwmddgwwfirkcaqaxdbh` via MCP

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts` (Task 1).
- Produces: tables `units`, `tenants`, `tenancies`; the `Database` type in `src/types/database.ts` used by every later task.

- [ ] **Step 1: Write the test helper**

`tests/helpers/auth.ts`. Each test user gets its **own** client with `persistSession: false` — otherwise the two clients would share one session store and clobber each other, and the test would silently pass while proving nothing.

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signs in as `email`, creating the user on first run. Returns an isolated client. */
export async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();

  let { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const { error: signUpError } = await client.auth.signUp({ email, password });
    if (signUpError) throw new Error(`signUp(${email}) failed: ${signUpError.message}`);
    ({ error } = await client.auth.signInWithPassword({ email, password }));
    if (error) throw new Error(`signIn(${email}) failed after signUp: ${error.message}`);
  }

  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error(`No user session for ${email}`);
  return client;
}
```

- [ ] **Step 2: Write the failing RLS test suite**

`tests/rls.test.ts`.

**Read this before writing it:** when RLS blocks an `update` or `delete`, Postgres does **not** raise an error. It matches zero rows and returns success. A test that only asserts "no error was thrown" passes against a completely broken policy. Every assertion below therefore checks **returned rows**, using `.select()` to make the affected rows observable.

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signInAs, anonClient } from './helpers/auth';

const PASSWORD = 'test-password-1234';
const run = String(Date.now()); // scope this run's rows so reruns don't collide

let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceUnitId: string;
let aliceTenantId: string;
let bobTenantId: string;

beforeAll(async () => {
  alice = await signInAs('rls-alice@example.com', PASSWORD);
  bob = await signInAs('rls-bob@example.com', PASSWORD);

  // owner_id is never sent by the client — the database fills it from the JWT.
  const { data: unit, error: unitErr } = await alice
    .from('units')
    .insert({ name: `alice-unit-${run}` })
    .select()
    .single();
  if (unitErr) throw unitErr;
  aliceUnitId = unit.id;

  const { data: aTenant, error: aErr } = await alice
    .from('tenants')
    .insert({ name: `alice-tenant-${run}` })
    .select()
    .single();
  if (aErr) throw aErr;
  aliceTenantId = aTenant.id;

  const { data: bTenant, error: bErr } = await bob
    .from('tenants')
    .insert({ name: `bob-tenant-${run}` })
    .select()
    .single();
  if (bErr) throw bErr;
  bobTenantId = bTenant.id;
});

describe('RLS: owner isolation', () => {
  it('owner_id is populated from the JWT, not the client', async () => {
    const { data: user } = await alice.auth.getUser();
    const { data: unit } = await alice
      .from('units').select('owner_id').eq('id', aliceUnitId).single();
    expect(unit!.owner_id).toBe(user.user!.id);
  });

  it("bob cannot see alice's unit", async () => {
    const { data } = await bob.from('units').select('*').eq('id', aliceUnitId);
    expect(data).toEqual([]);
  });

  it("bob cannot update alice's unit — zero rows affected", async () => {
    const { data } = await bob
      .from('units').update({ name: 'HACKED' }).eq('id', aliceUnitId).select();
    expect(data).toEqual([]);

    // And prove it really is untouched, not just invisible to bob.
    const { data: after } = await alice
      .from('units').select('name').eq('id', aliceUnitId).single();
    expect(after!.name).toBe(`alice-unit-${run}`);
  });

  it("bob cannot delete alice's unit — zero rows affected", async () => {
    const { data } = await bob
      .from('units').delete().eq('id', aliceUnitId).select();
    expect(data).toEqual([]);

    const { data: after } = await alice
      .from('units').select('id').eq('id', aliceUnitId);
    expect(after).toHaveLength(1);
  });

  it("bob cannot attach his tenant to alice's unit", async () => {
    // This is what the composite FK (unit_id, owner_id) exists to stop.
    // RLS alone would allow it, because FK checks bypass RLS.
    const { error } = await bob.from('tenancies').insert({
      tenant_id: bobTenantId,
      unit_id: aliceUnitId,
      monthly_rent: 1,
    });
    expect(error).not.toBeNull();
  });

  it('an anonymous visitor sees nothing', async () => {
    const anon = anonClient();
    const { data: units } = await anon.from('units').select('*');
    const { data: tenants } = await anon.from('tenants').select('*');
    expect(units ?? []).toEqual([]);
    expect(tenants ?? []).toEqual([]);
  });
});

describe('schema invariants', () => {
  it('rejects a unit with a blank name', async () => {
    const { error } = await alice.from('units').insert({ name: '   ' });
    expect(error).not.toBeNull();
  });

  it('allows a second active tenancy only after the first one ends', async () => {
    const { data: t1, error: e1 } = await alice.from('tenancies').insert({
      tenant_id: aliceTenantId,
      unit_id: aliceUnitId,
      monthly_rent: 3000,
    }).select().single();
    expect(e1).toBeNull();

    const { data: other } = await alice
      .from('tenants').insert({ name: `alice-tenant2-${run}` }).select().single();

    // Same unit, still occupied -> blocked by one_active_tenancy_per_unit
    const { error: e2 } = await alice.from('tenancies').insert({
      tenant_id: other!.id,
      unit_id: aliceUnitId,
      monthly_rent: 3200,
    });
    expect(e2).not.toBeNull();

    // End the first tenancy, then the unit is free
    await alice.from('tenancies')
      .update({ end_date: '2026-01-01' }).eq('id', t1!.id);

    const { error: e3 } = await alice.from('tenancies').insert({
      tenant_id: other!.id,
      unit_id: aliceUnitId,
      monthly_rent: 3200,
    });
    expect(e3).toBeNull();
  });

  it('refuses to delete a unit that has rental history', async () => {
    const { error } = await alice.from('units').delete().eq('id', aliceUnitId).select();
    expect(error).not.toBeNull(); // on delete restrict
  });
});
```

- [ ] **Step 3: Run the suite and watch it fail**

```bash
npm test -- tests/rls.test.ts
```

Expected: FAIL in `beforeAll` — the `units` table does not exist (PostgREST error `PGRST205` / "Could not find the table 'public.units'").

- [ ] **Step 4: Apply the migration**

Use the MCP tool `mcp__supabase__apply_migration` with name `phase1_foundation` and this SQL:

```sql
create table units (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  default_rent numeric(10,2),
  notes        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (id, owner_id)
);

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  email       text,
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
  end_date     date,
  created_at   timestamptz not null default now(),

  check (end_date is null or end_date >= start_date),
  foreign key (tenant_id, owner_id) references tenants (id, owner_id) on delete restrict,
  foreign key (unit_id,   owner_id) references units   (id, owner_id) on delete restrict
);

create unique index one_active_tenancy_per_unit
  on tenancies (unit_id) where end_date is null;

create index units_owner_idx     on units     (owner_id);
create index tenants_owner_idx   on tenants   (owner_id);
create index tenancies_owner_idx on tenancies (owner_id);
create index tenancies_unit_idx  on tenancies (unit_id);
create index tenancies_tenant_idx on tenancies (tenant_id);

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

- [ ] **Step 5: Run the suite and watch it pass**

```bash
npm test -- tests/rls.test.ts
```

Expected: PASS, 9 tests.

If any test fails, **do not weaken the test.** A failure here means the schema does not actually protect the data.

- [ ] **Step 6: Check Supabase's own advisors**

Call `mcp__supabase__get_advisors` with `type: "security"`.

Expected: no `rls_disabled_in_public` finding for `units`, `tenants`, or `tenancies`. If one appears, RLS did not enable — fix before continuing.

- [ ] **Step 7: Generate the real types**

Call `mcp__supabase__generate_typescript_types` and write the result over `src/types/database.ts`, replacing the `export type Database = any` placeholder from Task 1.

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: units/tenants/tenancies schema with RLS, proven by tests

Composite FKs (unit_id, owner_id) block cross-owner references that
plain FKs allow, since FK checks bypass RLS. Tests assert on affected
row counts, not thrown errors — a blocked UPDATE returns success with
zero rows, so an error-only assertion would pass against a broken policy."
```

---

### Task 3: Supabase Auth, and removal of the Google Sheets stack

**Files:**
- Rewrite: `src/hooks/useAuth.ts`
- Rewrite: `src/components/Auth.tsx`
- Rewrite: `src/pages/Index.tsx` (reduced to an authenticated shell)
- Rewrite: `src/types/index.ts`
- Delete: `src/services/googleSheetsApi.ts`, `src/components/GoogleSheetsSetup.tsx`, `src/components/PaymentManagement.tsx`, `src/hooks/usePayments.ts`, `src/hooks/useTenants.ts`, `src/components/TenantCard.tsx`, `src/components/TenantForm.tsx`, `GOOGLE_APPS_SCRIPT_CODE.js`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.
- Produces: `useAuth()` returning `{ user: User | null, loading: boolean, signIn, signUp, signOut }` where `User` is Supabase's own `@supabase/supabase-js` `User` type. `src/components/AuthProvider.tsx` is **not** modified — it already wraps `useAuthProvider()` and `AuthContext`, both of which keep their names.

- [ ] **Step 1: Rewrite `src/hooks/useAuth.ts`**

The current file fakes a session with `localStorage.currentUser`. This replaces it with a real Supabase session. `onAuthStateChange` keeps React in sync with token refreshes and sign-outs in other tabs.

```ts
import { useState, useEffect, createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, signIn, signUp, signOut };
};

export { AuthContext };
```

- [ ] **Step 2: Rewrite `src/components/Auth.tsx`**

Same layout and Hebrew copy as today, minus the `GoogleSheetsSetup` gate and the "מחובר ל-Google Sheets" badge.

```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('התחברת בהצלחה');
      } else {
        await signUp(email, password);
        toast.success('החשבון נוצר בהצלחה');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'אירעה שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold gradient-bg bg-clip-text text-transparent">
            מערכת ניהול שוכרים
          </CardTitle>
          <p className="text-muted-foreground">
            {isLogin ? 'התחבר לחשבון שלך' : 'צור חשבון חדש'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">כתובת מייל</Label>
              <Input
                id="email" type="email" value={email} required className="text-right"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הכנס כתובת מייל"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password" type="password" value={password} required minLength={6}
                className="text-right"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הכנס סיסמה"
              />
            </div>
            <Button type="submit" className="w-full gradient-bg hover:opacity-90" disabled={loading}>
              {loading ? 'מעבד...' : isLogin ? 'התחבר' : 'צור חשבון'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="text-primary">
              {isLogin ? 'אין לך חשבון? צור חשבון חדש' : 'יש לך חשבון? התחבר'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

- [ ] **Step 3: Replace `src/types/index.ts`**

The old hand-written `Tenant` and `MonthlyPayment` interfaces described the Google Sheets shape and drifted from reality (`createdAt: Date` while Sheets returned a string). Row types now come from the generated `Database` type.

```ts
import type { Database } from '@/types/database';

export type Unit = Database['public']['Tables']['units']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Tenancy = Database['public']['Tables']['tenancies']['Row'];

export type UnitInsert = Database['public']['Tables']['units']['Insert'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenancyInsert = Database['public']['Tables']['tenancies']['Insert'];
```

- [ ] **Step 4: Reduce `src/pages/Index.tsx` to an authenticated shell**

Units, tenants and the dashboard get built back up in Tasks 4–6.

```tsx
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { Auth } from '@/components/Auth';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="gradient-bg text-white p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">מערכת ניהול שוכרים</h1>
            <p className="text-xl opacity-90">ניהול מקצועי של נכסים ותשלומים</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg">{user.email}</span>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <LogOut className="w-4 h-4 ml-2" />
              התנתק
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
```

- [ ] **Step 5: Delete the Google Sheets stack**

```bash
git rm src/services/googleSheetsApi.ts \
       src/components/GoogleSheetsSetup.tsx \
       src/components/PaymentManagement.tsx \
       src/components/TenantCard.tsx \
       src/components/TenantForm.tsx \
       src/hooks/usePayments.ts \
       src/hooks/useTenants.ts \
       GOOGLE_APPS_SCRIPT_CODE.js
```

- [ ] **Step 6: Verify nothing still references the deleted modules**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean. Any error naming `googleSheetsApi`, `usePayments`, `PaymentManagement`, `TenantCard` or `TenantForm` means a stale import survived — remove it.

- [ ] **Step 7: Prove sign-up and sign-in work in the real app**

```bash
npm run dev
```

Open the app, create an account with a fresh email, confirm you land on the header with your email showing, click התנתק, confirm you return to the login screen, then sign back in with the same credentials. Then confirm the session is real, not localStorage theatre:

- Open DevTools → Application → Local Storage. There must be **no** `currentUser` key. There will be a `sb-lwmddgwwfirkcaqaxdbh-auth-token` key — that is a real JWT, and it is supposed to be there.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Supabase Auth; remove Google Sheets backend

Closes the three security holes: passwords no longer travel in URL query
strings, the session is a real JWT instead of a forgeable localStorage
key, and authorization is enforced by RLS in the database.

Index is reduced to an authenticated shell; units, tenants and the
dashboard are rebuilt in the following tasks."
```

---

### Task 4: Units

**Files:**
- Create: `src/api/units.ts`, `src/hooks/useUnits.ts`, `src/components/UnitForm.tsx`, `src/components/UnitCard.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 1), `Unit` / `UnitInsert` (Task 3).
- Produces: `useUnits()` returning `{ units: Unit[], isLoading: boolean, createUnit(input: { name: string; default_rent?: number | null; notes?: string | null }): void, updateUnit(args: { id: string; patch: Partial<UnitInsert> }): void, archiveUnit(id: string): void }`. Tasks 5 and 6 rely on these exact names.

- [ ] **Step 1: Create `src/api/units.ts`**

Every function **throws** on error. This is the fix for the swallowed-error bug class — the old hooks caught, logged to console, and returned as if nothing happened, so a failed save looked identical to a successful one.

```ts
import { supabase } from '@/lib/supabase';
import type { Unit, UnitInsert } from '@/types';

export async function listUnits(): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createUnit(input: Omit<UnitInsert, 'owner_id' | 'id'>): Promise<Unit> {
  // owner_id is omitted on purpose — the database fills it from the JWT.
  const { data, error } = await supabase.from('units').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateUnit(id: string, patch: Partial<UnitInsert>): Promise<Unit> {
  const { data, error } = await supabase
    .from('units').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveUnit(id: string): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/hooks/useUnits.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listUnits, createUnit, updateUnit, archiveUnit } from '@/api/units';
import type { UnitInsert } from '@/types';

const KEY = ['units'];

export const useUnits = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');

  const { data: units = [], isLoading } = useQuery({ queryKey: KEY, queryFn: listUnits });

  const create = useMutation({
    mutationFn: (input: Omit<UnitInsert, 'owner_id' | 'id'>) => createUnit(input),
    onSuccess: () => { invalidate(); toast.success('היחידה נוספה'); },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<UnitInsert> }) =>
      updateUnit(id, patch),
    onSuccess: () => { invalidate(); toast.success('היחידה עודכנה'); },
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveUnit(id),
    onSuccess: () => { invalidate(); toast.success('היחידה הועברה לארכיון'); },
    onError,
  });

  return {
    units,
    isLoading,
    createUnit: create.mutate,
    updateUnit: update.mutate,
    archiveUnit: archive.mutate,
  };
};
```

- [ ] **Step 3: Create `src/components/UnitForm.tsx`**

Only `name` is required — that is the product requirement. The rent field is labelled as a template so the user understands it does not bind an existing tenant.

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Unit } from '@/types';

interface UnitFormProps {
  onSubmit: (values: { name: string; default_rent: number | null; notes: string | null }) => void;
  initialData?: Partial<Unit>;
  submitLabel?: string;
}

export const UnitForm: React.FC<UnitFormProps> = ({
  onSubmit,
  initialData = {},
  submitLabel = 'הוסף יחידה',
}) => {
  const [name, setName] = useState(initialData.name ?? '');
  const [rent, setRent] = useState(initialData.default_rent?.toString() ?? '');
  const [notes, setNotes] = useState(initialData.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      default_rent: rent === '' ? null : Number(rent),
      notes: notes.trim() === '' ? null : notes.trim(),
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plus className="w-6 h-6" />
          {submitLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="unit-name" className="text-lg font-medium">שם היחידה</Label>
            <Input
              id="unit-name" value={name} required className="text-lg p-3"
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: דירה 3, קומה ב'"
            />
            <p className="text-sm text-muted-foreground">
              זה כל מה שצריך כדי לפתוח יחידה. אפשר להשלים את השאר מתי שתרצה.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-rent" className="text-base font-medium">
              שכר דירה מבוקש (₪) — אופציונלי
            </Label>
            <Input
              id="unit-rent" type="number" min="0" value={rent} className="text-lg p-3 ltr"
              onChange={(e) => setRent(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              משמש רק כברירת מחדל בטופס כששוכר חדש נכנס. שינוי כאן לא ישנה את מה שסוכם עם שוכר קיים.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-notes" className="text-base font-medium">הערות — אופציונלי</Label>
            <Textarea
              id="unit-notes" value={notes} className="text-right"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full text-lg py-3 gradient-bg hover:opacity-90">
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Create `src/components/UnitCard.tsx`**

`activeTenantName` is supplied by the caller. Task 6 wires it to the real active tenancy; until then `Index` passes `null` and the card reads "פנויה".

```tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Pencil, Archive } from 'lucide-react';
import type { Unit } from '@/types';

interface UnitCardProps {
  unit: Unit;
  activeTenantName: string | null;
  onEdit: (unit: Unit) => void;
  onArchive: (id: string) => void;
}

export const UnitCard: React.FC<UnitCardProps> = ({ unit, activeTenantName, onEdit, onArchive }) => (
  <Card className="card-hover">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Home className="w-5 h-5 text-primary" />
        {unit.name}
      </CardTitle>
      <Badge variant={activeTenantName ? 'default' : 'secondary'}>
        {activeTenantName ?? 'פנויה'}
      </Badge>
    </CardHeader>
    <CardContent className="space-y-4">
      {unit.default_rent !== null && (
        <p className="text-sm text-muted-foreground">
          שכר דירה מבוקש: ₪{Number(unit.default_rent).toLocaleString()}
        </p>
      )}
      {unit.notes && <p className="text-sm">{unit.notes}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(unit)}>
          <Pencil className="w-4 h-4 ml-2" />
          ערוך
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onArchive(unit.id)}>
          <Archive className="w-4 h-4 ml-2" />
          העבר לארכיון
        </Button>
      </div>
    </CardContent>
  </Card>
);
```

- [ ] **Step 5: Wire units into `src/pages/Index.tsx`**

Replace the authenticated shell's body (everything after the header `</div>`, before the closing `</div>`) so the page lists units and can add/edit them. Keep the existing header and the `loading` / `!user` guards from Task 3 exactly as they are, and add these imports at the top:

```tsx
import { useState } from 'react';
import { Plus, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { UnitForm } from '@/components/UnitForm';
import { UnitCard } from '@/components/UnitCard';
import { useUnits } from '@/hooks/useUnits';
import type { Unit } from '@/types';
```

Inside the component, above the `loading` guard:

```tsx
const { units, isLoading, createUnit, updateUnit, archiveUnit } = useUnits();
const [editing, setEditing] = useState<Unit | null>(null);
const [adding, setAdding] = useState(false);
```

And render, in place of the empty body:

```tsx
<div className="max-w-6xl mx-auto p-6">
  {adding || editing ? (
    <div className="flex flex-col items-center gap-4">
      <Button variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>
        ← חזור
      </Button>
      <UnitForm
        initialData={editing ?? undefined}
        submitLabel={editing ? 'עדכן יחידה' : 'הוסף יחידה'}
        onSubmit={(values) => {
          if (editing) updateUnit({ id: editing.id, patch: values });
          else createUnit(values);
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  ) : (
    <>
      <Button onClick={() => setAdding(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
        <Plus className="w-5 h-5 ml-2" />
        הוסף יחידה
      </Button>

      {isLoading ? (
        <p className="text-center text-muted-foreground">טוען יחידות...</p>
      ) : units.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">אין יחידות במערכת</h3>
            <p className="text-muted-foreground mb-6">הוסף יחידה ראשונה כדי להתחיל</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              activeTenantName={null}
              onEdit={setEditing}
              onArchive={archiveUnit}
            />
          ))}
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 6: Verify in the real app**

```bash
npx tsc --noEmit && npm run dev
```

Sign in, then check each of these:
- Add a unit with **only a name** → it appears in the grid, badge reads "פנויה". This is the "name alone is enough" requirement.
- Edit it, add a rent → the card shows the rent.
- Archive it → it disappears from the grid.
- Add a unit, then in DevTools go offline and try to add another → a red toast appears. **A failed save must never look like a successful one.**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: units — API, React Query hooks, form and card

Errors surface as toasts instead of being swallowed by console.error,
which is what made a failed save indistinguishable from a successful one."
```

---

### Task 5: Tenants

**Files:**
- Create: `src/api/tenants.ts`, `src/hooks/useTenants.ts`, `src/components/TenantForm.tsx`, `src/components/TenantCard.tsx`
- Modify: `src/pages/Index.tsx` (add a tabbed layout: יחידות / שוכרים)

**Interfaces:**
- Consumes: `supabase` (Task 1), `Tenant` / `TenantInsert` (Task 3).
- Produces: `useTenants()` returning `{ tenants: Tenant[], isLoading: boolean, createTenant(input: { name: string; phone?: string | null; email?: string | null }): void, updateTenant(args: { id: string; patch: Partial<TenantInsert> }): void, archiveTenant(id: string): void }`. Task 6 relies on these exact names.

- [ ] **Step 1: Create `src/api/tenants.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { Tenant, TenantInsert } from '@/types';

export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTenant(input: Omit<TenantInsert, 'owner_id' | 'id'>): Promise<Tenant> {
  const { data, error } = await supabase.from('tenants').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTenant(id: string, patch: Partial<TenantInsert>): Promise<Tenant> {
  const { data, error } = await supabase
    .from('tenants').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function archiveTenant(id: string): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/hooks/useTenants.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listTenants, createTenant, updateTenant, archiveTenant } from '@/api/tenants';
import type { TenantInsert } from '@/types';

const KEY = ['tenants'];

export const useTenants = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');

  const { data: tenants = [], isLoading } = useQuery({ queryKey: KEY, queryFn: listTenants });

  const create = useMutation({
    mutationFn: (input: Omit<TenantInsert, 'owner_id' | 'id'>) => createTenant(input),
    onSuccess: () => { invalidate(); toast.success('השוכר נוסף'); },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TenantInsert> }) =>
      updateTenant(id, patch),
    onSuccess: () => { invalidate(); toast.success('השוכר עודכן'); },
    onError,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveTenant(id),
    onSuccess: () => { invalidate(); toast.success('השוכר הועבר לארכיון'); },
    onError,
  });

  return {
    tenants,
    isLoading,
    createTenant: create.mutate,
    updateTenant: update.mutate,
    archiveTenant: archive.mutate,
  };
};
```

- [ ] **Step 3: Create `src/components/TenantForm.tsx`**

Note what is **not** here: no rent, no electricity, no water, no committee, no gas, no meters. Rent belongs to the tenancy (Task 6). The rest belongs to phases 2 and 3. Only `name` is required.

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import type { Tenant } from '@/types';

interface TenantFormProps {
  onSubmit: (values: { name: string; phone: string | null; email: string | null }) => void;
  initialData?: Partial<Tenant>;
  submitLabel?: string;
}

export const TenantForm: React.FC<TenantFormProps> = ({
  onSubmit,
  initialData = {},
  submitLabel = 'הוסף שוכר',
}) => {
  const [name, setName] = useState(initialData.name ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [email, setEmail] = useState(initialData.email ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() === '' ? null : phone.trim(),
      email: email.trim() === '' ? null : email.trim(),
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plus className="w-6 h-6" />
          {submitLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tenant-name" className="text-lg font-medium">שם השוכר</Label>
            <Input
              id="tenant-name" value={name} required className="text-lg p-3"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              זה כל מה שצריך. את השיוך ליחידה ואת שכר הדירה מגדירים בשלב הבא.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-phone" className="text-base font-medium">טלפון — אופציונלי</Label>
            <Input
              id="tenant-phone" type="tel" value={phone} className="text-lg p-3 ltr"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-email" className="text-base font-medium">מייל — אופציונלי</Label>
            <Input
              id="tenant-email" type="email" value={email} className="text-lg p-3 ltr"
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">יידרש בהמשך לתזכורות תשלום.</p>
          </div>

          <Button type="submit" className="w-full text-lg py-3 gradient-bg hover:opacity-90">
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Create `src/components/TenantCard.tsx`**

```tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Pencil, Archive } from 'lucide-react';
import type { Tenant } from '@/types';

interface TenantCardProps {
  tenant: Tenant;
  unitName: string | null;
  onEdit: (tenant: Tenant) => void;
  onArchive: (id: string) => void;
}

export const TenantCard: React.FC<TenantCardProps> = ({ tenant, unitName, onEdit, onArchive }) => (
  <Card className="card-hover">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-lg">
        <User className="w-5 h-5 text-primary" />
        {tenant.name}
      </CardTitle>
      <Badge variant={unitName ? 'default' : 'secondary'}>
        {unitName ?? 'ללא יחידה'}
      </Badge>
    </CardHeader>
    <CardContent className="space-y-4">
      {tenant.phone && <p className="text-sm text-muted-foreground ltr text-right">{tenant.phone}</p>}
      {tenant.email && <p className="text-sm text-muted-foreground ltr text-right">{tenant.email}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(tenant)}>
          <Pencil className="w-4 h-4 ml-2" />
          ערוך
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onArchive(tenant.id)}>
          <Archive className="w-4 h-4 ml-2" />
          העבר לארכיון
        </Button>
      </div>
    </CardContent>
  </Card>
);
```

- [ ] **Step 5: Add tabs to `src/pages/Index.tsx`**

Wrap the page body in shadcn `Tabs` so the user picks יחידות or שוכרים. Add to the imports:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TenantForm } from '@/components/TenantForm';
import { TenantCard } from '@/components/TenantCard';
import { useTenants } from '@/hooks/useTenants';
import type { Tenant } from '@/types';
```

Add alongside the existing unit state:

```tsx
const { tenants, isLoading: tenantsLoading, createTenant, updateTenant, archiveTenant } = useTenants();
const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
const [addingTenant, setAddingTenant] = useState(false);
```

Structure the body as:

```tsx
<div className="max-w-6xl mx-auto p-6">
  <Tabs defaultValue="units">
    <TabsList className="mb-6">
      <TabsTrigger value="units">יחידות</TabsTrigger>
      <TabsTrigger value="tenants">שוכרים</TabsTrigger>
    </TabsList>

    <TabsContent value="units">
      {/*
        Cut the units JSX that already lives in this file — the block starting
        with the `adding || editing ? (...)` ternary from Task 4 Step 5 — and
        paste it here verbatim. Do not retype or redesign it; it does not change.
      */}
    </TabsContent>

    <TabsContent value="tenants">
      {addingTenant || editingTenant ? (
        <div className="flex flex-col items-center gap-4">
          <Button variant="outline" onClick={() => { setAddingTenant(false); setEditingTenant(null); }}>
            ← חזור
          </Button>
          <TenantForm
            initialData={editingTenant ?? undefined}
            submitLabel={editingTenant ? 'עדכן שוכר' : 'הוסף שוכר'}
            onSubmit={(values) => {
              if (editingTenant) updateTenant({ id: editingTenant.id, patch: values });
              else createTenant(values);
              setAddingTenant(false);
              setEditingTenant(null);
            }}
          />
        </div>
      ) : (
        <>
          <Button onClick={() => setAddingTenant(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
            <Plus className="w-5 h-5 ml-2" />
            הוסף שוכר
          </Button>
          {tenantsLoading ? (
            <p className="text-center text-muted-foreground">טוען שוכרים...</p>
          ) : tenants.length === 0 ? (
            <Card className="text-center p-12">
              <CardContent>
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">אין שוכרים במערכת</h3>
                <p className="text-muted-foreground">הוסף שוכר ראשון כדי להתחיל</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  unitName={null}
                  onEdit={setEditingTenant}
                  onArchive={archiveTenant}
                />
              ))}
            </div>
          )}
        </>
      )}
    </TabsContent>
  </Tabs>
</div>
```

Add `Users` to the `lucide-react` import.

- [ ] **Step 6: Verify in the real app**

```bash
npx tsc --noEmit && npm run dev
```

- Add a tenant with **only a name** → appears under שוכרים, badge reads "ללא יחידה".
- Add a phone and mail by editing → they show on the card.
- Archive → disappears.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tenants — API, hooks, form and card

Tenant carries identity only. Rent moves to the tenancy in the next task;
utilities and meters belong to phases 2 and 3."
```

---

### Task 6: Tenancies — connecting tenants to units

**Files:**
- Create: `src/api/tenancies.ts`, `src/hooks/useTenancies.ts`, `src/components/TenancyForm.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `useUnits()` (Task 4), `useTenants()` (Task 5), `Tenancy` / `TenancyInsert` (Task 3).
- Produces: `useTenancies()` returning `{ tenancies: TenancyWithNames[], activeByUnitId: Map<string, TenancyWithNames>, activeByTenantId: Map<string, TenancyWithNames>, isLoading: boolean, createTenancy(input), endTenancy(args: { id: string; end_date: string }): void }`, where `TenancyWithNames = Tenancy & { unit_name: string; tenant_name: string }`.

- [ ] **Step 1: Create `src/api/tenancies.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { Tenancy, TenancyInsert } from '@/types';

export type TenancyWithNames = Tenancy & { unit_name: string; tenant_name: string };

export async function listTenancies(): Promise<TenancyWithNames[]> {
  const { data, error } = await supabase
    .from('tenancies')
    .select('*, units(name), tenants(name)')
    .order('start_date', { ascending: false });
  if (error) throw error;

  return (data as unknown as Array<Tenancy & {
    units: { name: string } | null;
    tenants: { name: string } | null;
  }>).map(({ units, tenants, ...t }) => ({
    ...t,
    unit_name: units?.name ?? '',
    tenant_name: tenants?.name ?? '',
  }));
}

export async function createTenancy(
  input: Omit<TenancyInsert, 'owner_id' | 'id'>,
): Promise<Tenancy> {
  const { data, error } = await supabase.from('tenancies').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function endTenancy(id: string, endDate: string): Promise<void> {
  const { error } = await supabase
    .from('tenancies').update({ end_date: endDate }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/hooks/useTenancies.ts`**

The `one_active_tenancy_per_unit` index means creating a tenancy on an occupied unit fails at the database. Translate that into Hebrew the user can act on, rather than leaking a Postgres constraint name.

```ts
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listTenancies, createTenancy, endTenancy, type TenancyWithNames } from '@/api/tenancies';
import type { TenancyInsert } from '@/types';

const KEY = ['tenancies'];

function humanize(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('one_active_tenancy_per_unit')) {
    return 'ביחידה הזו כבר גר שוכר. סיים את תקופת השכירות הקיימת לפני שתשייך שוכר חדש.';
  }
  return msg || 'הפעולה נכשלה';
}

export const useTenancies = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const { data: tenancies = [], isLoading } = useQuery({ queryKey: KEY, queryFn: listTenancies });

  const active = useMemo(() => tenancies.filter((t) => t.end_date === null), [tenancies]);

  const activeByUnitId = useMemo(
    () => new Map<string, TenancyWithNames>(active.map((t) => [t.unit_id, t])),
    [active],
  );
  const activeByTenantId = useMemo(
    () => new Map<string, TenancyWithNames>(active.map((t) => [t.tenant_id, t])),
    [active],
  );

  const create = useMutation({
    mutationFn: (input: Omit<TenancyInsert, 'owner_id' | 'id'>) => createTenancy(input),
    onSuccess: () => { invalidate(); toast.success('השוכר שויך ליחידה'); },
    onError: (e) => toast.error(humanize(e)),
  });

  const end = useMutation({
    mutationFn: ({ id, end_date }: { id: string; end_date: string }) => endTenancy(id, end_date),
    onSuccess: () => { invalidate(); toast.success('תקופת השכירות הסתיימה'); },
    onError: (e) => toast.error(humanize(e)),
  });

  return {
    tenancies,
    activeByUnitId,
    activeByTenantId,
    isLoading,
    createTenancy: create.mutate,
    endTenancy: end.mutate,
  };
};
```

- [ ] **Step 3: Create `src/components/TenancyForm.tsx`**

This is where the "unit rent is only a template" rule becomes visible: picking a unit prefills the rent from `default_rent`, and the user can freely overwrite it. Once submitted, the tenancy owns its own number.

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Link } from 'lucide-react';
import type { Unit, Tenant } from '@/types';

interface TenancyFormProps {
  units: Unit[];
  tenants: Tenant[];
  occupiedUnitIds: Set<string>;
  housedTenantIds: Set<string>;
  onSubmit: (values: {
    unit_id: string;
    tenant_id: string;
    monthly_rent: number;
    start_date: string;
  }) => void;
}

export const TenancyForm: React.FC<TenancyFormProps> = ({
  units, tenants, occupiedUnitIds, housedTenantIds, onSubmit,
}) => {
  const [unitId, setUnitId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [rent, setRent] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const freeUnits = units.filter((u) => !occupiedUnitIds.has(u.id));
  const freeTenants = tenants.filter((t) => !housedTenantIds.has(t.id));

  const handleUnitChange = (id: string) => {
    setUnitId(id);
    // Prefill from the unit's template. This is a starting value, not a binding one.
    const unit = units.find((u) => u.id === id);
    if (unit?.default_rent != null && rent === '') setRent(String(unit.default_rent));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId || !tenantId) return;
    onSubmit({
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent: rent === '' ? 0 : Number(rent),
      start_date: startDate,
    });
  };

  return (
    <Card className="w-full max-w-2xl card-hover">
      <CardHeader className="gradient-bg text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Link className="w-6 h-6" />
          שייך שוכר ליחידה
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {freeUnits.length === 0 || freeTenants.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {freeUnits.length === 0
              ? 'כל היחידות תפוסות. סיים תקופת שכירות קיימת כדי לפנות יחידה.'
              : 'כל השוכרים כבר משויכים ליחידה. הוסף שוכר חדש תחילה.'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-lg font-medium">יחידה</Label>
              <Select value={unitId} onValueChange={handleUnitChange}>
                <SelectTrigger className="text-lg p-3"><SelectValue placeholder="בחר יחידה פנויה" /></SelectTrigger>
                <SelectContent>
                  {freeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-lg font-medium">שוכר</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="text-lg p-3"><SelectValue placeholder="בחר שוכר" /></SelectTrigger>
                <SelectContent>
                  {freeTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenancy-rent" className="text-lg font-medium">שכר דירה חודשי (₪)</Label>
              <Input
                id="tenancy-rent" type="number" min="0" value={rent} className="text-lg p-3 ltr"
                onChange={(e) => setRent(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                מולא מברירת המחדל של היחידה. אפשר לשנות — מרגע זה הסכום שייך לשוכר הזה בלבד.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenancy-start" className="text-base font-medium">תאריך כניסה</Label>
              <Input
                id="tenancy-start" type="date" value={startDate} className="text-lg p-3 ltr"
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full text-lg py-3 gradient-bg hover:opacity-90"
              disabled={!unitId || !tenantId}
            >
              שייך שוכר
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Wire tenancies into `src/pages/Index.tsx`**

Add the imports and hook:

```tsx
import { TenancyForm } from '@/components/TenancyForm';
import { useTenancies } from '@/hooks/useTenancies';
```

```tsx
const {
  activeByUnitId, activeByTenantId, createTenancy, endTenancy,
} = useTenancies();
const [assigning, setAssigning] = useState(false);
```

Now replace the two `null` placeholders left in Tasks 4 and 5 with real data:

- In the units grid: `activeTenantName={activeByUnitId.get(unit.id)?.tenant_name ?? null}`
- In the tenants grid: `unitName={activeByTenantId.get(tenant.id)?.unit_name ?? null}`

Add a third tab:

```tsx
<TabsTrigger value="tenancies">שיוכים</TabsTrigger>
```

```tsx
<TabsContent value="tenancies">
  {assigning ? (
    <div className="flex flex-col items-center gap-4">
      <Button variant="outline" onClick={() => setAssigning(false)}>← חזור</Button>
      <TenancyForm
        units={units}
        tenants={tenants}
        occupiedUnitIds={new Set(activeByUnitId.keys())}
        housedTenantIds={new Set(activeByTenantId.keys())}
        onSubmit={(values) => { createTenancy(values); setAssigning(false); }}
      />
    </div>
  ) : (
    <>
      <Button onClick={() => setAssigning(true)} className="gradient-bg hover:opacity-90 mb-8" size="lg">
        <Plus className="w-5 h-5 ml-2" />
        שייך שוכר ליחידה
      </Button>

      {tenancies.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <h3 className="text-xl font-semibold mb-2">אין שיוכים עדיין</h3>
            <p className="text-muted-foreground">שייך שוכר ליחידה כדי להתחיל</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tenancies.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{t.tenant_name} — {t.unit_name}</p>
                  <p className="text-sm text-muted-foreground">
                    ₪{Number(t.monthly_rent).toLocaleString()} לחודש · מ-{t.start_date}
                    {t.end_date ? ` עד ${t.end_date}` : ' · פעיל'}
                  </p>
                </div>
                {t.end_date === null && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => endTenancy({
                      id: t.id,
                      end_date: new Date().toISOString().slice(0, 10),
                    })}
                  >
                    סיים שכירות
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )}
</TabsContent>
```

Add `tenancies` to the `useTenancies()` destructure so the list renders.

- [ ] **Step 5: Verify the whole flow end to end**

```bash
npx tsc --noEmit && npm run lint && npm run dev
```

Walk the real product path:
1. Add a unit "דירה 1" with a requested rent of 4000.
2. Add a tenant "משה".
3. שיוכים → שייך → pick דירה 1 → **the rent field prefills to 4000**. Change it to 3800. Submit.
4. יחידות tab → דירה 1's badge now reads "משה". שוכרים tab → משה's badge reads "דירה 1".
5. **Now prove the template rule:** edit דירה 1, change the requested rent to 5000, save. Go back to שיוכים — משה still shows **₪3,800**. If it changed, the schema or the form is wrong.
6. Try to assign another tenant to דירה 1 → the unit is not offered (it's occupied). Now end משה's tenancy, and the unit becomes available again.
7. יחידות → try to archive דירה 1 → it archives (archive is allowed; only hard delete is blocked).

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: PASS, 11 tests across both files. The RLS suite must still pass — nothing in Tasks 3–6 should have weakened it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tenancies — assign tenants to units, end a tenancy

The unit's default_rent prefills the tenancy form and then detaches:
editing a unit never changes what an existing tenant pays. The
one-active-tenancy-per-unit index is surfaced as a Hebrew message rather
than a raw Postgres constraint name."
```

---

## Done when

- `npm test` passes, including the RLS suite proving one owner cannot read, update, delete, or reference another owner's rows.
- `mcp__supabase__get_advisors` (security) reports no `rls_disabled_in_public` for `units`, `tenants`, `tenancies`.
- `npx tsc --noEmit` and `npm run lint` are clean.
- A unit can be created with nothing but a name; so can a tenant.
- Editing a unit's `default_rent` does not change an existing tenancy's rent.
- No file in the repo references Google Sheets or Apps Script.
- `grep -ri "eyJhbGci" src/` returns nothing — no key is hardcoded any more.

## Deferred to later phases (do not build these here)

Payment types and frequencies, meter readings and consumption maths, file and photo upload, the dashboard's financial totals, and email reminders. Each gets its own spec and plan. Notably, `src/utils/hebrewDates.ts` stays untouched and unused until phase 2.
