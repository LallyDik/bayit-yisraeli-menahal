import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, signInAs } from './helpers/auth';

const PASSWORD = 'test-password-1234';
const run = String(Date.now());

let alice: SupabaseClient;
let bob: SupabaseClient;
let chargeId: string;
let tenancyId: string;

beforeAll(async () => {
  alice = await signInAs('billing-alice@example.com', PASSWORD);
  bob = await signInAs('billing-bob@example.com', PASSWORD);

  const { data: unit, error: unitError } = await alice
    .from('units')
    .insert({ name: `billing-unit-${run}` })
    .select()
    .single();
  if (unitError) throw unitError;

  const { data: tenant, error: tenantError } = await alice
    .from('tenants')
    .insert({ name: `billing-tenant-${run}` })
    .select()
    .single();
  if (tenantError) throw tenantError;

  const { data: tenancy, error: tenancyError } = await alice
    .from('tenancies')
    .insert({
      tenant_id: tenant.id,
      unit_id: unit.id,
      monthly_rent: 3000,
    })
    .select()
    .single();
  if (tenancyError) throw tenancyError;
  tenancyId = tenancy.id;

  const { data: charge, error: chargeError } = await alice
    .from('charges')
    .insert({
      tenancy_id: tenancy.id,
      payment_type: 'rent',
      label: `בדיקת שכירות ${run}`,
      period_key: `test:${run}`,
      due_date: new Date().toISOString().slice(0, 10),
      amount_due: 3000,
    })
    .select()
    .single();
  if (chargeError) throw chargeError;
  chargeId = charge.id;
});

