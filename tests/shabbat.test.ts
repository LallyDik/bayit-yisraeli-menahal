import { describe, expect, it } from 'vitest';
import { HebrewCalendar, Location, flags } from '@hebcal/core';
import { maySendReminder, shabbatQuietWindow } from '../supabase/functions/send-payment-reminders/shabbat';

// Jerusalem is UTC+3 in July (IDT), so 09:00Z == 12:00 local.
const jul = (utc: string) => new Date(utc);

describe('shabbat quiet window', () => {
  it('allows sending on an ordinary weekday', () => {
    // Tue 21 Jul 2026, 12:00 Jerusalem
    expect(maySendReminder(jul('2026-07-21T09:00:00Z'))).toBe(true);
  });

  it('allows sending on Friday morning, before candle lighting', () => {
    // Fri 24 Jul 2026, 12:00 Jerusalem (candle lighting is ~19:10)
    expect(maySendReminder(jul('2026-07-24T09:00:00Z'))).toBe(true);
  });

  it('blocks sending on Friday night, after candle lighting', () => {
    // Fri 24 Jul 2026, 20:00 Jerusalem
    const w = shabbatQuietWindow(jul('2026-07-24T17:00:00Z'));
    expect(w.quiet).toBe(true);
    expect(w.until).not.toBeNull();
  });

  it('blocks sending during Shabbat day', () => {
    // Sat 25 Jul 2026, 12:00 Jerusalem
    expect(maySendReminder(jul('2026-07-25T09:00:00Z'))).toBe(false);
  });

  it('allows sending again after havdalah on Saturday night', () => {
    // Sat 25 Jul 2026, 22:00 Jerusalem (havdalah is ~20:20)
    expect(maySendReminder(jul('2026-07-25T19:00:00Z'))).toBe(true);
  });

  it('blocks sending on Yom Tov (computed, not hardcoded)', () => {
    // Find a real Yom Tov in 5787 and assert midday is quiet.
    const events = HebrewCalendar.calendar({
      start: new Date('2026-09-01'),
      end: new Date('2026-10-31'),
      location: Location.lookup('Jerusalem')!,
      candlelighting: true,
    });
    const yomTov = events.find((e) => (e.getFlags() & flags.CHAG) !== 0 && !!e.getDate());
    expect(yomTov, 'expected to find a Yom Tov in Tishrei').toBeTruthy();

    const d = yomTov!.getDate().greg();
    // midday local (UTC+3 in Sep/early Oct)
    const midday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0));
    expect(maySendReminder(midday)).toBe(false);
  });

  it('reports why it is quiet and when it lifts', () => {
    const w = shabbatQuietWindow(jul('2026-07-25T09:00:00Z'));
    expect(w.quiet).toBe(true);
    expect(typeof w.reason).toBe('string');
    expect(w.reason.length).toBeGreaterThan(0);
    expect(w.until!.getTime()).toBeGreaterThan(jul('2026-07-25T09:00:00Z').getTime());
  });
});
