import { createClient } from 'jsr:@supabase/supabase-js@2';
import { play, playAndHangup, read, say, num, sanitize } from './yemot.ts';
import { shabbatQuietWindow } from './shabbat.ts';

// The phone management hub. The landlord calls the Yemot number and reaches a
// main menu:
//   1 - go through every open charge (not just overdue ones), and per charge:
//         1 mark paid · 2 voice-remind the tenant · 3 next · 9 back to menu
//   2 - hear a spoken summary of the month
//   9 - finish
//
// Yemot drives this one step at a time, so each request rebuilds its context
// from ivr_call_state. Two things are frozen there: the charge list (marking
// one paid removes it from the open set, which would renumber everything still
// ahead of the caller), and a single step counter that names each keypad
// prompt - so a value from an earlier stage is never mistaken for a later one.

const SEND_TTS_URL = 'https://www.call2all.co.il/ym/api/SendTTS';
const CHARGE_DIGITS = ['1', '2', '3', '9'];
const MENU_DIGITS = ['1', '2', '9'];

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

type Client = ReturnType<typeof createClient>;
type State = {
  call_id: string;
  owner_id: string;
  stage: 'menu' | 'charges';
  charge_ids: string[];
  position: number;
  marked: number;
  reminded: number;
  step: number;
};

const save = (supabase: Client, state: State) =>
  supabase.from('ivr_call_state').update({
    stage: state.stage,
    charge_ids: state.charge_ids,
    position: state.position,
    marked: state.marked,
    reminded: state.reminded,
    step: state.step,
    updated_at: new Date().toISOString(),
  }).eq('call_id', state.call_id);

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

  // ---- First step of a new call: authorise, greet with a snapshot, menu. ----
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

    const summary = await monthSummary(supabase, match.owner_id);
    const state: State = {
      call_id: callId, owner_id: match.owner_id, stage: 'menu',
      charge_ids: [], position: 0, marked: 0, reminded: 0, step: 0,
    };
    await supabase.from('ivr_call_state').insert(state);
    // Opportunistic cleanup of calls that never sent a hangup ping.
    await supabase.from('ivr_call_state')
      .delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());

    return reply(mainMenu(state, greetingParts(summary)));
  }

  const state = existing as State;
  const pressed = params.get(`s${state.step}`);
  if (!pressed) {
    // No value yet (first delivery of this step, or a timeout) - ask again,
    // at the same step so the prompt and the awaited value stay in sync.
    return reply(await renderCurrent(supabase, state));
  }

  return reply(state.stage === 'menu'
    ? await handleMenu(supabase, state, pressed)
    : await handleCharge(supabase, state, pressed));
});

// ---- Main menu ----

async function handleMenu(supabase: Client, state: State, pressed: string): Promise<string> {
  if (pressed === '9') {
    await supabase.from('ivr_call_state').delete().eq('call_id', state.call_id);
    return farewell(state);
  }

  if (pressed === '2') {
    const summary = await monthSummary(supabase, state.owner_id);
    state.step += 1;
    await save(supabase, state);
    return mainMenu(state, summaryParts(summary));
  }

  if (pressed === '1') {
    const { data } = await supabase.rpc('ivr_open_charges', { p_owner: state.owner_id });
    const charges = (data ?? []) as { charge_id: string }[];
    if (!charges.length) {
      state.step += 1;
      await save(supabase, state);
      return mainMenu(state, [say('אין חיובים פתוחים לעדכון')]);
    }
    state.stage = 'charges';
    state.charge_ids = charges.map((c) => c.charge_id);
    state.position = 0;
    state.step += 1;
    await save(supabase, state);
    return await presentCharge(supabase, state, []);
  }

  return await renderCurrent(supabase, state);
}

// ---- Per-charge loop ----

