-- How the tenant pays this rental. Optional; null = unspecified (existing
-- tenancies). Only the "mark as paid" button LABEL keys off it — no behavior
-- change. RLS on tenancies already covers the new column; no policy change.
alter table public.tenancies
  add column if not exists payment_method text
  check (payment_method in ('cash', 'check', 'transfer'));
