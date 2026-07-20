import { createClient } from 'jsr:@supabase/supabase-js@2';

// Reached by clicking a link in a reminder email, so there is no logged-in user
// and no JWT: the single-use, expiring token in the URL is the credential, and
// mark_charge_paid_via_token validates it inside the same transaction that
// records the payment.
//
// This function does the work and then redirects to the app, which renders the
// confirmation. It deliberately does not render one itself: Supabase serves
// every Edge Function response on the default *.supabase.co domain as
// "Content-Type: text/plain" with X-Content-Type-Options: nosniff (so the
// domain can't host pages), which turns an HTML confirmation into raw source in
// the browser. Redirecting also lands the recipient in the app with the updated
// figures already on screen.

const APP_URL = 'https://nihul-schhirut.lovable.app/';

function redirect(status: string, extra: Record<string, unknown> = {}) {
  const url = new URL(APP_URL);
  url.searchParams.set('paid', status);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return new Response(null, {
    status: 303,
    headers: { Location: url.toString(), 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return redirect('invalid');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('mark_charge_paid_via_token', { p_token: token });
  if (error) {
    console.error('mark_charge_paid_via_token failed', error);
    return redirect('invalid');
  }

  const row = Array.isArray(data) ? data[0] : data;
  switch (row?.status) {
    case 'ok':
      return redirect('ok', {
        label: row.charge_label,
        tenant: row.tenant_name,
        unit: row.unit_name,
        amount: row.charge_amount,
      });
    case 'already':
      return redirect('already', { label: row.charge_label });
    case 'expired':
      return redirect('expired');
    default:
      return redirect('invalid');
  }
});
