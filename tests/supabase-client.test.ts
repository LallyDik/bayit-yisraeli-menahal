import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('supabase client', () => {
  it('is configured from environment variables', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toContain('lwmddgwwfirkcaqaxdbh');
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeTruthy();
  });

  it('can reach the project', async () => {
    // Deliberately bad credentials. A reachable project answers with an auth
    // error; an unreachable one fails at the network layer. Distinguishing the
    // two is the whole point of this test.
    //
    // Do NOT rewrite this to query a table. Task 2 replaces the `Database`
    // placeholder with generated types, and a made-up table name would then
    // stop type-checking.
    const { error } = await supabase.auth.signInWithPassword({
      email: 'definitely-not-a-user@example.com',
      password: 'definitely-not-the-password',
    });
    expect(error).not.toBeNull();
    expect(error!.message).not.toMatch(/fetch failed|ENOTFOUND|ECONNREFUSED/i);
  });
});
