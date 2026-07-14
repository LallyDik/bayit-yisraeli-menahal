import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signInAs, anonClient } from './helpers/auth';

const PASSWORD = 'test-password-1234';
const run = String(Date.now()); // scope this run's rows so reruns don't collide

let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceUnitId: string;
let aliceTenantId: string;
let bobTenantId: string;

beforeAll(async () => {
  alice = await signInAs('rls-alice@example.com', PASSWORD);
  bob = await signInAs('rls-bob@example.com', PASSWORD);

  // owner_id is never sent by the client — the database fills it from the JWT.
  const { data: unit, error: unitErr } = await alice
    .from('units')
    .insert({ name: `alice-unit-${run}` })
    .select()
    .single();
  if (unitErr) throw unitErr;
  aliceUnitId = unit.id;

  const { data: aTenant, error: aErr } = await alice
    .from('tenants')
    .insert({ name: `alice-tenant-${run}` })
    .select()
    .single();
  if (aErr) throw aErr;
  aliceTenantId = aTenant.id;

  const { data: bTenant, error: bErr } = await bob
    .from('tenants')
    .insert({ name: `bob-tenant-${run}` })
    .select()
    .single();
  if (bErr) throw bErr;
  bobTenantId = bTenant.id;
});

describe('RLS: owner isolation', () => {
  it('owner_id is populated from the JWT, not the client', async () => {
    const { data: user } = await alice.auth.getUser();
    const { data: unit } = await alice
      .from('units').select('owner_id').eq('id', aliceUnitId).single();
    expect(unit!.owner_id).toBe(user.user!.id);
  });

  it("bob cannot see alice's unit", async () => {
    const { data } = await bob.from('units').select('*').eq('id', aliceUnitId);
    expect(data).toEqual([]);
  });

  it("bob cannot update alice's unit — zero rows affected", async () => {
    const { data } = await bob
      .from('units').update({ name: 'HACKED' }).eq('id', aliceUnitId).select();
    expect(data).toEqual([]);

    // And prove it really is untouched, not just invisible to bob.
    const { data: after } = await alice
      .from('units').select('name').eq('id', aliceUnitId).single();
    expect(after!.name).toBe(`alice-unit-${run}`);
  });

  it("bob cannot delete alice's unit — zero rows affected", async () => {
    const { data } = await bob
      .from('units').delete().eq('id', aliceUnitId).select();
    expect(data).toEqual([]);

    const { data: after } = await alice
      .from('units').select('id').eq('id', aliceUnitId);
    expect(after).toHaveLength(1);
  });

  it("bob cannot attach his tenant to alice's unit", async () => {
    // This is what the composite FK (unit_id, owner_id) exists to stop.
    // RLS alone would allow it, because FK checks bypass RLS.
    const { error } = await bob.from('tenancies').insert({
      tenant_id: bobTenantId,
      unit_id: aliceUnitId,
      monthly_rent: 1,
    });
    expect(error).not.toBeNull();
  });

  it('an anonymous visitor sees nothing', async () => {
    const anon = anonClient();
    const { data: units } = await anon.from('units').select('*');
    const { data: tenants } = await anon.from('tenants').select('*');
    expect(units ?? []).toEqual([]);
    expect(tenants ?? []).toEqual([]);
  });
});

describe('schema invariants', () => {
  it('rejects a unit with a blank name', async () => {
    const { error } = await alice.from('units').insert({ name: '   ' });
    expect(error).not.toBeNull();
  });

  it('allows a second active tenancy only after the first one ends', async () => {
    const { data: t1, error: e1 } = await alice.from('tenancies').insert({
      tenant_id: aliceTenantId,
      unit_id: aliceUnitId,
      monthly_rent: 3000,
    }).select().single();
    expect(e1).toBeNull();

    const { data: other } = await alice
      .from('tenants').insert({ name: `alice-tenant2-${run}` }).select().single();

    // Same unit, still occupied -> blocked by one_active_tenancy_per_unit
    const { error: e2 } = await alice.from('tenancies').insert({
      tenant_id: other!.id,
      unit_id: aliceUnitId,
      monthly_rent: 3200,
    });
    expect(e2).not.toBeNull();

    // End the first tenancy, then the unit is free.
    // end_date must be >= start_date (which defaults to today), so compute a
    // date guaranteed to satisfy that regardless of when the suite runs.
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await alice.from('tenancies')
      .update({ end_date: endDate }).eq('id', t1!.id);

    const { error: e3 } = await alice.from('tenancies').insert({
      tenant_id: other!.id,
      unit_id: aliceUnitId,
      monthly_rent: 3200,
    });
    expect(e3).toBeNull();
  });

  it('refuses to delete a unit that has rental history', async () => {
    const { error } = await alice.from('units').delete().eq('id', aliceUnitId).select();
    expect(error).not.toBeNull(); // on delete restrict
  });

  it('rejects a unit condition outside the fixed list', async () => {
    const { error } = await alice.from('units').insert({
      name: `alice-badcond-${run}`,
      condition: 'גרוע',
    });
    expect(error).not.toBeNull();

    const { error: okErr } = await alice.from('units').insert({
      name: `alice-goodcond-${run}`,
      condition: 'משופץ',
    });
    expect(okErr).toBeNull();
  });
});
