import { createClient } from 'jsr:@supabase/supabase-js@2';

// Reached by clicking a link in a reminder email, so there is no logged-in user
// and no JWT: the single-use, expiring token in the URL is the credential, and
// mark_charge_paid_via_token validates it inside the same transaction that
// records the payment.

const APP_URL = 'https://nihul-schhirut.lovable.app/';
const shekel = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

type Tone = 'ok' | 'warn' | 'err';

function page(tone: Tone, heading: string, detail: string, status = 200) {
  const accent = tone === 'ok' ? '#1E9E9B' : tone === 'warn' ? '#C08A2E' : '#B1402F';
  const glyph = tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '×';
  return new Response(
    `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading}</title></head>
<body style="margin:0;background:#FFFCF5;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#203D5A;">
  <div style="max-width:520px;margin:0 auto;padding:56px 24px;text-align:center;">
    <div style="width:72px;height:72px;border-radius:24px;background:${accent};color:#fff;font-size:38px;line-height:72px;margin:0 auto 20px;">${glyph}</div>
    <h1 style="margin:0 0 10px;font-size:26px;">${heading}</h1>
    <p style="margin:0 0 28px;color:#5B6E80;font-size:16px;line-height:1.6;">${detail}</p>
    <a href="${APP_URL}" style="display:inline-block;background:#1E9E9B;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:700;">פתחו את המערכת</a>
  </div>
</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return page('err', 'קישור לא תקין', 'חסר מזהה בקישור. אפשר לעדכן את התשלום ישירות במערכת.', 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('mark_charge_paid_via_token', { p_token: token });
  if (error) {
    return page('err', 'משהו השתבש', 'לא הצלחנו לעדכן את החיוב. אפשר לנסות שוב מתוך המערכת.', 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  switch (row?.status) {
    case 'ok':
      return page(
        'ok',
        'סומן כשולם ✓',
        `${row.charge_label} · ${row.tenant_name} · ${row.unit_name}<br><strong>${shekel(row.charge_amount)}</strong> נרשמו כשולמו.`,
      );
    case 'already':
      return page('warn', 'כבר סומן כשולם', `${row.charge_label ?? 'החיוב'} כבר עודכן קודם. לא בוצע שינוי נוסף.`);
    case 'expired':
      return page('warn', 'הקישור פג תוקף', 'קישורי התזכורת תקפים לשבועיים. אפשר לעדכן את התשלום במערכת.');
    default:
      return page('err', 'קישור לא תקף', 'ייתכן שהקישור שגוי או שהחיוב נמחק. אפשר לעדכן במערכת.', 404);
  }
});
