import { HebrewCalendar, Location, flags } from '@hebcal/core';

// Reminders must never go out on Shabbat or Yom Tov. Rather than special-casing
// "Friday evening" and then separately listing every חג, we lean on the one rule
// that already covers both: the window between candle lighting and havdalah.
// Hebcal emits that pair for Shabbat *and* for every Yom Tov, so a single check
// handles ערב שבת, שבת, ראש השנה, יום כיפור, סוכות, פסח, שבועות - including the
// two-day and back-to-back cases (e.g. Shabbat immediately after a חג), where
// the quiet window simply runs continuously until the final havdalah.

const JERUSALEM = Location.lookup('Jerusalem')!;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QuietWindow = {
  quiet: boolean;
  /** Hebrew explanation, safe to log or show. */
  reason: string;
  /** When the quiet window ends (havdalah). Null when not quiet. */
  until: Date | null;
};

type TimedEvent = { time: Date; kind: 'start' | 'end'; label: string };

/**
 * Collect candle-lighting / havdalah moments around `now`, in chronological order.
 * A window is +/- 4 days, which comfortably spans the longest run
 * (three-day חג + שבת) without pulling in unrelated weeks.
 */
function timedEvents(now: Date): TimedEvent[] {
  const events = HebrewCalendar.calendar({
    start: new Date(now.getTime() - 4 * DAY_MS),
    end: new Date(now.getTime() + 4 * DAY_MS),
    location: JERUSALEM,
    candlelighting: true,
    sedrot: false,
    omer: false,
    noMinorFast: true,
    noSpecialShabbat: true,
  });

  const out: TimedEvent[] = [];
  for (const event of events) {
    const time = event.eventTime;
    if (!time) continue;
    const mask = event.getFlags();
    // Order matters: hebcal's HavdalahEvent also carries LIGHT_CANDLES_TZEIS,
    // so testing the flags first would misread the *end* of a window as a new
    // start - and the quiet window would never close.
    if (event.getDesc() === 'Havdalah') {
      out.push({ time, kind: 'end', label: event.render('he') });
    } else if (mask & flags.LIGHT_CANDLES || mask & flags.LIGHT_CANDLES_TZEIS) {
      // LIGHT_CANDLES = before sunset (ערב שבת/חג); LIGHT_CANDLES_TZEIS = after
      // nightfall (second day of a חג). Both open a quiet window.
      out.push({ time, kind: 'start', label: event.render('he') });
    }
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Is `now` inside a Shabbat / Yom Tov quiet window?
 * Returns the reason and when it lifts, so callers can log why they held off.
 */
export function shabbatQuietWindow(now: Date = new Date()): QuietWindow {
  const events = timedEvents(now);

  // Walk forward; the last 'start' before `now` with no 'end' in between means
  // we are currently inside a quiet window.
  let openedAt: TimedEvent | null = null;
  for (const event of events) {
    if (event.time.getTime() > now.getTime()) break;
    openedAt = event.kind === 'start' ? event : null;
  }

  if (!openedAt) return { quiet: false, reason: 'יום חול', until: null };

  const closesAt = events.find((e) => e.kind === 'end' && e.time.getTime() > now.getTime());
  return {
    quiet: true,
    reason: openedAt.label || 'שבת/חג',
    until: closesAt ? closesAt.time : null,
  };
}

/** Convenience wrapper: may we send a reminder right now? */
export function maySendReminder(now: Date = new Date()): boolean {
  return !shabbatQuietWindow(now).quiet;
}
