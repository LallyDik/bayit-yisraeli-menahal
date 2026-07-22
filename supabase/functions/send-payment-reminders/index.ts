import { createClient } from 'jsr:@supabase/supabase-js@2';
// nodemailer, not denomailer: denomailer emits RFC-invalid MIME for Hebrew —
// literal spaces inside RFC 2047 encoded-words (which terminate the encoded
// word, so Gmail shows the raw subject) and lowercase quoted-printable hex.
import nodemailer from 'npm:nodemailer@6.9.14';
import { shabbatQuietWindow } from './shabbat.ts';

type Row = {
  owner_id: string;
  charge_id: string;
  label: string;
  due_date: string;
  amount_due: number;
  paid_amount: number;
  remaining: number;
  unit_name: string;
  tenant_name: string;
  /** Single-use token backing this row's "mark paid" link. */
  token?: string;
};

const APP_URL = 'https://nihulschirut.com/';
const MARK_PAID_URL = 'https://lwmddgwwfirkcaqaxdbh.supabase.co/functions/v1/mark-charge-paid';
const TOKEN_TTL_DAYS = 14;
const shekel = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
const heDate = (iso: string) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00`));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

function buildEmail(rows: Row[]) {
  const total = rows.reduce((sum, r) => sum + Number(r.remaining), 0);

  // Group by tenant + unit so the landlord reads it the way they think about it.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.tenant_name} · ${row.unit_name}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const blocks = Array.from(groups, ([who, items]) => {
    const lines = items.map((r) => `
      <tr>
        <td style="padding:8px 0;color:#5B6E80;">${r.label} · ${heDate(r.due_date)}</td>
        <td style="padding:8px 8px;text-align:left;font-weight:600;white-space:nowrap;">${shekel(r.remaining)}</td>
        <td style="padding:8px 0;text-align:left;white-space:nowrap;">${r.token
          ? `<a href="${MARK_PAID_URL}?token=${r.token}" style="display:inline-block;background:#1E9E9B;color:#fff;text-decoration:none;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;">סמן כשולם</a>`
          : ''}</td>
      </tr>`).join('');
    return `
      <div style="margin:0 0 18px;padding:14px 16px;background:#FFFCF5;border:1px solid #EAE1D0;border-radius:14px;">
        <p style="margin:0 0 6px;font-weight:700;">${who}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${lines}</table>
      </div>`;
  }).join('');

  const subject = `תזכורת: ${rows.length} חיובים ממתינים לעדכון (${shekel(total)})`;

  const html = `
  <div dir="rtl" style="font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#203D5A;max-width:600px;margin:0 auto;padding:24px;">
    <p style="margin:0 0 4px;font-weight:700;color:#0E5F5D;">ניהול שכירות</p>
    <h1 style="margin:0 0 6px;font-size:24px;">יש חיובים שעדיין לא עודכנו</h1>
    <p style="margin:0 0 20px;color:#5B6E80;font-size:15px;">
      אלה חיובים שהגיע מועדם ועדיין לא סומנו כשולמו. אם כבר קיבלת את הכסף — שווה לעדכן כדי שהמעקב יישאר מדויק.
    </p>
    ${blocks}
    <p style="margin:18px 0 22px;font-size:16px;">סה״כ ממתין: <strong>${shekel(total)}</strong></p>
    <a href="${APP_URL}" style="display:inline-block;background:#1E9E9B;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;">
      פתחו את המערכת לעדכון
    </a>
    <p style="margin:26px 0 0;color:#8A9AA8;font-size:12px;">
      נשלח אוטומטית ממערכת ניהול השכירות. תזכורות אינן נשלחות בשבת ובחגים.
    </p>
  </div>`;

  return { subject, html, total };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === '1';
  const onlyOwner = url.searchParams.get('owner');
  const force = url.searchParams.get('force') === '1';

  // 1) Never send on Shabbat or Yom Tov.
  const quiet = shabbatQuietWindow(new Date());
  if (quiet.quiet && !force) {
    return json({ skipped: true, reason: quiet.reason, until: quiet.until, sent: 0 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 2) Which charges are due but unpaid?
  // The anon key is public, so JWT verification alone would let anyone trigger a
  // reminder blast. Require a shared secret that only the scheduler knows.
  const { data: secretRow } = await supabase
    .from('private_settings').select('value').eq('key', 'reminder_secret').maybeSingle();
  const expectedSecret = secretRow?.value;
  if (expectedSecret && req.headers.get('x-reminder-secret') !== expectedSecret) {
    return json({ error: 'forbidden' }, 403);
  }

  let query = supabase.from('v_outstanding_charges').select('*').order('due_date');
  if (onlyOwner) query = query.eq('owner_id', onlyOwner);
  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as Row[];
  const byOwner = new Map<string, Row[]>();
  for (const row of rows) byOwner.set(row.owner_id, [...(byOwner.get(row.owner_id) ?? []), row]);

  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!gmailUser || !gmailPass) {
    return json({ error: 'GMAIL_USER / GMAIL_APP_PASSWORD secrets are not set' }, 500);
  }

  const results: unknown[] = [];
  const transporter = dryRun ? null : nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  });

  try {
    for (const [ownerId, ownerRows] of byOwner) {
      const { data: found } = await supabase.auth.admin.getUserById(ownerId);
      const to = found?.user?.email;
      // Seeded test accounts would only generate bounces.
      if (!to || to.endsWith('@example.com')) {
        results.push({ ownerId, to: to ?? null, sent: false, reason: 'no deliverable address' });
        continue;
      }

      // A fresh single-use token per charge, so each "mark paid" link works once
      // and stops working after two weeks even if the mail is forwarded.
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
      const rowsWithTokens: Row[] = [];
      for (const row of ownerRows) {
        const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
        const { error: tokenError } = await supabase.from('payment_action_tokens')
          .insert({ token, charge_id: row.charge_id, owner_id: ownerId, expires_at: expiresAt });
        rowsWithTokens.push(tokenError ? row : { ...row, token });
      }

      const { subject, html, total } = buildEmail(rowsWithTokens);
      if (dryRun) {
        results.push({ ownerId, to, sent: false, dryRun: true, charges: ownerRows.length, total, subject });
        continue;
      }

      await transporter!.sendMail({
        from: `"ניהול שכירות" <${gmailUser}>`,
        to,
        subject,
        html,
      });
      results.push({ ownerId, to, sent: true, charges: ownerRows.length, total });
    }
  } catch (e) {
    return json({ error: String(e), partial: results }, 500);
  } finally {
    transporter?.close?.();
  }

  return json({
    skipped: false,
    quietWindow: quiet.quiet ? { forcedThrough: true, reason: quiet.reason } : null,
    owners: byOwner.size,
    results,
  });
});
