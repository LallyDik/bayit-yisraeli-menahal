-- Email payment reminders: what the reminder Edge Function reads, plus the
-- single-use tokens behind the "סמן כשולם" links in the email.
--
-- Applied to the hosted project already; this file exists so the schema is
-- reproducible from the repo.

-- Charges that are due but not fully covered by allocations. security_invoker
-- so RLS still applies to anyone querying it with a user JWT; the reminder
-- function reads it with the service role.
create or replace view public.v_outstanding_charges
with (security_invoker = true) as
  select c.owner_id,
         c.id as charge_id,
         c.tenancy_id,
         c.payment_type,
         c.label,
         c.due_date,
         c.amount_due,
         coalesce(p.paid, 0::numeric) as paid_amount,
         c.amount_due - coalesce(p.paid, 0::numeric) as remaining,
         u.name as unit_name,
         t.name as tenant_name
    from public.charges c
    join public.tenancies tn on tn.id = c.tenancy_id
    join public.units u on u.id = tn.unit_id
    join public.tenants t on t.id = tn.tenant_id
    left join lateral (
      select sum(a.amount) as paid
        from public.payment_allocations a
       where a.charge_id = c.id
    ) p on true
   where c.due_date <= current_date
     and c.amount_due > coalesce(p.paid, 0::numeric);

-- The anon key is public, so JWT verification alone would let anyone trigger a
-- reminder blast. The scheduler sends a shared secret that lives only here.
create table if not exists public.private_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.private_settings enable row level security;
-- No policies on purpose: service role only.

-- One row per "mark paid" link. The token is the credential (the recipient is
-- not logged in), so it is single-use and expires.
create table if not exists public.payment_action_tokens (
  token text primary key,
  charge_id uuid not null references public.charges(id) on delete cascade,
  owner_id uuid not null,
  action text not null default 'mark_paid',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_action_tokens_charge_idx
  on public.payment_action_tokens (charge_id);
alter table public.payment_action_tokens enable row level security;
-- No policies on purpose: only the SECURITY DEFINER function below touches it.

-- set_charge_payment_state needs auth.uid(), which a link click does not have.
-- This validates the token and records the payment in one transaction.
--
-- Output columns are prefixed (charge_label, charge_amount) because a
-- RETURNS TABLE name becomes a PL/pgSQL variable, and a plain "amount" would
-- be ambiguous against payment_allocations.amount.
create or replace function public.mark_charge_paid_via_token(p_token text)
returns table (status text, charge_label text, charge_amount numeric, tenant_name text, unit_name text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_tok record;
  v_charge record;
  v_payment_id uuid;
  v_alloc record;
  v_payment_amount numeric;
begin
  select t.* into v_tok
  from public.payment_action_tokens t
  where t.token = p_token
  for update;

  if not found then
    return query select 'invalid'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  if v_tok.used_at is not null then
    select c.label as lbl, c.amount_due as amt into v_charge
    from public.charges c where c.id = v_tok.charge_id;
    return query select 'already'::text, v_charge.lbl, v_charge.amt, null::text, null::text;
    return;
  end if;

  if v_tok.expires_at < now() then
    return query select 'expired'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  select c.id as cid, c.tenancy_id as tid, c.label as lbl, c.amount_due as amt,
         te.name as tname, un.name as uname
  into v_charge
  from public.charges c
  join public.tenancies tn on tn.id = c.tenancy_id
  join public.tenants   te on te.id = tn.tenant_id
  join public.units     un on un.id = tn.unit_id
  where c.id = v_tok.charge_id and c.owner_id = v_tok.owner_id;

  if not found then
    return query select 'invalid'::text, null::text, null::numeric, null::text, null::text;
    return;
  end if;

  -- Replace any existing allocations for this charge, mirroring the app's logic.
  for v_alloc in
    select pa.id as aid, pa.payment_id as pid, pa.amount as amt
    from public.payment_allocations pa
    where pa.charge_id = v_charge.cid and pa.owner_id = v_tok.owner_id
    for update
  loop
    select p.amount into v_payment_amount
    from public.payments p
    where p.id = v_alloc.pid and p.owner_id = v_tok.owner_id
    for update;

    delete from public.payment_allocations pa where pa.id = v_alloc.aid;

    if v_payment_amount <= v_alloc.amt then
      delete from public.payments p where p.id = v_alloc.pid;
    else
      update public.payments p
      set amount = p.amount - v_alloc.amt
      where p.id = v_alloc.pid;
    end if;
  end loop;

  insert into public.payments (owner_id, tenancy_id, paid_at, amount, note)
  values (v_tok.owner_id, v_charge.tid, current_date, v_charge.amt, 'סומן כשולם מקישור במייל')
  returning id into v_payment_id;

  insert into public.payment_allocations (owner_id, payment_id, charge_id, amount)
  values (v_tok.owner_id, v_payment_id, v_charge.cid, v_charge.amt);

  update public.payment_action_tokens t set used_at = now() where t.token = p_token;

  return query select 'ok'::text, v_charge.lbl, v_charge.amt, v_charge.tname, v_charge.uname;
end;
$$;

-- Only the service role (via the mark-charge-paid Edge Function) may call it.
revoke all on function public.mark_charge_paid_via_token(text) from public, anon, authenticated;
