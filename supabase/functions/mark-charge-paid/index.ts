import { createClient } from 'jsr:@supabase/supabase-js@2';

// Reached by clicking a link in a reminder email, so there is no logged-in user
// and no JWT: the single-use, expiring token in the URL is the credential, and
// mark_charge_paid_via_token validates it inside the same transaction that
// records the payment.

const APP_URL = 'https://nihul-schhirut.lovable.app/';

// The response already declares UTF-8 in both the header and a leading <meta>,
// but a filtering proxy that re-serves the page can drop the charset, and a
// Hebrew browser then falls back to windows-1255 and renders every Hebrew byte
// as mojibake. Emitting non-ASCII as numeric character references sidesteps the
// question entirely: the bytes are pure ASCII, which every candidate encoding
// agrees on. Markup-significant characters are escaped first, since labels and
// tenant names come from user-entered data.
const text = (s: unknown) =>
  String(s ?? '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
    // The u flag makes a negated class match an astral character as one unit,
    // so codePointAt sees the whole character rather than a lone surrogate.
    .replace(/[^\x20-\x7E]/gu, (c) => `&#${c.codePointAt(0)};`);

const shekel = (n: number) => text(`₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`);

type Tone = 'ok' | 'warn' | 'err';

/** `heading` is plain text; `detail` is HTML whose dynamic parts are already escaped. */
function page(tone: Tone, heading: string, detail: string, status = 200) {
  const accent = tone === 'ok' ? '#1E9E9B' : tone === 'warn' ? '#C08A2E' : '#B1402F';
  const glyph = text(tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '×');
  const title = text(heading);
  return new Response(
    `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#FFFCF5;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#203D5A;">
  <div style="max-width:520px;margin:0 auto;padding:56px 24px;text-align:center;">
    <div style="width:72px;height:72px;border-radius:24px;background:${accent};color:#fff;font-size:38px;line-height:72px;margin:0 auto 20px;">${glyph}</div>
    <h1 style="margin:0 0 10px;font-size:26px;">${title}</h1>
    <p style="margin:0 0 28px;color:#5B6E80;font-size:16px;line-height:1.6;">${detail}</p>
    <a href="${APP_URL}" style="display:inline-block;background:#1E9E9B;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:700;">${text('פתחו את המערכת')}</a>
  </div>
</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return page('err', 'קישור לא תקין', text('חסר מזהה בקישור. אפשר לעדכן את התשלום ישירות במערכת.'), 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('mark_charge_paid_via_token', { p_token: token });
  if (error) {
    console.error('mark_charge_paid_via_token failed', error);
    return page('err', 'משהו השתבש', text('לא הצלחנו לעדכן את החיוב. אפשר לנסות שוב מתוך המערכת.'), 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  switch (row?.status) {
    case 'ok':
      return page(
        'ok',
        'סומן כשולם ✓',
        `${text(row.charge_label)} ${text('·')} ${text(row.tenant_name)} ${text('·')} ${text(row.unit_name)}`
          + `<br><strong>${shekel(row.charge_amount)}</strong> ${text('נרשמו כשולמו.')}`,
      );
    case 'already':
      return page(
        'warn',
        'כבר סומן כשולם',
        `${text(row.charge_label ?? 'החיוב')} ${text('כבר עודכן קודם. לא בוצע שינוי נוסף.')}`,
      );
    case 'expired':
      return page(
        'warn',
        'הקישור פג תוקף',
        text('קישורי התזכורת תקפים לשבועיים. אפשר לעדכן את התשלום במערכת.'),
      );
    default:
      return page(
        'err',
        'קישור לא תקף',
        text('ייתכן שהקישור שגוי או שהחיוב נמחק. אפשר לעדכן במערכת.'),
        404,
      );
  }
});