describe('billing payment editing', () => {
  it('atomically supports partial, full, and corrected-to-zero payment states', async () => {
    const { error: partialError } = await alice.rpc('set_charge_payment_state', {
      p_charge_id: chargeId,
      p_amount_due: 3000,
      p_paid_amount: 1000,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    expect(partialError).toBeNull();

    const { data: partialAllocations } = await alice
      .from('payment_allocations')
      .select('amount')
      .eq('charge_id', chargeId);
    expect(partialAllocations?.map((row) => Number(row.amount))).toEqual([1000]);

    const { error: fullError } = await alice.rpc('set_charge_payment_state', {
      p_charge_id: chargeId,
      p_amount_due: 3200,
      p_paid_amount: 3200,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    expect(fullError).toBeNull();

    const { data: fullCharge } = await alice
      .from('charges')
      .select('amount_due, payment_allocations(amount)')
      .eq('id', chargeId)
      .single();
    expect(Number(fullCharge?.amount_due)).toBe(3200);
    expect(fullCharge?.payment_allocations.map((row) => Number(row.amount))).toEqual([3200]);

    const { error: resetError } = await alice.rpc('set_charge_payment_state', {
      p_charge_id: chargeId,
      p_amount_due: 3200,
      p_paid_amount: 0,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    expect(resetError).toBeNull();

    const { data: resetAllocations } = await alice
      .from('payment_allocations')
      .select('id')
      .eq('charge_id', chargeId);
    expect(resetAllocations).toEqual([]);
  });

  it("does not let another owner edit Alice's charge", async () => {
    const { error } = await bob.rpc('set_charge_payment_state', {
      p_charge_id: chargeId,
      p_amount_due: 1,
      p_paid_amount: 1,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    expect(error).not.toBeNull();

    const { data: charge } = await alice
      .from('charges')
      .select('amount_due')
      .eq('id', chargeId)
      .single();
    expect(Number(charge?.amount_due)).toBe(3200);
  });
});

describe('billing RPC authorization', () => {
  it('refuses to materialize charges for an anonymous caller', async () => {
    const { error } = await anonClient().rpc('materialize_due_charges');
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });
});

describe('payment terms', () => {
  it('stores a meter rate per tenancy and isolates it by owner', async () => {
    const { data: term, error: insertError } = await alice
      .from('tenancy_payment_terms')
      .insert({
        tenancy_id: tenancyId,
        payment_type: 'electricity',
        label: 'חשמל',
        calculation_type: 'meter',
        frequency_months: 2,
        unit_rate: 0.62,
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    expect(Number(term?.unit_rate)).toBe(0.62);

    const { data: invisible } = await bob
      .from('tenancy_payment_terms')
      .select('*')
      .eq('id', term!.id);
    expect(invisible).toEqual([]);

    const { data: untouched } = await bob
      .from('tenancy_payment_terms')
      .update({ unit_rate: 1 })
      .eq('id', term!.id)
      .select();
    expect(untouched).toEqual([]);
  });

  it('rejects an unsupported payment frequency', async () => {
    const { error } = await alice.from('tenancy_payment_terms').insert({
      tenancy_id: tenancyId,
      payment_type: 'water',
      label: 'מים לא תקינים',
      calculation_type: 'meter',
      frequency_months: 3,
      unit_rate: 1,
    });
    expect(error).not.toBeNull();
  });

  it('supports an additional payment calculated by meter', async () => {
    const { data: term, error: termError } = await alice
      .from('tenancy_payment_terms')
      .insert({
        tenancy_id: tenancyId,
        payment_type: 'custom',
        label: `מונה נוסף ${run}`,
        calculation_type: 'meter',
        frequency_months: 1,
        unit_rate: 5,
      })
      .select()
      .single();
    expect(termError).toBeNull();

    const { data: charge, error: chargeError } = await alice
      .from('charges')
      .insert({
        tenancy_id: tenancyId,
        payment_type: 'custom',
        label: term!.label,
        period_key: `term:${term!.id}:${run}`,
        due_date: new Date().toISOString().slice(0, 10),
        amount_due: 50,
        meter_previous: 10,
        meter_current: 20,
        meter_rate: 5,
      })
      .select('amount_due, meter_previous, meter_current, meter_rate')
      .single();
    expect(chargeError).toBeNull();
    expect(Number(charge?.amount_due)).toBe(50);
    expect(Number(charge?.meter_current) - Number(charge?.meter_previous)).toBe(10);
    expect(Number(charge?.meter_rate)).toBe(5);
  });

  it('deletes an accidentally added payment and its ledger rows, but only for its owner', async () => {
    const { data: term, error: termError } = await alice
      .from('tenancy_payment_terms')
      .insert({
        tenancy_id: tenancyId,
        payment_type: 'custom',
        label: `למחיקה ${run}`,
        calculation_type: 'fixed',
        fixed_amount: 75,
      })
      .select()
      .single();
    expect(termError).toBeNull();

    const { data: charge, error: chargeError } = await alice
      .from('charges')
      .insert({
        tenancy_id: tenancyId,
        payment_type: 'custom',
        label: term!.label,
        period_key: `term:${term!.id}:delete-test`,
        due_date: new Date().toISOString().slice(0, 10),
        amount_due: 75,
      })
      .select()
      .single();
    expect(chargeError).toBeNull();

    const { error: paidError } = await alice.rpc('set_charge_payment_state', {
      p_charge_id: charge!.id,
      p_amount_due: 75,
      p_paid_amount: 75,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });
    expect(paidError).toBeNull();

    const { error: bobError } = await bob.rpc('delete_added_payment_term', { p_term_id: term!.id });
    expect(bobError).not.toBeNull();

    const { error: deleteError } = await alice.rpc('delete_added_payment_term', { p_term_id: term!.id });
    expect(deleteError).toBeNull();

    const { data: deletedTerm } = await alice.from('tenancy_payment_terms').select('id').eq('id', term!.id);
    const { data: deletedCharge } = await alice.from('charges').select('id').eq('id', charge!.id);
    const { data: deletedAllocation } = await alice.from('payment_allocations').select('id').eq('charge_id', charge!.id);
    expect(deletedTerm).toEqual([]);
    expect(deletedCharge).toEqual([]);
    expect(deletedAllocation).toEqual([]);
  });
});
