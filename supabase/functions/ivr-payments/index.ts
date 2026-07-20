import { createClient } from 'jsr:@supabase/supabase-js@2';
import { play, playAndHangup, read, say, num, sanitize } from './yemot.ts';
import { shabbatQuietWindow } from './shabbat.ts';

// The phone menu. The landlord calls the Yemot number, hears each charge that
// is due but unpaid, and presses:
//   1 — mark it paid
//   2 — send the tenant a voice reminder
//   3 — skip to the next one
//   9 — finish
//
// Yemot drives this: it calls us once per step, so each request must rebuild
// its own context. The charge list is frozen in ivr_call_state at call start,
// because marking one paid drops it out of v_outstanding_charges and would
// otherwise renumber everything still ahead of the caller.

const SEND_TTS_URL = 'https://www.call2all.co.il/ym/api/SendTTS';
const DIGITS = ['1', '2', '3', '9'];

const reply = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

/** Yemot may send the call context as a GET query or a POST body. */
async function readParams(req: Request): Promise<URLSearchParams> {
  const url = new URL(req.url);
  if (req.method !== 'POST') return url.searchParams;
  const body = await req.text();
  const contentType = req.headers.get('content-type') ?? '';
  const fromBody = contentType.includes('json')
    ? new URLSearchParams(Object.entries(JSON.parse(body || '{}')).map(([k, v]) => [k, String(v)]))
    : new URLSearchParams(body);
  for (const [key, value] of fromBody) url.searchParams.set(key, value);
  return url.searchParams;
}

/** Israeli numbers reach us in several shapes; compare on digits alone. */
const phoneKey = (phone: string) => String(phone ?? '').replace(/\D/g, '').replace(/^972/, '0');

