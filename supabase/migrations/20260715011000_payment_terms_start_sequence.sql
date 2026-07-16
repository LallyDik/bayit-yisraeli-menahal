alter table public.tenancy_payment_terms
  add column starts_on_sequence integer not null default 1 check (starts_on_sequence > 0);

create or replace function public.materialize_due_charges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_inserted integer := 0;
  v_step integer := 0;
begin
  insert into public.charges (
    owner_id, tenancy_id, payment_type, label, period_key, due_date, amount_due
  )
  select
    occurrence.owner_id,
    occurrence.tenancy_id,
    'rent',
    'שכר דירה — ' || occurrence.calendar_label,
    'rent:' || occurrence.period_key,
    occurrence.due_date,
    tenancy.monthly_rent
  from public.billing_schedule_occurrences occurrence
  join public.tenancies tenancy
    on tenancy.id = occurrence.tenancy_id
   and tenancy.owner_id = occurrence.owner_id
  where occurrence.due_date <= current_date
    and occurrence.due_date >= tenancy.start_date
    and (tenancy.end_date is null or occurrence.due_date <= tenancy.end_date)
    and tenancy.monthly_rent is not null
    and tenancy.monthly_rent > 0
    and (v_owner_id is null or occurrence.owner_id = v_owner_id)
  on conflict (owner_id, tenancy_id, payment_type, period_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;

  insert into public.charges (
    owner_id, tenancy_id, payment_type, label, period_key, due_date, amount_due
  )
  select
    occurrence.owner_id,
    occurrence.tenancy_id,
    term.payment_type,
    term.label || ' — ' || occurrence.calendar_label,
    'term:' || term.id::text || ':' || occurrence.period_key,
    occurrence.due_date,
    term.fixed_amount
  from public.billing_schedule_occurrences occurrence
  join public.tenancies tenancy
    on tenancy.id = occurrence.tenancy_id
   and tenancy.owner_id = occurrence.owner_id
  join public.tenancy_payment_terms term
    on term.tenancy_id = occurrence.tenancy_id
   and term.owner_id = occurrence.owner_id
  where occurrence.due_date <= current_date
    and occurrence.due_date >= tenancy.start_date
    and (tenancy.end_date is null or occurrence.due_date <= tenancy.end_date)
    and term.archived_at is null
    and term.calculation_type = 'fixed'
    and term.fixed_amount is not null
    and occurrence.sequence_no >= term.starts_on_sequence
    and mod(occurrence.sequence_no - term.starts_on_sequence, term.frequency_months) = 0
    and (v_owner_id is null or occurrence.owner_id = v_owner_id)
  on conflict (owner_id, tenancy_id, payment_type, period_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;

  return v_inserted;
end;
$$;

revoke all on function public.materialize_due_charges() from public;
grant execute on function public.materialize_due_charges() to authenticated;
