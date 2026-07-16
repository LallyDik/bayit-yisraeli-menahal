import { describe, expect, it } from 'vitest';
import {
  formatBillingShortDate,
  generateBillingSchedule,
  hebrewDateParts,
  hebrewDateToISO,
  hebrewYearLabel,
  listHebrewMonthsForYear,
} from '../src/utils/billingSchedule';

describe('billing schedule generation', () => {
  it('uses the last Gregorian day when the selected day is missing', () => {
    const schedule = generateBillingSchedule({
      calendar: 'gregorian', dueDay: 31, startDate: '2026-02-01', count: 2,
    });
    expect(schedule.map((item) => item.due_date)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('keeps entry date separate and starts with the next valid due date', () => {
    const schedule = generateBillingSchedule({
      calendar: 'gregorian', dueDay: 5, startDate: '2026-07-14', count: 2,
    });
    expect(schedule[0].due_date).toBe('2026-08-05');
  });

  it('creates 13 Hebrew monthly occurrences across a leap year', () => {
    const schedule = generateBillingSchedule({
      calendar: 'hebrew', dueDay: 10, startDate: '2023-09-16', count: 13,
    });
    expect(schedule).toHaveLength(13);
    expect(schedule.some((item) => item.calendar_label.includes('אדר א׳'))).toBe(true);
    expect(schedule.some((item) => item.calendar_label.includes('אדר ב׳'))).toBe(true);
  });

  it('uses the final day of a 29-day Hebrew month when day 30 was selected', () => {
    const schedule = generateBillingSchedule({
      calendar: 'hebrew', dueDay: 30, startDate: '2026-07-01', count: 12,
    });
    expect(schedule.every((item) => {
      const day = Number(new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric', timeZone: 'Asia/Jerusalem',
      }).format(new Date(`${item.due_date}T12:00:00`)));
      return day === 29 || day === 30;
    })).toBe(true);
  });

  it('formats Hebrew billing dates with a Hebrew year label', () => {
    expect(hebrewYearLabel(5786)).toBe('תשפ״ו');
    expect(formatBillingShortDate('2026-08-01', 'hebrew')).toContain('תשפ״ו');
    expect(formatBillingShortDate('2026-08-01', 'hebrew')).not.toContain('5786');
  });

  it('keeps the Gregorian year in short billing dates', () => {
    expect(formatBillingShortDate('2026-08-01', 'gregorian')).toContain('2026');
  });

  it('converts a selected Hebrew start date to the matching Gregorian ISO date', () => {
    const parts = hebrewDateParts('2026-08-01');
    expect(hebrewDateToISO({
      year: parts.year,
      monthKey: parts.monthKey,
      day: parts.day,
    })).toBe('2026-08-01');
  });

  it('lists both Adar months in a Hebrew leap year', () => {
    const months = listHebrewMonthsForYear(5784).map((month) => month.label);
    expect(months.some((month) => month.includes('אדר א'))).toBe(true);
    expect(months.some((month) => month.includes('אדר ב'))).toBe(true);
  });
});
