# Billing and payments design

Date: 2026-07-14
Status: draft from user decisions
Supabase project: `lwmddgwwfirkcaqaxdbh`

## Goal

Give a landlord one simple place to see who paid, who paid partially, and who still owes.

The product is not an accounting system and does not issue receipts. It is a practical rental-payment tracker with rent, utilities, house committee, gas, and custom payment types.

## User Decisions

- No receipts.
- Payments are marked manually.
- The default setup should be ready to use but editable.
- Each active tenancy has an entry date and a payment due date.
- Rent is monthly.
- Other payment types can be monthly or bimonthly.
- Rent and additional charges are separate items; electricity, water, gas, committee fees, and custom charges are never folded into the rent payment.
- A dedicated `תשלומים` tab shows only payment work, while the same actions remain available from `סקירה`.
- Electricity and water are configured per active unit/tenant: last meter, current meter, editable unit rate, calculation, and paid status.
- Electricity and water can be switched from meter calculation to a fixed price.
- Additional fixed payments are attached to a specific active unit/tenant and can recur monthly or bimonthly.
- Additional payments can also use a meter, with the same last/current reading and editable unit-rate flow.
- In each tenancy group, rent is the dominant full-width card; electricity, water, and added payments share one secondary grid.
- Bimonthly payments use the same due day as rent.
- A payment type can be fixed-price or meter-based.
- Meter-based charges are calculated from current reading minus previous reading, multiplied by a unit rate.
- No extra fixed service fee is needed.
- Opening electricity/water readings at move-in are optional.
- A meter charge cannot be calculated unless both the previous reading and the current reading are entered and greater than 0.
- The first charge after a mid-period move-in is manual, not automatic prorating.
- Hebrew-calendar monthly billing creates 13 charges in a leap year, including Adar I and Adar II.
- The main product priority is: simple, clear, fast.

## UX Shape

Payments remain part of the first screen, replacing the old rent-only `תשלומי החודש` block. There is also a dedicated `תשלומים` tab for a focused view containing only payment work. The landlord can complete every payment action from `סקירה`; the dedicated tab is a filter, not the only place where actions exist.

The first-screen work view:

- Top summary strip: expected, paid, remaining, and counts by status.
- Tenant cards grouped by active tenancy.
- Each tenant card shows current/near charges:
  - rent as its own monthly item
  - each electricity/water/gas/committee/custom charge as a separate item
  - due date
  - amount
  - paid amount
  - status: unpaid, partial, paid, waiting for meter
- Primary actions:
  - `סמן שולם`
  - `רשום תשלום חלקי`
  - `הזן קריאת מונה`
  - `צור חיוב ידני`

Electricity/water card flow:

- Show `יחידה — שוכר` in the enclosing payment group.
- Show the last recorded meter.
- Enter the current meter.
- Show and edit the price per unit.
- Calculate the charge and snapshot readings/rate on the charge.
- Mark paid or edit a partial payment.
- Allow switching to a fixed-price calculation.

Settings should live in a sheet/dialog, not as the default screen:

- Calendar type: Gregorian or Hebrew.
- Due day.
- Payment types and frequency.
- Fixed amount or meter calculation.
- Per-tenancy overrides when needed.

## Data Model

Recommended first implementation tables:

- `payment_types`
- `tenancy_payment_terms`
- `meter_readings`
- `charges`
- `payments`
- `payment_allocations`

Optional later table:

- `billing_settings` for owner-level defaults, if defaults grow beyond a small set of seed rows and per-tenancy terms.

Financial state is derived:

- `charges.amount_due` is the ledger expectation.
- `payment_allocations.amount` is what has been applied to each charge.
- status is derived as paid / partial / unpaid / waiting_for_meter.

No direct client-side rewriting of paid totals should be trusted as the source of truth.

## Hebrew Calendar

The current `src/utils/hebrewDates.ts` is approximate and must not be used for billing generation.

Use a reliable Hebrew calendar implementation before generating Hebrew-calendar recurring charges. Required golden cases:

- Hebrew leap year has 13 months.
- Adar I and Adar II both generate monthly charges.
- If a selected due day does not exist in a month, use that month's last valid day.

## MVP Scope

Build a minimal useful version before automation:

- Store payment types, terms, charges, payments, allocations, and readings.
- Extend `סקירה` with payment status and quick actions.
- Show active tenants and their charges both in the overview and in a focused payments tab.
- Add compact payment status to tenant cards.
- Allow manual charge creation.
- Allow recording full or partial payment.
- Allow meter reading entry that calculates a charge.

Implemented in this branch:

- Automatic background billing jobs.
- Per-tenancy Gregorian/Hebrew payment schedules.
- Payment history and remaining debt view.

Deferred:

- Email/SMS reminders.
- Receipts.
- Import/export.
- Complex accounting reports.

## Acceptance

- Owner sees only their own payment data through RLS.
- One click can mark a full charge paid.
- Partial payments are visible and do not hide the remaining balance.
- Meter charges show previous reading, current reading, consumption, rate, and calculated amount.
- Payment status is visible on entry without opening a separate tab.
- The UI stays RTL and fast on mobile.
