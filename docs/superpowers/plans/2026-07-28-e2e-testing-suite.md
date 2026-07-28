# E2E Testing Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright browser end-to-end test suite that drives the real app against a dedicated Supabase branch, covering the auth, units, tenants+tenancy, and payments (mark-paid) flows.

**Architecture:** Playwright (`@playwright/test`) runs Chromium against `vite --mode e2e` (port 8080), which reads `.env.e2e` so the app talks to an isolated Supabase branch. A `setup` project signs in a fixed test user once and saves `storageState`; the spec projects reuse it. A service-role admin client (Node side only) creates the test user and resets its data before each mutating test, so every test starts from a clean, deterministic baseline. Tests run single-worker for determinism against the shared branch.

**Tech Stack:** Playwright, `@supabase/supabase-js` (already a dependency, used server-side with the service-role key), `dotenv`, Vite, React, existing Supabase schema.

## Global Constraints

- **Runner separation:** vitest owns `tests/**/*.test.ts`; Playwright owns `e2e/**/*.spec.ts` and `e2e/auth.setup.ts`. Never let them overlap.
- **Dev server:** the app serves on `http://localhost:8080` (`vite.config.ts` port 8080). E2E uses `npm run dev:e2e` = `vite --mode e2e`, which loads `.env.e2e`.
- **Env precedence:** Vite loads `.env` < `.env.local` < `.env.e2e`, so `.env.e2e` wins for `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build time.
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` lives only in `.env.e2e` (gitignored) and is read only in the Node/Playwright process — never prefixed `VITE_`, never shipped to the browser.
- **Determinism:** `workers: 1`, `fullyParallel: false`. Every mutating test resets the test user's data first (via the `test` fixture from `e2e/support/fixtures.ts`).
- **Test user:** created via service-role with `email_confirm: true` and `user_metadata.onboarding_version: 1` so email confirmation and the first-login guide never block tests.
- **Selectors (in priority order):** `getByRole` with the Hebrew accessible name → `getByLabel` (regex for labels with a trailing `*`/`- אופציונלי`) → `getByText` → existing `data-guide` hooks. Add `data-testid` only if nothing else is unambiguous.
- **Language:** the app is Hebrew RTL. All literal strings in selectors are copied verbatim from the components.
- **These are acceptance tests over existing, working app code.** There is no app feature to implement — each spec should go green on first correct run. A red result means a selector/test bug to fix (or, occasionally, a real app bug to report to the user), never "write the app code."

---

### Task 1: Tooling, Playwright config, and env scaffolding

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Modify: `.gitignore`
- Create: `.env.e2e.example`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces: `npm run dev:e2e` (starts Vite in e2e mode); the Playwright config with projects `setup` and `chromium`; `baseURL` `http://localhost:8080`.

- [ ] **Step 1: Install dev dependencies and the Chromium browser**

Run:
```bash
npm install -D @playwright/test dotenv
npx playwright install chromium
```

- [ ] **Step 2: Add scripts to `package.json`**

Add these entries to the `"scripts"` block (leave existing scripts untouched):
```json
"dev:e2e": "vite --mode e2e",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

- [ ] **Step 3: Extend `.gitignore`**

Append:
```
# E2E (Playwright)
.env.e2e
e2e/.auth/
playwright-report/
test-results/
```

- [ ] **Step 4: Create `.env.e2e.example`**

```
# Dedicated Supabase TEST BRANCH credentials for Playwright E2E.
# Copy this file to .env.e2e (gitignored) and fill from the branch you create in Task 2.
# VITE_ vars are read by the browser app (via Vite); the service-role key is read
# only by the Node test process and must never be exposed to the browser.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
E2E_USER_EMAIL=e2e@example.com
E2E_USER_PASSWORD=e2e-strong-password-change-me
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load the branch credentials into process.env for the Node side (admin client,
// auth.setup, specs). The browser app gets VITE_* via `vite --mode e2e`.
dotenv.config({ path: '.env.e2e' });

const AUTH_FILE = 'e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  reporter: process.env.CI ? 'html' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
    },
  ],
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: Verify the config parses**

