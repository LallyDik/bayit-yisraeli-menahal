import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signs in as `email`, creating the user on first run. Returns an isolated client. */
export async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();

  let { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const { error: signUpError } = await client.auth.signUp({ email, password });
    if (signUpError) throw new Error(`signUp(${email}) failed: ${signUpError.message}`);
    ({ error } = await client.auth.signInWithPassword({ email, password }));
    if (error) throw new Error(`signIn(${email}) failed after signUp: ${error.message}`);
  }

  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error(`No user session for ${email}`);
  return client;
}