async function handleCharge(supabase: Client, state: State, pressed: string): Promise<string> {
  if (pressed === '9') {
    state.stage = 'menu';
    state.step += 1;
    await save(supabase, state);
    return mainMenu(state, [say('חזרה לתפריט הראשי')]);
  }
  if (!['1', '2', '3'].includes(pressed)) {
    return await renderCurrent(supabase, state);
  }

  const chargeId = state.charge_ids[state.position];
  const prefix: string[] = [];

  if (pressed === '1') {
    const { data: result } = await supabase.rpc('mark_charge_paid_for_owner', {
      p_owner: state.owner_id, p_charge: chargeId,
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (row?.status === 'ok') {
      state.marked += 1;
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
    if (shabbatQuietWindow(new Date()).quiet) {
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
        state.reminded += 1;
        prefix.push(say('התזכורת נשלחה לשוכר'));
      } else if (outcome === 'no-token') {
        prefix.push(say('שליחת תזכורות עדיין לא מחוברת'));
      } else {
        prefix.push(say('לא הצלחנו לשלוח את התזכורת'));
      }
    }
  }

  // '3' just advances. Move to the next charge, or back to the menu when done.
  state.position += 1;
  state.step += 1;
  if (state.position >= state.charge_ids.length) {
    state.stage = 'menu';
    state.position = 0;
    await save(supabase, state);
    return mainMenu(state, [...prefix, say('עברת על כל החיובים הפתוחים')]);
  }
  await save(supabase, state);
  return await presentCharge(supabase, state, prefix);
}

// ---- Renderers ----

/** Re-emit the current prompt without advancing - for a step re-delivered
 *  without a keypress. */
async function renderCurrent(supabase: Client, state: State): Promise<string> {
  return state.stage === 'menu'
    ? mainMenu(state, [])
    : await presentCharge(supabase, state, []);
}

function mainMenu(state: State, prefix: string[]): string {
  return read(`s${state.step}`, MENU_DIGITS,
    ...prefix,
    say('לעדכון החיובים הפתוחים הקישו'), num(1),
    say('לשמיעת סקירת החודש הקישו'), num(2),
    say('לסיום הקישו'), num(9),
  );
}

async function presentCharge(supabase: Client, state: State, prefix: string[]): Promise<string> {
  const { data } = await supabase.rpc('ivr_charge_details', {
    p_owner: state.owner_id, p_charge: state.charge_ids[state.position],
  });
  const charge = Array.isArray(data) ? data[0] : data;
  if (!charge) {
    // Deleted mid-call; drop it and carry on rather than dead-end the caller.
    return play(say('החיוב הזה אינו זמין'));
  }

  return read(`s${state.step}`, CHARGE_DIGITS,
    ...prefix,
    say('חיוב'), num(state.position + 1), say('מתוך'), num(state.charge_ids.length),
    say(charge.tenant_name),
    say(charge.unit_name),
    say(charge.charge_label),
    num(charge.remaining), say('שקלים'),
    say('לסימון כשולם הקישו'), num(1),
    say('לשליחת תזכורת קולית לשוכר הקישו'), num(2),
    say('לחיוב הבא הקישו'), num(3),
    say('לחזרה לתפריט הראשי הקישו'), num(9),
  );
}

function farewell(state: State): string {
  const parts = [say('סיימנו')];
  if (state.marked === 1) parts.push(say('סומן כשולם חיוב אחד'));
  else if (state.marked > 1) parts.push(say('סומנו כשולמו'), num(state.marked), say('חיובים'));
  if (state.reminded === 1) parts.push(say('נשלחה תזכורת אחת'));
  else if (state.reminded > 1) parts.push(say('נשלחו'), num(state.reminded), say('תזכורות'));
  parts.push(say('שלום'));
  return playAndHangup(...parts);
}

// ---- Summary ----

type Summary = {
  month_charges: number;
  month_paid: number;
  month_open: number;
  month_outstanding: number;
  total_open: number;
  total_outstanding: number;
};

async function monthSummary(supabase: Client, ownerId: string): Promise<Summary> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.rpc('ivr_month_summary', { p_owner: ownerId, p_ref: today });
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    month_charges: Number(row.month_charges ?? 0),
    month_paid: Number(row.month_paid ?? 0),
    month_open: Number(row.month_open ?? 0),
    month_outstanding: Number(row.month_outstanding ?? 0),
    total_open: Number(row.total_open ?? 0),
    total_outstanding: Number(row.total_outstanding ?? 0),
  };
}

// "יש" reads correctly for one or many, sidestepping Hebrew number agreement.
const openCount = (n: number) =>
  n === 1 ? [say('חיוב אחד פתוח')] : [num(n), say('חיובים פתוחים')];

function greetingParts(s: Summary): string[] {
  if (s.total_open === 0) return [say('שלום'), say('אין חיובים פתוחים'), say('הכל מעודכן')];
  return [say('שלום'), say('יש לך'), ...openCount(s.total_open), say('בסך'), num(s.total_outstanding), say('שקלים')];
}

function summaryParts(s: Summary): string[] {
  if (s.total_open === 0) return [say('אין חיובים פתוחים'), say('הכל מעודכן')];
  const parts = [say('החודש'), ...openCount(s.month_open)];
  if (s.month_paid === 1) parts.push(say('שולם חיוב אחד'));
  else if (s.month_paid > 1) parts.push(num(s.month_paid), say('חיובים שולמו'));
  parts.push(say('סך הכל פתוח לתשלום'), num(s.total_outstanding), say('שקלים'));
  return parts;
}