Run: `npx playwright test --list`
Expected: exits 0. It prints `Error: No tests found` OR lists zero tests — either is fine at this point; what matters is that the config loads without a syntax/type error. (If it complains about a missing `.env.e2e`, that is expected until Task 2 — `dotenv.config` on a missing file is a no-op and does not throw.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore .env.e2e.example playwright.config.ts
git commit -m "test(e2e): scaffold Playwright config and scripts"
```

---

### Task 2: Create the Supabase test branch and fill `.env.e2e`

This is an operational task (no committed code — `.env.e2e` is gitignored). It produces the isolated backend the whole suite runs against.

**Files:**
- Create (local, gitignored): `.env.e2e`

**Interfaces:**
- Produces: a reachable Supabase branch with the app schema, and a filled `.env.e2e` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.

- [ ] **Step 1: Create a persistent test branch**

Use the Supabase MCP `create_branch` tool (branch name e.g. `e2e`), or the Supabase dashboard (Branches → new branch). The branch inherits the parent project's migrations, so it has the same schema. Confirm it is ready with the MCP `list_branches` tool (status `MIGRATIONS_PASSED`/active) before continuing.

- [ ] **Step 2: Collect the branch credentials**

From the branch, obtain its project URL, its `anon` (publishable) key, and its `service_role` key (dashboard → Project Settings → API, or the MCP `get_project_url` / `get_publishable_keys` tools; the service-role key comes from the branch's API settings).

- [ ] **Step 3: Fill `.env.e2e`**

Copy `.env.e2e.example` to `.env.e2e` and set:
- `VITE_SUPABASE_URL` → branch URL
- `VITE_SUPABASE_ANON_KEY` → branch anon key
- `SUPABASE_SERVICE_ROLE_KEY` → branch service-role key
- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` → a fixed test account (any values; the account is created in Task 3).

- [ ] **Step 4: Verify connectivity**

Run: `npm run dev:e2e`
Expected: Vite starts on `http://localhost:8080` with no "Missing VITE_SUPABASE_URL…" error. Open the URL in a browser: the landing page renders. Stop the server (Ctrl-C). No commit (nothing tracked changed).

---

### Task 3: Supabase admin support module + authentication setup

**Files:**
- Create: `e2e/support/supabase-admin.ts`
- Create: `e2e/auth.setup.ts`
- Test: running the `setup` project is the verification.

**Interfaces:**
- Produces:
  - `TEST_USER: { email: string; password: string }`
  - `ensureTestUser(): Promise<string>` — returns the test user's id, creating it (email-confirmed, onboarding done) if absent.
  - `resetTestUserData(): Promise<void>` — deletes all of the test user's rows across app tables in FK-safe order.
  - `seedUnit(name: string): Promise<string>` — inserts a bare unit owned by the test user; returns its id.
  - `seedTenant(name: string): Promise<string>` — inserts a bare tenant owned by the test user; returns its id.
  - `seedActiveTenancy(opts): Promise<{ unitId: string; tenantId: string; tenancyId: string }>` — inserts unit + tenant + active tenancy.
  - `e2e/.auth/user.json` — saved `storageState` for signed-in specs.

- [ ] **Step 1: Write `e2e/support/supabase-admin.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  throw new Error(
    'Missing E2E env. Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ' +
      'E2E_USER_EMAIL and E2E_USER_PASSWORD in .env.e2e (see .env.e2e.example).',
  );
}

export const TEST_USER = { email, password };

const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let cachedUserId: string | null = null;

/** Ensures the fixed test user exists (email-confirmed, onboarding done). Returns its id. */
export async function ensureTestUser(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    // Keep onboarding marked complete so the first-login guide never opens mid-test.
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...existing.user_metadata, onboarding_version: 1 },
    });
    cachedUserId = existing.id;
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { onboarding_version: 1 },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? 'no user'}`);
  cachedUserId = data.user.id;
  return data.user.id;
}

// Children before parents. Every app table is owner-scoped by `owner_id`;
// service-role bypasses RLS so these deletes clear the test user's data only.
const CLEANUP_TABLES = [
  'payment_allocations',
  'payment_action_tokens',
  'payments',
  'charges',
  'billing_schedule_occurrences',
  'tenancy_billing_settings',
  'tenancy_payment_terms',
  'meter_readings',
  'attachments',
  'tenancies',
  'units',
  'tenants',
  'notification_settings',
] as const;

/** Deletes all of the test user's rows so each test starts from a clean baseline. */
export async function resetTestUserData(): Promise<void> {
  const userId = await ensureTestUser();
  for (const table of CLEANUP_TABLES) {
    const { error } = await admin.from(table).delete().eq('owner_id', userId);
    if (error) throw new Error(`reset ${table} failed: ${error.message}`);
  }
}

