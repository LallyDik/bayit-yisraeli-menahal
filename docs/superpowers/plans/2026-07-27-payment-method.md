# Payment Method + Adaptive Mark-Paid Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a landlord optionally record how a tenant pays (cash / check / transfer) on the tenancy, and adapt the "סמן כשולם" button label accordingly (e.g. "בוצעה העברה").

**Architecture:** A nullable `payment_method` column on `tenancies` (carried automatically by `listTenancies`' `select('*')` into `TenancyWithNames`). A pure `markPaidLabel()` maps the method to a Hebrew label. `TenantForm` gains an optional select; the mark-paid buttons that have the tenancy in scope use `markPaidLabel(tenancy.payment_method)`.

**Tech Stack:** React 18 + TS + Vite, shadcn/ui (Select), Supabase (Postgres), Vitest (node env).

## Global Constraints

- Hebrew, RTL; logical Tailwind props only (`ps-`/`pe-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- `payment_method` values: `'cash' | 'check' | 'transfer'`; column is nullable, no default (existing tenancies = `null`). The field is OPTIONAL in the form.
- Label mapping (verbatim): `cash` → `שולם`, `transfer` → `בוצעה העברה`, `check` → `הופקד צ'ק`, `null`/unset → `סמן כשולם`.
- Scope: app-only. The reminder-email "סמן כשולם" link is NOT changed.
- `src/types/database.ts` is edited BY HAND (do not run type regeneration — it would clobber prior manual edits).
- No React unit-test harness (node-env Vitest, no jsdom/RTL — do NOT add). The only unit-tested piece is `markPaidLabel`. UI verified via `npx tsc --noEmit` + `npm run build` + manual.
- Surface boundary (deliberate): only the mark-paid buttons that already have the `tenancy` in scope adapt — `PaymentsPage` rent button and both `TenantPaymentSummaryDialog` buttons. The utility/additional-charge buttons inside `PaymentsPage`'s generic per-charge sub-components (`FixedTermRow` etc.) keep `סמן כשולם` for now.

---

### Task 1: payment_method column + types

**Files:**
- Create: `supabase/migrations/20260727130000_tenancy_payment_method.sql`
- Modify: `src/types/database.ts` (the `tenancies` Row/Insert/Update blocks)

**Interfaces:**
- Produces: `tenancies.payment_method` in the DB, and `payment_method: 'cash' | 'check' | 'transfer' | null` on the generated `Tenancy` type (so `TenancyWithNames.payment_method` and `TenancyInsert.payment_method?` exist for later tasks).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260727130000_tenancy_payment_method.sql`:

```sql
-- How the tenant pays this rental. Optional; null = unspecified (existing
-- tenancies). Only the "mark as paid" button LABEL keys off it — no behavior
-- change. RLS on tenancies already covers the new column; no policy change.
alter table public.tenancies
  add column if not exists payment_method text
  check (payment_method in ('cash', 'check', 'transfer'));
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name `tenancy_payment_method`, body = the SQL above). Pre-scoped to project `lwmddgwwfirkcaqaxdbh`.

- [ ] **Step 3: Add the column to the generated types**

In `src/types/database.ts`, find the `tenancies:` table block (around line 278). Add `payment_method` to each of its three shapes:

- In `Row: { ... }` add: `payment_method: 'cash' | 'check' | 'transfer' | null`
- In `Insert: { ... }` add: `payment_method?: 'cash' | 'check' | 'transfer' | null`
- In `Update: { ... }` add: `payment_method?: 'cash' | 'check' | 'transfer' | null`

(Place each next to the existing `monthly_rent` line, matching indentation.)

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: passes (no errors). This confirms `Tenancy`/`TenancyInsert` now carry the field.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260727130000_tenancy_payment_method.sql src/types/database.ts
git commit -m "feat(payments): add optional payment_method to tenancies"
```

---

### Task 2: markPaidLabel util + test

**Files:**
- Create: `src/utils/payment.ts`
- Create: `tests/payment.test.ts`

**Interfaces:**
- Produces: `type PaymentMethod = 'cash' | 'check' | 'transfer'`; `PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[]`; `markPaidLabel(method: PaymentMethod | null | undefined): string`. Tasks 3 and 4 import these.

- [ ] **Step 1: Write the failing test**

Create `tests/payment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { markPaidLabel } from '../src/utils/payment';

describe('markPaidLabel', () => {
  it('cash → שולם', () => { expect(markPaidLabel('cash')).toBe('שולם'); });
  it('transfer → בוצעה העברה', () => { expect(markPaidLabel('transfer')).toBe('בוצעה העברה'); });
  it("check → הופקד צ'ק", () => { expect(markPaidLabel('check')).toBe("הופקד צ'ק"); });
  it('null → default סמן כשולם', () => { expect(markPaidLabel(null)).toBe('סמן כשולם'); });
  it('undefined → default סמן כשולם', () => { expect(markPaidLabel(undefined)).toBe('סמן כשולם'); });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/payment.test.ts`
Expected: FAIL — `Failed to resolve import "../src/utils/payment"`.

- [ ] **Step 3: Implement the util**

Create `src/utils/payment.ts`:

```ts
export type PaymentMethod = 'cash' | 'check' | 'transfer';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'מזומן' },
  { value: 'transfer', label: 'העברה בנקאית' },
  { value: 'check', label: "צ'ק" },
];

/** Label for the "mark as paid" action, tuned to how this tenant pays. */
export function markPaidLabel(method: PaymentMethod | null | undefined): string {
  switch (method) {
    case 'cash':     return 'שולם';
    case 'transfer': return 'בוצעה העברה';
    case 'check':    return "הופקד צ'ק";
    default:         return 'סמן כשולם';
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/payment.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/payment.ts tests/payment.test.ts
git commit -m "feat(payments): markPaidLabel util for payment-method-aware labels"
```

---

### Task 3: payment-method select in TenantForm, wired through Index

**Files:**
- Modify: `src/components/TenantForm.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `PaymentMethod`, `PAYMENT_METHOD_OPTIONS` from Task 2; `payment_method` on `TenancyInsert` from Task 1.
- Produces: `payment_method` flows from the form into `createTenancy`/`updateTenancy`.

- [ ] **Step 1: TenantForm — imports and the onSubmit/initialData types**

In `src/components/TenantForm.tsx`, add to imports:

```ts
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from '@/utils/payment';
```

Add a sentinel next to `NO_UNIT`:

```ts
const NO_METHOD = 'none';
```

In `TenantFormProps.onSubmit`, add `payment_method` to the values object type (after `start_date: string;`):

```ts
    payment_method: PaymentMethod | null;
```

In `initialData`'s type, extend it to include the field:

```ts
  initialData?: Partial<Tenant> & { unit_id?: string | null; monthly_rent?: number | null; start_date?: string; payment_method?: PaymentMethod | null };
```

- [ ] **Step 2: TenantForm — state + submit**

Add state next to the others (after `startDate`):

```ts
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData.payment_method ?? NO_METHOD);
```

In `handleSubmit`'s `onSubmit({ ... })` call, add (after `start_date: startDate,`):

```ts
      payment_method: hasUnit && paymentMethod !== NO_METHOD ? (paymentMethod as PaymentMethod) : null,
```

- [ ] **Step 3: TenantForm — the select field**

Inside the `{unitId !== NO_UNIT && ( ... )}` block, after the rent/start-date grid `</div>` (the `grid grid-cols-1 gap-4 sm:grid-cols-2` container), add a new field:

```tsx
              <div className="space-y-2">
                <Label htmlFor="tenant-payment-method" className="text-base font-medium">אופן תשלום - אופציונלי</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="tenant-payment-method" className="text-lg p-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_METHOD}>לא צוין</SelectItem>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">קובע את הניסוח של כפתור „סמן כשולם”.</p>
              </div>
```

(Place it as a sibling right after the closing `</div>` of the rent+date grid, still inside the `unitId !== NO_UNIT` block, so it only shows when a unit is assigned.)

- [ ] **Step 4: Index.tsx — thread payment_method through the save flow**

In `src/pages/Index.tsx`:

(a) In `handleTenantSubmit`, the destructure currently reads:
```tsx
    const { unit_id, monthly_rent, start_date, ...fields } = values;
```
change to:
```tsx
    const { unit_id, monthly_rent, start_date, payment_method, ...fields } = values;
```
and update the two calls to pass it:
```tsx
      const saved = editingTenant
        ? await saveEditedTenant(editingTenant, fields, unit_id, monthly_rent, start_date, payment_method)
        : await saveNewTenant(fields, unit_id, monthly_rent, start_date, payment_method);
```

(b) `saveNewTenant` signature — add the param and pass it to `createTenancy`:
```tsx
  const saveNewTenant = async (
    fields: TenantFields,
    unitId: string | null,
    monthlyRent: number | null,
    startDate: string,
    paymentMethod: 'cash' | 'check' | 'transfer' | null,
  ): Promise<boolean> => {
```
In its `createTenancy({ ... })` call add `payment_method: paymentMethod,`.

(c) `saveEditedTenant` signature — add the same param. It has several branches that call `createTenancy` and one that builds a `patch` for `updateTenancy`:
- Add `paymentMethod` param to the signature.
- In each `createTenancy({ ... })` call, add `payment_method: paymentMethod,`.
- In the `updateTenancy` `patch` branch, extend the patch type and set it when changed:
```tsx
        const patch: { monthly_rent?: number; start_date?: string; payment_method?: 'cash' | 'check' | 'transfer' | null } = {};
        if (monthlyRent !== null && Number(monthlyRent) !== Number(current.monthly_rent)) patch.monthly_rent = monthlyRent;
        if (startDate && startDate !== current.start_date) patch.start_date = startDate;
        if (paymentMethod !== (current.payment_method ?? null)) patch.payment_method = paymentMethod;
```

(d) The `TenantForm` `initialData` for editing — add `payment_method` from the active tenancy:
```tsx
                    payment_method: activeByTenantId.get(editingTenant.id)?.payment_method ?? null,
```
(add it next to the existing `monthly_rent`/`start_date` lines in that `initialData={{ ... }}` object).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Then `npm run dev`, edit a tenant with a unit → the "אופן תשלום" select appears, defaults to "לא צוין"; pick "העברה בנקאית", save; reopen the tenant → it persists.

- [ ] **Step 6: Commit**

```bash
git add src/components/TenantForm.tsx src/pages/Index.tsx
git commit -m "feat(payments): optional payment-method select on the tenant form"
```

---

### Task 4: adapt the mark-paid button labels

**Files:**
- Modify: `src/components/TenantPaymentSummaryDialog.tsx`
- Modify: `src/components/PaymentsPage.tsx`

**Interfaces:**
- Consumes: `markPaidLabel` (Task 2); `tenancy.payment_method` (Task 1, via `TenancyWithNames`).

- [ ] **Step 1: TenantPaymentSummaryDialog — import + both buttons**

In `src/components/TenantPaymentSummaryDialog.tsx`, add:

```ts
import { markPaidLabel } from '@/utils/payment';
```

The component has `tenancy` in scope. Replace the rent button label (currently `{pendingKeys.has(tenancy.id) ? 'שומר...' : 'סמן כשולם'}`) with:

```tsx
                  {pendingKeys.has(tenancy.id) ? 'שומר...' : markPaidLabel(tenancy.payment_method)}
```

And the additional-charge button label (currently `{pending ? 'שומר...' : 'סמן כשולם'}`) with:

```tsx
                            {pending ? 'שומר...' : markPaidLabel(tenancy.payment_method)}
```

- [ ] **Step 2: PaymentsPage — import + the rent button**

In `src/components/PaymentsPage.tsx`, add:

```ts
import { markPaidLabel } from '@/utils/payment';
```

At the rent mark-paid button (the one whose disabled prop reads `rentDue <= rentPaid || pendingKeys.has(tenancy.id)`, with `data-guide="rent-mark-paid"`), replace `{pendingKeys.has(tenancy.id) ? 'שומר...' : 'סמן כשולם'}` with:

```tsx
                        {pendingKeys.has(tenancy.id) ? 'שומר...' : markPaidLabel(tenancy.payment_method)}
```

Leave the three utility/additional-charge buttons (`isMarking ? 'שומר...' : 'סמן כשולם'` inside the per-charge sub-components) UNCHANGED — they are outside this task's surface boundary (no tenancy in scope).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Then `npm run dev`: set a tenant's payment method to "העברה בנקאית", open their payment summary and the Payments tab → the rent "mark paid" button reads **בוצעה העברה**; a tenant with no method set still reads **סמן כשולם**.

- [ ] **Step 4: Commit**

```bash
git add src/components/TenantPaymentSummaryDialog.tsx src/components/PaymentsPage.tsx
git commit -m "feat(payments): adaptive mark-paid label on rent + payment summary"
```

---

## Final verification

- [ ] `npx tsc --noEmit`, `npm test` (incl. `payment.test.ts`), `npm run build` all pass.
- [ ] Tenant with `transfer` → rent button + summary dialog read "בוצעה העברה"; with `check` → "הופקד צ'ק"; with `cash` → "שולם"; unset → "סמן כשולם".
- [ ] Existing tenants (no method) are unaffected everywhere.
