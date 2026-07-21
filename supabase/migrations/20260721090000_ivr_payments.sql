-- Phone management hub (Yemot HaMashiach). The landlord calls in and, at any
-- point in the month, reaches every open charge — not only the overdue ones the
-- email reminder is about — to mark paid, voice-remind the tenant, or skip.
--
-- Already applied to the hosted project; kept here so the schema is
-- reproducible from the repo.

-- Payment logic shared by the phone menu and the email "mark paid" links, so
-- there is one implementation, not two. The token function (below) wraps it.
create or replace function public.mark_charge_paid_for_owner(p_owner uuid, p_charge uuid)
returns table (status text, charge_label text, charge_amount numeric, tenant_name text, unit_name text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_charge record;
  v_payment_id uuid;
  v_alloc record;
  v_payment_amount numeric;
begin
  select c.id as cid, c.tenancy_id as tid, c.label as lbl, c.amount_due as amt,
         te.name as tname, un.name as uname
  into v_charge
  from public.charges c
  join public.tenancies tn on tn.id = c.tenancy_id
  join public.tenants   te on te.id = tn.tenant_id
  join public.units     un on un.id = tn.unit_id
  where c.id = p_charge and c.owner_id = p_owner
  for update of c;

  if not found then
    return query select 'invalid'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  for v_alloc in
    select pa.id as aid, pa.payment_id as pid, pa.amount as amt
    from public.payment_allocations pa
    where pa.charge_id = v_charge.cid and pa.owner_id = p_owner
    for update
  loop
    select p.amount into v_payment_amount
    from public.payments p where p.id = v_alloc.pid and p.owner_id = p_owner
    for update;

    delete from public.payment_allocations pa where pa.id = v_alloc.aid;

    if v_payment_amount <= v_alloc.amt then
      delete from public.payments p where p.id = v_alloc.pid;
    else
      update public.payments p set amount = p.amount - v_alloc.amt where p.id = v_alloc.pid;
    end if;
  end loop;

  insert into public.payments (owner_id, tenancy_id, paid_at, amount, note)
  values (p_owner, v_charge.tid, current_date, v_charge.amt, 'סומן כשולם מהמענה הטלפוני')
  returning id into v_payment_id;

  insert into public.payment_allocations (owner_id, payment_id, charge_id, amount)
  values (p_owner, v_payment_id, v_charge.cid, v_charge.amt);

  return query select 'ok'::text, v_charge.lbl, v_charge.amt, v_charge.tname, v_charge.uname;
end;
$$;

revoke all on function public.mark_charge_paid_for_owner(uuid, uuid) from public, anon, authenticated;

create or replace function public.mark_charge_paid_via_token(p_token text)
returns table (status text, charge_label text, charge_amount numeric, tenant_name text, unit_name text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tok record;
  v_lbl text;
  v_amt numeric;
begin
  select t.* into v_tok
  from public.payment_action_tokens t where t.token = p_token for update;

  if not found then
    return query select 'invalid'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  if v_tok.used_at is not null then
    select c.label, c.amount_due into v_lbl, v_amt
    from public.charges c where c.id = v_tok.charge_id;
    return query select 'already'::text, v_lbl, v_amt, null::text, null::text;
    return;
  end if;

  if v_tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  update public.payment_action_tokens t set used_at = now() where t.token = p_token;
  return query select * from public.mark_charge_paid_for_owner(v_tok.owner_id, v_tok.charge_id);
end;
$$;

revoke all on function public.mark_charge_paid_via_token(text) from public, anon, authenticated;

-- Everything the phone needs to read one charge aloud and, on request, ring the
-- tenant. v_outstanding_charges carries no phone number.
create or replace function public.ivr_charge_details(p_owner uuid, p_charge uuid)
returns table (charge_label text, amount_due numeric, remaining numeric, due_date date,
               tenant_name text, tenant_phone text, unit_name text)
language sql security definer set search_path to ''
as $$
  select c.label, c.amount_due,
         c.amount_due - coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id = c.id), 0),
         c.due_date, te.name, te.phone, un.name
  from public.charges c
  join public.tenancies tn on tn.id = c.tenancy_id
  join public.tenants   te on te.id = tn.tenant_id
  join public.units     un on un.id = tn.unit_id
  where c.id = p_charge and c.owner_id = p_owner;
$$;

revoke all on function public.ivr_charge_details(uuid, uuid) from public, anon, authenticated;

-- All unpaid charges regardless of due date — so a mid-month call sees the
-- whole picture, including charges not yet due.
create or replace function public.ivr_open_charges(p_owner uuid)
returns table (charge_id uuid, remaining numeric, due_date date)
language sql security definer set search_path to ''
as $$
  select c.id,
         c.amount_due - coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id = c.id), 0),
         c.due_date
  from public.charges c
  where c.owner_id = p_owner
    and c.amount_due > coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id = c.id), 0)
  order by c.due_date;
$$;

revoke all on function public.ivr_open_charges(uuid) from public, anon, authenticated;

-- A spoken snapshot of the current month plus the overall open balance.
create or replace function public.ivr_month_summary(p_owner uuid, p_ref date)
returns table (month_charges int, month_paid int, month_open int, month_outstanding numeric,
               total_open int, total_outstanding numeric)
language sql security definer set search_path to ''
as $$
  with scoped as (
    select c.due_date,
           c.amount_due - coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id = c.id), 0) as remaining
    from public.charges c where c.owner_id = p_owner
  )
  select
    count(*) filter (where date_trunc('month', due_date) = date_trunc('month', p_ref))::int,
    count(*) filter (where date_trunc('month', due_date) = date_trunc('month', p_ref) and remaining <= 0)::int,
    count(*) filter (where date_trunc('month', due_date) = date_trunc('month', p_ref) and remaining > 0)::int,
    coalesce(sum(remaining) filter (where date_trunc('month', due_date) = date_trunc('month', p_ref) and remaining > 0), 0),
    count(*) filter (where remaining > 0)::int,
    coalesce(sum(remaining) filter (where remaining > 0), 0)
  from scoped;
$$;

revoke all on function public.ivr_month_summary(uuid, date) from public, anon, authenticated;

-- Who may drive the menu. Caller ID is the credential, so an explicit
-- allow-list rather than a lookup on tenant/owner phone fields.
create table if not exists public.ivr_authorized_callers (
  phone text primary key,
  owner_id uuid not null,
  label text,
  created_at timestamptz not null default now()
);
alter table public.ivr_authorized_callers enable row level security;
-- No policies: service role only.

-- One row per phone call. The charge list is frozen at call start (see
-- ivr_open_charges) and a single step counter names each keypad prompt so a
-- value from one stage is never read as another's.
create table if not exists public.ivr_call_state (
  call_id text primary key,
  owner_id uuid not null,
  stage text not null default 'menu',
  charge_ids uuid[] not null default '{}',
  position int not null default 0,
  marked int not null default 0,
  reminded int not null default 0,
  step int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ivr_call_state enable row level security;
-- No policies: service role only.
create index if not exists ivr_call_state_created_idx on public.ivr_call_state (created_at);

-- Shared secret so only Yemot (configured with the full URL) can drive the menu.
insert into public.private_settings (key, value)
select 'ivr_secret', encode(gen_random_bytes(24), 'hex')
where not exists (select 1 from public.private_settings where key = 'ivr_secret');