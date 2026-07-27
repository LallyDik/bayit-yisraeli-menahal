import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signInAs, anonClient } from './helpers/auth';

const PASSWORD = 'test-password-1234';

let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceId: string;

beforeAll(async () => {
  alice = await signInAs('notif-alice@example.com', PASSWORD);
  bob = await signInAs('notif-bob@example.com', PASSWORD);
  const { data } = await alice.auth.getUser();
  aliceId = data.user!.id;
  // Create alice's row (owner_id must equal her uid per RLS).
  await alice.from('notification_settings').upsert({ owner_id: aliceId, email_reminders: true });
});

describe('RLS: notification_settings is per-owner', () => {
  it('owner reads their own row with a default token', async () => {
    const { data } = await alice.from('notification_settings').select('*').eq('owner_id', aliceId).maybeSingle();
    expect(data).not.toBeNull();
    expect(data!.email_reminders).toBe(true);
    expect(typeof data!.unsubscribe_token).toBe('string');
    expect(data!.unsubscribe_token.length).toBeGreaterThan(30);
  });

  it("another user cannot see alice's row", async () => {
    const { data } = await bob.from('notification_settings').select('*').eq('owner_id', aliceId);
    expect(data).toEqual([]);
  });

  it("another user cannot update alice's row — zero rows affected", async () => {
    const { data } = await bob.from('notification_settings')
      .update({ email_reminders: false }).eq('owner_id', aliceId).select();
    expect(data).toEqual([]);
    const { data: still } = await alice.from('notification_settings').select('email_reminders').eq('owner_id', aliceId).maybeSingle();
    expect(still!.email_reminders).toBe(true);
  });

  it('anon cannot insert a row', async () => {
    const { error } = await anonClient().from('notification_settings').insert({ owner_id: aliceId });
    expect(error).not.toBeNull();
  });

  it('a user cannot insert a row owned by someone else', async () => {
    const { error } = await bob.from('notification_settings').insert({ owner_id: aliceId });
    expect(error).not.toBeNull();
  });
});
