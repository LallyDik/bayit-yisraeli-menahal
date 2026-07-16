create table if not exists public.tenancy_billing_settings (
  tenancy_id uuid primary key,
  owner_id uuid not null default auth.uid(),
  calendar_type text not null default 'gregorian'
    check (calendar_type in ('gregorian', 'hebrew')),
  due_day integer not null default 1
    check (due_day between 1 and 31),
  schedule_start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenancy_billing_settings_hebrew_day_check
    check (calendar_type <> 'hebrew' or due_day <= 30),
  constraint tenancy_billing_settings_tenancy_owner_fkey
    foreign key (tenancy_id, owner_id)
    references public.tenancies (id, owner_id)
    on delete cascade
);

create index if not exists tenancy_billing_settings_owner_idx
  on public.tenancy_billing_settings (owner_id);

alter table public.tenancy_billing_settings enable row level security;

drop policy if exists "Owners manage their billing settings" on public.tenancy_billing_settings;
create policy "Owners manage their billing settings"
  on public.tenancy_billing_settings
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.billing_schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  tenancy_id uuid not null,
  sequence_no integer not null check (sequence_no > 0),
  due_date date not null,
  calendar_label text not null check (length(trim(calendar_label)) > 0),
  period_key text not null check (length(trim(period_key)) > 0),
  created_at timestamptz not null default now(),
  constraint billing_schedule_occurrences_tenancy_owner_fkey
    foreign key (tenancy_id, owner_id)
    references public.tenancies (id, owner_id)
    on delete cascade,
  constraint billing_schedule_occurrences_owner_tenancy_period_key
    unique (owner_id, tenancy_id, period_key),
  constraint billing_schedule_occurrences_owner_tenancy_due_date
    unique (owner_id, tenancy_id, due_date)
);

create index if not exists billing_schedule_occurrences_due_idx
  on public.billing_schedule_occurrences (due_date, owner_id);

alter table public.billing_schedule_occurrences enable row level security;

drop policy if exists "Owners manage their billing occurrences" on public.billing_schedule_occurrences;
create policy "Owners manage their billing occurrences"
  on public.billing_schedule_occurrences
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.save_tenancy_billing_schedule(
  p_tenancy_id uuid,
  p_calendar_type text,
  p_due_day integer,
  p_schedule_start_date date,
  p_occurrences jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_occurrence_count integer;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_calendar_type not in ('gregorian', 'hebrew') then
    raise exception 'unsupported calendar type' using errcode = '22023';
  end if;

  if p_due_day < 1 or p_due_day > (case when p_calendar_type = 'hebrew' then 30 else 31 end) then
    raise exception 'invalid due day' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tenancies
    where id = p_tenancy_id and owner_id = v_owner_id
  ) then
    raise exception 'tenancy not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_occurrences) <> 'array' then
    raise exception 'occurrences must be an array' using errcode = '22023';
  end if;

  v_occurrence_count := jsonb_array_length(p_occurrences);
  if v_occurrence_count < 12 or v_occurrence_count > 72 then
    raise exception 'schedule must contain between 12 and 72 occurrences' using errcode = '22023';
  end if;

  insert into public.tenancy_billing_settings (
    tenancy_id, owner_id, calendar_type, due_day, schedule_start_date, updated_at
  ) values (
    p_tenancy_id, v_owner_id, p_calendar_type, p_due_day,
    greatest(p_schedule_start_date, current_date), now()
  )
  on conflict (tenancy_id) do update set
    calendar_type = excluded.calendar_type,
    due_day = excluded.due_day,
    schedule_start_date = excluded.schedule_start_date,
    updated_at = now()
  where public.tenancy_billing_settings.owner_id = v_owner_id;

  delete from public.billing_schedule_occurrences
  where owner_id = v_owner_id
    and tenancy_id = p_tenancy_id
    and due_date >= current_date;

  insert into public.billing_schedule_occurrences (
    owner_id, tenancy_id, sequence_no, due_date, calendar_label, period_key
  )
  select
    v_owner_id,
    p_tenancy_id,
    occurrence.sequence_no,
    occurrence.due_date,
    occurrence.calendar_label,
    occurrence.period_key
  from jsonb_to_recordset(p_occurrences) as occurrence(
    sequence_no integer,
    due_date date,
    calendar_label text,
    period_key text
  )
  where occurrence.sequence_no > 0
    and occurrence.due_date >= greatest(p_schedule_start_date, current_date)
    and length(trim(occurrence.calendar_label)) > 0
    and length(trim(occurrence.period_key)) > 0
  on conflict (owner_id, tenancy_id, period_key) do update set
    sequence_no = excluded.sequence_no,
    due_date = excluded.due_date,
    calendar_label = excluded.calendar_label;
end;
$$;

revoke all on function public.save_tenancy_billing_schedule(uuid, text, integer, date, jsonb) from public;
grant execute on function public.save_tenancy_billing_schedule(uuid, text, integer, date, jsonb) to authenticated;

create or replace function public.materialize_due_charges()
returns integer
language plpgsql
security definer
set search_path = ''
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
    and mod(occurrence.sequence_no - 1, term.frequency_months) = 0
    and (v_owner_id is null or occurrence.owner_id = v_owner_id)
  on conflict (owner_id, tenancy_id, payment_type, period_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;

  return v_inserted;
end;
$$;

revoke all on function public.materialize_due_charges() from public;
grant execute on function public.materialize_due_charges() to authenticated;

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'materialize-rental-charges-daily') then
    perform cron.schedule(
      'materialize-rental-charges-daily',
      '5 0 * * *',
      'select public.materialize_due_charges();'
    );
  end if;
end;
$$;
