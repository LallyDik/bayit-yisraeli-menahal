import { createClient } from 'jsr:@supabase/supabase-js@2';

// No logged-in user: the stable unsubscribe_token in the link is the credential.
// Flipping email_reminders off is idempotent, so an old link still works.
const APP_URL = 'https://nihulschirut.com/';

function redirect(status: string) {
  const url = new URL(APP_URL);
  url.searchParams.set('unsubscribed', status);
  return new Response(null, { status: 303, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
}

async function optOut(token: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ email_reminders: false, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('owner_id');
  if (error) { console.error('unsubscribe failed', error); return false; }
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');

  // Gmail one-click (RFC 8058) POSTs to the List-Unsubscribe URL.
  if (req.method === 'POST') {
    if (token) await optOut(token);
    return new Response(null, { status: 200 });
  }

  // Visible link click.
  if (!token) return redirect('invalid');
  const ok = await optOut(token);
  return redirect(ok ? '1' : 'invalid');
});
