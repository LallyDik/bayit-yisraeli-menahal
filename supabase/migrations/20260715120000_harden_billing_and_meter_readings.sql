-- Security hardening: SECURITY DEFINER must never treat an anonymous caller
-- as an owner of every row. Keep the function owner-scoped and authenticated.
create or replace function public.materialize_due_charges()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_inserted integer := 0;
  v_step integer := 0;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

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
  where occurrence.owner_id = v_owner_id
    and occurrence.due_date <= current_date
    and occurrence.due_date >= tenancy.start_date
    and (tenancy.end_date is null or occurrence.due_date <= tenancy.end_date)
    and tenancy.monthly_rent is not null
    and tenancy.monthly_rent > 0
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
  where occurrence.owner_id = v_owner_id
    and occurrence.due_date <= current_date
    and occurrence.due_date >= tenancy.start_date
    and (tenancy.end_date is null or occurrence.due_date <= tenancy.end_date)
    and term.archived_at is null
    and term.calculation_type = 'fixed'
    and term.fixed_amount is not null
    and occurrence.sequence_no >= term.starts_on_sequence
    and mod(occurrence.sequence_no - term.starts_on_sequence, term.frequency_months) = 0
  on conflict (owner_id, tenancy_id, payment_type, period_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;
  return v_inserted;
end;
$function$;

revoke all on function public.materialize_due_charges() from public;
revoke execute on function public.materialize_due_charges() from anon;
revoke execute on function public.save_tenancy_billing_schedule(uuid, text, integer, date, jsonb) from anon;
grant execute on function public.materialize_due_charges() to authenticated;

-- Immutable meter history belongs to the unit, not to a tenancy. A composite
-- foreign key prevents attaching a reading to another owner's unit.
create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null,
  meter_kind text not null check (meter_kind in ('electricity', 'water')),
  reading_date date not null default current_date,
  value numeric(12,3) not null check (value >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint meter_readings_unit_owner_fkey
    foreign key (unit_id, owner_id) references public.units (id, owner_id) on delete restrict,
  constraint meter_readings_unit_kind_date_key
    unique (unit_id, meter_kind, reading_date)
);

create index if not exists meter_readings_lookup_idx
  on public.meter_readings (unit_id, meter_kind, reading_date desc);

alter table public.meter_readings enable row level security;
drop policy if exists "Owners manage their meter readings" on public.meter_readings;
create policy "Owners manage their meter readings"
  on public.meter_readings
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
