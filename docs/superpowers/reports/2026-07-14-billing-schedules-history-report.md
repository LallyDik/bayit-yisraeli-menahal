# Billing schedules and history report

Date: 2026-07-14

## Completed

- Added per-tenancy payment settings: Gregorian or Hebrew calendar, due day, and schedule start date.
- Added generated billing occurrences with Hebrew leap-year support, including Adar I and Adar II.
- Materialized due rent/fixed charges from the billing schedule; meter charges remain manual until readings are entered.
- Added default schedules for active tenancies so the app works immediately, with per-tenancy override.
- Added a payment history/debt dialog showing due, paid, and remaining balances.
- Kept all payment actions available from the overview and from the payments tab.
- Added editable previous/current meter fields for utilities and added meter payments.
- Blocked meter calculation unless previous reading and current reading are both greater than 0 and current is not below previous.
- Added and applied a migration to enforce positive meter readings and meter ordering at the database layer.
- Added entry date to the tenant form; payment due date is configured separately from the payments screen.

## Verification

- `npx.cmd tsc --noEmit` passed.
- `npm.cmd test` passed: 34/34.
- `npm.cmd run lint` passed with 7 existing shadcn fast-refresh warnings.
- `npm.cmd run build` passed.

## Supabase Migration

- Live Supabase migration `enforce_positive_meter_readings` applied successfully on 2026-07-15.
- The local migration file is present at `supabase/migrations/20260714224500_enforce_positive_meter_readings.sql`.