async function sendTenantReminder(phone: string, message: string): Promise<'sent' | 'no-token' | 'failed'> {
  const token = Deno.env.get('YEMOT_TOKEN');
  if (!token) return 'no-token';
  try {
    const url = new URL(SEND_TTS_URL);
    url.searchParams.set('token', token);
    url.searchParams.set('phones', phone);
    url.searchParams.set('ttsMessage', message);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    // Their API answers 200 with a JSON body carrying the real outcome.
    if (!res.ok || /"responseStatus"\s*:\s*"(?!OK)/i.test(text)) {
      console.error('SendTTS rejected', res.status, text.slice(0, 300));
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.error('SendTTS failed', e);
    return 'failed';
  }
}

Deno.serve(async (req) => {
  const params = await readParams(req);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // The function URL is configured once in the Yemot panel, so a secret in the
  // query string is enough to keep everyone else out.
  const { data: secretRow } = await supabase
    .from('private_settings').select('value').eq('key', 'ivr_secret').maybeSingle();
  if (secretRow?.value && params.get('k') !== secretRow.value) {
    return reply(playAndHangup(say('שיחה לא מורשית')));
  }

  const callId = params.get('ApiCallId');
  if (!callId) return reply(playAndHangup(say('שגיאה בזיהוי השיחה')));

  // Yemot pings once more when the caller hangs up; nothing to say, just tidy.
  if (params.get('hangup') === 'yes' || params.get('ApiHangup') === 'yes') {
    await supabase.from('ivr_call_state').delete().eq('call_id', callId);
    return reply('hangup=yes');
  }

  const { data: existing } = await supabase
    .from('ivr_call_state').select('*').eq('call_id', callId).maybeSingle();

  // ---- First step of a new call: authorise, load the queue, greet. ----
  if (!existing) {
    const caller = phoneKey(params.get('ApiPhone') ?? '');
    const { data: allowed } = await supabase
      .from('ivr_authorized_callers').select('owner_id, phone');
    const match = (allowed ?? []).find((row) => phoneKey(row.phone) === caller);
    if (!match) {
      return reply(playAndHangup(
        say('המספר שממנו התקשרתם אינו מורשה לניהול התשלומים'),
        say('שלום'),
      ));
    }

    const { data: charges } = await supabase
      .from('v_outstanding_charges')
      .select('charge_id, remaining')
      .eq('owner_id', match.owner_id)
      .order('due_date');

    if (!charges?.length) {
      return reply(playAndHangup(
        say('אין חיובים שממתינים לעדכון'),
        say('הכל מעודכן'),
        say('שלום'),
      ));
    }

    const total = charges.reduce((sum, c) => sum + Number(c.remaining), 0);
    await supabase.from('ivr_call_state').insert({
      call_id: callId,
      owner_id: match.owner_id,
      charge_ids: charges.map((c) => c.charge_id),
      position: 0,
    });
    // Opportunistic cleanup of calls that never sent a hangup ping.
    await supabase.from('ivr_call_state')
      .delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());

    // Hebrew needs the singular form; "יש 1 חיובים" sounds broken read aloud.
    const intro = charges.length === 1
      ? [say('שלום'), say('יש חיוב אחד שממתין לעדכון')]
      : [
          say('שלום'),
          say('יש'),
          num(charges.length),
          say('חיובים שממתינים לעדכון'),
          say('בסך הכל'),
          num(total),
          say('שקלים'),
        ];
    return reply(await presentCharge(supabase, {
      call_id: callId, owner_id: match.owner_id,
      charge_ids: charges.map((c) => c.charge_id), position: 0, marked: 0, reminded: 0,
    }, intro));
  }

  // ---- Subsequent steps: act on the keypress, then move on. ----
  const state = existing as State;
  const pressed = params.get(`k${state.position}`);
  if (!pressed) {
    // No value yet (first delivery of this step, or a timeout) — ask again.
    return reply(await presentCharge(supabase, state, []));
  }

  const chargeId = state.charge_ids[state.position];
  const prefix: string[] = [];
  let { marked, reminded } = state;

  if (pressed === '9') {
    return reply(farewell(state));
  }

  if (pressed === '1') {
    const { data: result } = await supabase.rpc('mark_charge_paid_for_owner', {
      p_owner: state.owner_id, p_charge: chargeId,
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (row?.status === 'ok') {
      marked += 1;
      prefix.push(say('סומן כשולם'));
    } else {
      prefix.push(say('לא הצלחנו לעדכן את החיוב הזה'));
    }
  }

  if (pressed === '2') {
    const { data: details } = await supabase.rpc('ivr_charge_details', {
      p_owner: state.owner_id, p_charge: chargeId,
    });
    const charge = Array.isArray(details) ? details[0] : details;
    const quiet = shabbatQuietWindow(new Date());
    if (quiet.quiet) {
      prefix.push(say('לא נשלחת תזכורת בשבת ובחג'));
    } else if (!charge?.tenant_phone) {
      prefix.push(say('לא רשום מספר טלפון לשוכר הזה'));
    } else {
      const message = sanitize(
        `שלום ${charge.tenant_name}, תזכורת מבעל הדירה על תשלום ${charge.charge_label} `
        + `בסך ${Math.round(Number(charge.remaining))} שקלים שטרם שולם. תודה`,
      );
      const outcome = await sendTenantReminder(charge.tenant_phone, message);
      if (outcome === 'sent') {
        reminded += 1;
        prefix.push(say('התזכורת נשלחה לשוכר'));
      } else if (outcome === 'no-token') {
        prefix.push(say('שליחת תזכורות עדיין לא מחוברת'));
      } else {
        prefix.push(say('לא הצלחנו לשלוח את התזכורת'));
      }
    }
  }

  const next = { ...state, position: state.position + 1, marked, reminded };
  await supabase.from('ivr_call_state')
    .update({ position: next.position, marked, reminded, updated_at: new Date().toISOString() })
    .eq('call_id', callId);

  if (next.position >= state.charge_ids.length) {
    return reply(farewell(next, prefix));
  }
  return reply(await presentCharge(supabase, next, prefix));
});

type State = {
  call_id: string;
  owner_id: string;
  charge_ids: string[];
  position: number;
  marked: number;
  reminded: number;
};

async function presentCharge(
  supabase: ReturnType<typeof createClient>,
  state: State,
  prefix: string[],
): Promise<string> {
  const chargeId = state.charge_ids[state.position];
  const { data } = await supabase.rpc('ivr_charge_details', {
    p_owner: state.owner_id, p_charge: chargeId,
  });
  const charge = Array.isArray(data) ? data[0] : data;
  if (!charge) {
    // Deleted mid-call; skip rather than dead-end the caller.
    return play(say('החיוב הזה אינו זמין'));
  }

  return read(`k${state.position}`, DIGITS,
    ...prefix,
    say('חיוב'),
    num(state.position + 1),
    say('מתוך'),
    num(state.charge_ids.length),
    say(charge.tenant_name),
    say(charge.unit_name),
    say(charge.charge_label),
    num(charge.remaining),
    say('שקלים'),
    say('לסימון כשולם הקישו'),
    num(1),
    say('לשליחת תזכורת קולית לשוכר הקישו'),
    num(2),
    say('למעבר לחיוב הבא הקישו'),
    num(3),
    say('לסיום הקישו'),
    num(9),
  );
}

function farewell(state: State, prefix: string[] = []): string {
  const parts = [...prefix, say('סיימנו')];
  if (state.marked === 1) {
    parts.push(say('סומן כשולם חיוב אחד'));
  } else if (state.marked > 1) {
    parts.push(say('סומנו כשולמו'), num(state.marked), say('חיובים'));
  }
  if (state.reminded === 1) {
    parts.push(say('נשלחה תזכורת אחת'));
  } else if (state.reminded > 1) {
    parts.push(say('נשלחו'), num(state.reminded), say('תזכורות'));
  }
  parts.push(say('שלום'));
  return playAndHangup(...parts);
}
