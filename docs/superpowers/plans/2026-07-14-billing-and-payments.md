# Billing and payments implementation plan

Spec: `docs/superpowers/specs/2026-07-14-billing-and-payments-design.md`

Goal: add a simple, RTL payment-tracking workflow for active tenancies: create charges, calculate meter charges, record full/partial payments, and see who owes what.

## Constraints

- Supabase project ref is `lwmddgwwfirkcaqaxdbh`.
- Do not use `mcp__supabase_branch` for writes.
- All tables must include `owner_id default auth.uid()` and RLS.
- Keep the first UI operational, not decorative.
- Do not use `src/utils/hebrewDates.ts` for billing generation.
- Hebrew-calendar automation needs a reliable calendar library and golden tests before production use.

## Tasks

- [x] Confirm MCP targets the correct Supabase project.
- [x] Close prerequisite integrity issue: `one_active_tenancy_per_tenant`.
- [x] Write the billing/payment design spec.
- [x] Task P1: apply payment schema migration with RLS and indexes.
- [x] Task P2: add TypeScript database types for payment tables.
- [x] Task P3: add payment API and React Query hooks.
- [x] Task P4: extend `סקירה` with tenant charge cards, payment summary, and quick actions.
- [x] Task P5: payment/partial editing, meter calculation, fixed utility prices, and additional fixed payments are available from `סקירה` and `תשלומים`.
- [x] Task P6: add focused RLS and ledger tests.
- [x] Task P7: TypeScript and production build pass; 34 tests cover payment editing, deletion, RLS, fixed terms, meter terms, and billing schedule generation.
- [x] Task P8: add per-tenancy Gregorian/Hebrew due-date settings, generated occurrences, and due-charge materialization.
- [x] Task P9: add payment history/debt view and keep rent, utilities, and added payments separate.
- [x] Task P10: require previous and current meter readings to be greater than 0 before calculation.
- [x] Task P11: apply the positive-meter DB constraint to the live Supabase project.

## Schema Sketch

Tables:

- `payment_types`
- `tenancy_payment_terms`
- `meter_readings`
- `charges`
- `payments`
- `payment_allocations`

Core invariant:

- A charge belongs to one active or historical tenancy.
- A payment can be allocated across one or more charges.
- Charge status is derived from allocations.
- Meter charge amount is snapshotted when created so later rate changes do not rewrite history.

## First UI

Add a focused `תשלומים` tab, while preserving every payment action in `סקירה`.

The first screen in `סקירה`:

- Summary row.
- Active tenant cards.
- Quick action buttons.
- Clear status labels: `שולם`, `חלקי`, `לא שולם`, `חסר מונה`.

Tenant cards should also show compact payment status so the user does not need to hunt for it.

Rent and additional charges stay separate in the overview. Utilities and custom charges get their own rows and payment state; they are not added into the rent editor.

## Verification

- `npx.cmd tsc --noEmit`
- `npm.cmd test` should include the new tests.
- Supabase security advisors checked after migration.
- Browser check at desktop and 375px.
- Live DB constraint migration `enforce_positive_meter_readings` applied successfully on 2026-07-15.