export async function seedUnit(name: string): Promise<string> {
  const userId = await ensureTestUser();
  const { data, error } = await admin.from('units').insert({ name, owner_id: userId }).select('id').single();
  if (error || !data) throw new Error(`seedUnit failed: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function seedTenant(name: string): Promise<string> {
  const userId = await ensureTestUser();
  const { data, error } = await admin.from('tenants').insert({ name, owner_id: userId }).select('id').single();
  if (error || !data) throw new Error(`seedTenant failed: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function seedActiveTenancy(opts: {
  unitName: string;
  tenantName: string;
  rent: number;
  method: 'cash' | 'check' | 'transfer' | null;
}): Promise<{ unitId: string; tenantId: string; tenancyId: string }> {
  const userId = await ensureTestUser();
  const unitId = await seedUnit(opts.unitName);
  const tenantId = await seedTenant(opts.tenantName);
  const { data, error } = await admin
    .from('tenancies')
    .insert({
      owner_id: userId,
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent: opts.rent,
      start_date: '2026-01-01',
      payment_method: opts.method,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedActiveTenancy failed: ${error?.message ?? 'no row'}`);
  return { unitId, tenantId, tenancyId: data.id as string };
}
```

- [ ] **Step 2: Write `e2e/auth.setup.ts`**

```ts
import { test as setup, expect } from '@playwright/test';
import { ensureTestUser, resetTestUserData, TEST_USER } from './support/supabase-admin';

const AUTH_FILE = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await ensureTestUser();
  await resetTestUserData();

  await page.goto('/');
  await page.getByLabel('כתובת מייל').fill(TEST_USER.email);
  await page.getByLabel('סיסמה').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'התחבר', exact: true }).click();

  // The signed-in shell renders the main tabs only for an authenticated user.
  await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
```

- [ ] **Step 3: Run the setup project**

Run: `npx playwright test --project=setup`
Expected: PASS. `e2e/.auth/user.json` is created. This proves branch connectivity, test-user creation (with onboarding skipped), UI login, and storageState capture all work.

- [ ] **Step 4: Commit**

```bash
git add e2e/support/supabase-admin.ts e2e/auth.setup.ts
git commit -m "test(e2e): supabase admin helpers and auth setup"
```

---

### Task 4: Test fixtures + units flow spec

**Files:**
- Create: `e2e/support/fixtures.ts`
- Create: `e2e/tests/units.spec.ts`

**Interfaces:**
- Consumes: `resetTestUserData`, `seedUnit` from `../support/supabase-admin`.
- Produces: `test` (extended with an auto data-reset per test) and `expect`, re-exported for all mutating specs; `uniqueName(prefix): string`.

- [ ] **Step 1: Write `e2e/support/fixtures.ts`**

```ts
import { test as base } from '@playwright/test';
import { resetTestUserData } from './supabase-admin';

// Every test that imports this `test` starts from a clean backend for the
// test user, so tests are order-independent against the shared branch.
export const test = base.extend<{ cleanData: void }>({
  cleanData: [
    async ({}, use) => {
      await resetTestUserData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

let counter = 0;
/** A run-unique, human-readable name so assertions can target one entity. */
export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix} ${process.pid}-${counter}`;
}
```

- [ ] **Step 2: Write `e2e/tests/units.spec.ts`**

```ts
import { test, expect, uniqueName } from '../support/fixtures';
import { seedUnit } from '../support/supabase-admin';

test.describe('יחידות', () => {
  test('מצב ריק ואז הוספת יחידה דרך הטופס', async ({ page }) => {
    await page.goto('/?view=units');
    await expect(page.getByRole('heading', { name: 'מתחילים מהיחידה הראשונה' })).toBeVisible();

    const name = uniqueName('דירה');
    // Open the add form via the header action (unique, unlike the empty-state button).
    await page.locator('[data-guide="add-unit"]').click();
    await page.getByLabel(/שם היחידה/).fill(name);
    // In the form view only the submit button carries this label.
    await page.getByRole('button', { name: 'הוספת יחידה' }).click();

    await expect(page.getByText(name)).toBeVisible();
  });

  test('עריכת שם יחידה', async ({ page }) => {
    const original = uniqueName('דירה');
    await seedUnit(original);
    await page.goto('/?view=units');
    await expect(page.getByText(original)).toBeVisible();

    await page.getByRole('button', { name: 'ערוך' }).click();
    const updated = `${original} מעודכן`;
    await page.getByLabel(/שם היחידה/).fill(updated);
    await page.getByRole('button', { name: 'שמירת שינויים' }).click();

    await expect(page.getByText(updated)).toBeVisible();
  });

  test('העברת יחידה לארכיון מחזירה למצב ריק', async ({ page }) => {
    await seedUnit(uniqueName('דירה'));
    await page.goto('/?view=units');

    await page.getByRole('button', { name: 'העבר לארכיון' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'העבר לארכיון' }).click();

    await expect(page.getByRole('heading', { name: 'מתחילים מהיחידה הראשונה' })).toBeVisible();
  });

  test('חיפוש מסנן את רשימת היחידות', async ({ page }) => {
    // Search UI appears only when there are more than 3 units.
    const unique = uniqueName('ייחודית');
    await seedUnit(unique);
    await seedUnit(uniqueName('דירה'));
    await seedUnit(uniqueName('דירה'));
    await seedUnit(uniqueName('דירה'));
    await page.goto('/?view=units');

    await page.getByLabel('חיפוש יחידות').fill(unique);
    await expect(page.getByText(unique)).toBeVisible();
    // The four generic "דירה …" cards are filtered out.
    await expect(page.getByText(/^דירה /)).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run the units spec**

Run: `npx playwright test e2e/tests/units.spec.ts`
Expected: all 4 tests PASS. (If a selector is off, fix the selector — do not change app code. Re-run until green. On a genuine app defect, report it to the user before continuing.)

- [ ] **Step 4: Commit**

```bash
git add e2e/support/fixtures.ts e2e/tests/units.spec.ts
git commit -m "test(e2e): units flow (empty state, add, edit, archive, search)"
```

---

### Task 5: Tenants flow spec

**Files:**
- Create: `e2e/tests/tenants.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `uniqueName` from `../support/fixtures`; `seedUnit`, `seedTenant` from `../support/supabase-admin`.

- [ ] **Step 1: Write `e2e/tests/tenants.spec.ts`**

```ts
import { test, expect, uniqueName } from '../support/fixtures';
import { seedUnit, seedTenant } from '../support/supabase-admin';

test.describe('שוכרים', () => {
  test('הוספת שוכר עם שיוך ליחידה, שכר דירה ואמצעי תשלום', async ({ page }) => {
    const unitName = uniqueName('דירה');
    await seedUnit(unitName);
    const tenantName = uniqueName('שוכר');

    await page.goto('/?view=tenants');
    await page.locator('[data-guide="add-tenant"]').click();

    await page.getByLabel(/שם השוכר/).fill(tenantName);

    // Assign the unit (Radix Select → listbox options).
    await page.getByLabel('יחידה', { exact: true }).click();
    await page.getByRole('option', { name: unitName }).click();

    await page.getByLabel(/שכר דירה חודשי/).fill('3000');

    await page.getByLabel(/אופן תשלום/).click();
    await page.getByRole('option', { name: 'העברה בנקאית' }).click();

    // In the form view only the submit button carries this label.
    await page.getByRole('button', { name: 'הוספת שוכר' }).click();

    // The tenant card shows the name and the assigned unit.
    await expect(page.getByText(tenantName)).toBeVisible();
    await expect(page.getByText(unitName)).toBeVisible();
  });

  test('העברת שוכר לארכיון מחזירה למצב ריק', async ({ page }) => {
    await seedTenant(uniqueName('שוכר'));
    await page.goto('/?view=tenants');

    await page.getByRole('button', { name: 'העבר לארכיון' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'העבר לארכיון' }).click();

    await expect(page.getByRole('heading', { name: 'מוסיפים את השוכר הראשון' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tenants spec**

Run: `npx playwright test e2e/tests/tenants.spec.ts`
Expected: both tests PASS. Fix selectors if needed; do not change app code.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/tenants.spec.ts
git commit -m "test(e2e): tenants flow (add with unit assignment, archive)"
```

---

### Task 6: Payments flow spec (mark-paid + partial)

**Files:**
- Create: `e2e/tests/payments.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `uniqueName` from `../support/fixtures`; `seedActiveTenancy` from `../support/supabase-admin`.

Notes on the flow (verified against `src/components/PaymentsPage.tsx`):
- The rent card's mark-paid button is `[data-guide="rent-mark-paid"]`; its text is `markPaidLabel(payment_method)` (`transfer`→"בוצעה העברה", `check`→"הופקד צ'ק", `null`→"סמן כשולם"); it is disabled once `rentDue <= rentPaid`.
- The partial button is `[data-guide="rent-partial"]` ("תשלום חלקי") and opens the payment editor dialog (title "עדכון תשלום", amount field labelled "שולם עד עכשיו", submit "שמור תשלום").
- Seeding an active tenancy with `start_date: '2026-01-01'` and `rent > 0` gives a due current period, so the rent action is enabled on load.

- [ ] **Step 1: Write `e2e/tests/payments.spec.ts`**

```ts
import { test, expect, uniqueName } from '../support/fixtures';
import { seedActiveTenancy } from '../support/supabase-admin';

test.describe('תשלומים', () => {
  test('סימון שכר דירה כשולם — תווית לפי אמצעי תשלום (העברה)', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: 'transfer',
    });
    await page.goto('/?view=payments');

    const markBtn = page.locator('[data-guide="rent-mark-paid"]');
    await expect(markBtn).toBeVisible();
    await expect(markBtn).toContainText('בוצעה העברה');

    await markBtn.click();

    // Fully paid → the action disables itself and nothing remains due.
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toBeDisabled();
    await expect(page.getByText('נשאר ₪0')).toBeVisible();
  });

  test("תווית „הופקד צ'ק” כשאמצעי התשלום הוא צ'ק", async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: 'check',
    });
    await page.goto('/?view=payments');
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toContainText("הופקד צ'ק");
  });

  test('תווית ברירת מחדל „סמן כשולם” כשאין אמצעי תשלום', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: null,
    });
    await page.goto('/?view=payments');
    await expect(page.locator('[data-guide="rent-mark-paid"]')).toContainText('סמן כשולם');
  });

  test('תשלום חלקי מעדכן את היתרה', async ({ page }) => {
    await seedActiveTenancy({
      unitName: uniqueName('דירה'),
      tenantName: uniqueName('שוכר'),
      rent: 3000,
      method: null,
    });
    await page.goto('/?view=payments');

    await page.locator('[data-guide="rent-partial"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('עדכון תשלום')).toBeVisible();
    await dialog.getByLabel('שולם עד עכשיו').fill('1000');
    await dialog.getByRole('button', { name: 'שמור תשלום' }).click();

    // 3000 − 1000 = 2000 remaining on the rent card.
    await expect(page.getByText('נשאר ₪2,000')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the payments spec**

Run: `npx playwright test e2e/tests/payments.spec.ts`
Expected: all 4 tests PASS. If the mark-paid button is briefly disabled while the billing schedule generates on load, Playwright's `toContainText`/click auto-wait handles it; if a real timing gap appears, add `await expect(markBtn).toBeEnabled()` before the click (still not an app change). Fix selectors as needed; report genuine app defects to the user.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/payments.spec.ts
git commit -m "test(e2e): payments flow (mark paid label variants, partial payment)"
```

---

### Task 7: Auth flow spec (login / logout)

**Files:**
- Create: `e2e/tests/auth.spec.ts`

**Interfaces:**
- Consumes: `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` from `process.env` (loaded by the Playwright config); the `setup` project already ensured the user exists.

This spec runs signed-out, so it overrides the reused `storageState` with an empty one. It uses the base `@playwright/test` `test` (no data reset needed — it never touches app data).

- [ ] **Step 1: Write `e2e/tests/auth.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

// Start each test signed out, regardless of the project's stored auth state.
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.E2E_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD!;

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('כתובת מייל').fill(EMAIL);
  await page.getByLabel('סיסמה').fill(PASSWORD);
  await page.getByRole('button', { name: 'התחבר', exact: true }).click();
}

test.describe('אימות', () => {
  test('מדף הנחיתה מציג טופס התחברות', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'מערכת ניהול שכירות לבעלי דירות' })).toBeVisible();
    await expect(page.getByLabel('כתובת מייל')).toBeVisible();
  });

  test('כניסה עם מייל וסיסמה מציגה את לוח הבקרה', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();
  });

  test('התנתקות מחזירה למדף הנחיתה', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('tab', { name: 'סקירה' })).toBeVisible();

    await page.getByRole('button', { name: 'התנתקות מהמערכת' }).click();
    await expect(page.getByRole('heading', { name: 'מערכת ניהול שכירות לבעלי דירות' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the auth spec**

Run: `npx playwright test e2e/tests/auth.spec.ts`
Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/auth.spec.ts
git commit -m "test(e2e): auth flow (landing, login, logout)"
```

---

### Task 8: Full-suite run and documentation

**Files:**
- Create: `e2e/README.md`

**Interfaces:**
- Produces: a green full run of `npm run test:e2e` and a short runbook.

- [ ] **Step 1: Run the whole suite**

Run: `npm run test:e2e`
Expected: the `setup` project runs first, then all specs (auth, payments, tenants, units) PASS. Total ~13 tests green. If anything is flaky across the full run (data bleed), confirm the `cleanData` auto-fixture is imported in every mutating spec (all except `auth.spec.ts`).

- [ ] **Step 2: Write `e2e/README.md`**

````markdown
# E2E tests (Playwright)

Browser end-to-end tests that drive the real app against a dedicated Supabase branch.

## One-time setup

1. Create a Supabase **branch** for tests (Supabase dashboard → Branches, or the MCP `create_branch`).
2. Copy `.env.e2e.example` → `.env.e2e` (gitignored) and fill:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — the branch's URL and anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — the branch's service-role key (Node-side only; never shipped to the browser)
   - `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — the fixed test account (auto-created on first run)
3. `npx playwright install chromium`

## Running

```bash
npm run test:e2e         # headless, full suite
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # headed browser
npm run test:e2e:report  # open the last HTML report
```

## How it works

- `vite --mode e2e` serves the app on :8080 reading `.env.e2e`, so the app talks to the branch.
- The `setup` project (`e2e/auth.setup.ts`) creates/signs-in the test user once and saves `e2e/.auth/user.json`; specs reuse it.
- `e2e/support/supabase-admin.ts` (service-role) creates the test user and resets its data before each mutating test.
- Single worker, `fullyParallel: false`, for determinism against the shared branch.

## Coverage

- `auth.spec.ts` — landing, login, logout
- `units.spec.ts` — empty state, add, edit, archive, search
- `tenants.spec.ts` — add with unit assignment + payment method, archive
- `payments.spec.ts` — mark rent paid (label per payment method), partial payment

## Not covered yet (future)

- CI workflow (GitHub Actions provisioning a branch + secrets)
- Tenant payment summary dialog from the overview; utility/meter charges
- Password reset, notification settings, legal pages; other browsers / mobile viewports
````

- [ ] **Step 3: Commit**

```bash
git add e2e/README.md
git commit -m "docs(e2e): runbook for the Playwright suite"
```

---

## Self-Review

**1. Spec coverage** (against `2026-07-28-e2e-testing-suite-design.md`):
- Tooling/config (Playwright, Chromium, config, no vitest overlap) → Task 1. ✔
- Supabase branch backend + `.env.e2e` → Task 2. ✔
- Auth reuse via `storageState` + service-role user ensure/reset → Task 3. ✔
- File structure (`e2e/` with `support/`, `tests/`, `auth.setup.ts`, `.auth/`) → Tasks 1,3,4. ✔
- Auth spec → Task 7. Units → Task 4. Tenants → Task 5. Payments (mark-paid) → Task 6. ✔
- Selector strategy (role/label/text/`data-guide`) → applied in every spec. ✔
- Scripts + gitignore → Task 1. ✔
- "Verify suite is green" → Task 8. ✔
- **Scope change vs spec:** the spec's payments section also listed the *overview summary dialog*; this plan defers it (documented in `e2e/README.md` "Not covered yet") to avoid coupling to the Dashboard trigger and keep v1 tight and placeholder-free. Mark-paid + partial (the user's explicitly chosen "סימון כשולם" flow) are covered. Flag this to the user at review.

**2. Placeholder scan:** No TBD/TODO; every step has concrete commands or full code. ✔

**3. Type consistency:** `ensureTestUser`/`resetTestUserData`/`seedUnit`/`seedTenant`/`seedActiveTenancy`/`TEST_USER` defined in Task 3 are consumed with matching names/signatures in Tasks 3–6. `uniqueName`/`test`/`expect` from `fixtures.ts` (Task 4) are imported consistently in Tasks 4–6. `AUTH_FILE` path `e2e/.auth/user.json` matches between the config (Task 1) and `auth.setup.ts` (Task 3). ✔
