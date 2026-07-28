import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

if (!url || !anonKey || !email || !password) {
  throw new Error(
    'Missing E2E env. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ' +
      'E2E_USER_EMAIL and E2E_USER_PASSWORD in .env.e2e (see .env.e2e.example).',
  );
}

export const TEST_USER = { email, password };

let cachedClient: SupabaseClient | null = null;
let cachedUserId: string | null = null;

/**
 * Signs the fixed test user in — creating it on first run, exactly like
 * tests/helpers/auth.ts — marks onboarding complete, and caches the authed
 * client + user id. Safe to call repeatedly.
 */
export async function signInTestUser(): Promise<{ client: SupabaseClient; userId: string }> {
  if (cachedClient && cachedUserId) return { client: cachedClient, userId: cachedUserId };

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const { error: signUpError } = await client.auth.signUp({ email, password });
    if (signUpError) throw new Error(`signUp failed: ${signUpError.message}`);
    ({ error } = await client.auth.signInWithPassword({ email, password }));
    if (error) throw new Error(`signIn after signUp failed: ${error.message}`);
  }

  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error('No user session after sign-in');

  // Keep onboarding complete so the first-login guide never opens mid-test.
  const { error: onboardingError } = await client.auth.updateUser({ data: { onboarding_version: 1 } });
  if (onboardingError) throw new Error(`updateUser (onboarding) failed: ${onboardingError.message}`);

  cachedClient = client;
  cachedUserId = data.user.id;
  return { client, userId: data.user.id };
}

// Children before parents. RLS + the explicit owner_id filter confine deletes
// to the test user's rows. A table the user has no DELETE policy for is cleared
// by the tenancy cascade (FK `on delete cascade`) when the tenancy row goes; the
// explicit delete on it is then a harmless 0-row no-op (RLS filters, no error).
// notification_settings has no owner DELETE policy and does not affect the
// tested flows, so it is intentionally left alone.
const CLEANUP_TABLES = [
  'payment_allocations',
  'payments',
  'charges',
  'tenancy_payment_terms',
  'billing_schedule_occurrences',
  'tenancy_billing_settings',
  'meter_readings',
  'attachments',
  'tenancies',
  'units',
  'tenants',
] as const;

/** Deletes the test user's own rows so each test starts from a clean baseline. */
export async function resetTestUserData(): Promise<void> {
  const { client, userId } = await signInTestUser();
  for (const table of CLEANUP_TABLES) {
    const { error } = await client.from(table).delete().eq('owner_id', userId);
    if (error) throw new Error(`reset ${table} failed: ${error.message}`);
  }
}

export async function seedUnit(name: string): Promise<string> {
  const { client } = await signInTestUser();
  const { data, error } = await client.from('units').insert({ name }).select('id').single();
  if (error || !data) throw new Error(`seedUnit failed: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function seedTenant(name: string): Promise<string> {
  const { client } = await signInTestUser();
  const { data, error } = await client.from('tenants').insert({ name }).select('id').single();
  if (error || !data) throw new Error(`seedTenant failed: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function seedActiveTenancy(opts: {
  unitName: string;
  tenantName: string;
  rent: number;
  method: 'cash' | 'check' | 'transfer' | null;
}): Promise<{ unitId: string; tenantId: string; tenancyId: string }> {
  const { client } = await signInTestUser();
  const unitId = await seedUnit(opts.unitName);
  const tenantId = await seedTenant(opts.tenantName);
  const { data, error } = await client
    .from('tenancies')
    .insert({
      unit_id: unitId,
      tenant_id: tenantId,
      monthly_rent: opts.rent,
      start_date: '2026-01-01',
      payment_method: opts.method,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedActiveTenancy failed: ${error?.message ?? 'no row'}`);
  return { unitId, tenantId, tenancyId: data.id as string };
}
