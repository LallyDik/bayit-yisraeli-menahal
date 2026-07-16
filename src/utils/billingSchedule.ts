export type BillingCalendar = 'gregorian' | 'hebrew';

export interface GeneratedBillingOccurrence {
  sequence_no: number;
  due_date: string;
  calendar_label: string;
  period_key: string;
}

export interface HebrewMonthOption {
  key: string;
  label: string;
}

export const HEBREW_DAY_LABELS = [
  'א׳',
  'ב׳',
  'ג׳',
  'ד׳',
  'ה׳',
  'ו׳',
  'ז׳',
  'ח׳',
  'ט׳',
  'י׳',
  'י״א',
  'י״ב',
  'י״ג',
  'י״ד',
  'ט״ו',
  'ט״ז',
  'י״ז',
  'י״ח',
  'י״ט',
  'כ׳',
  'כ״א',
  'כ״ב',
  'כ״ג',
  'כ״ד',
  'כ״ה',
  'כ״ו',
  'כ״ז',
  'כ״ח',
  'כ״ט',
  'ל׳',
];

const atNoon = (year: number, monthIndex: number, day: number) => (
  new Date(year, monthIndex, day, 12, 0, 0, 0)
);

const parseISODate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return atNoon(year, month - 1, day);
};

export const toISODate = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const addDays = (date: Date, days: number) => (
  atNoon(date.getFullYear(), date.getMonth(), date.getDate() + days)
);

const gregorianLabel = (date: Date) => new Intl.DateTimeFormat('he-IL', {
  month: 'long',
}).format(date);

const hebrewPartsFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  calendar: 'hebrew',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem',
});

const hebrewLabelFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  calendar: 'hebrew',
  month: 'long',
  timeZone: 'Asia/Jerusalem',
});

const hebrewCompactFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  calendar: 'hebrew',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jerusalem',
});

const HEBREW_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const HEBREW_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HEBREW_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

function hebrewNumberBelow100(value: number) {
  if (value === 15) return 'טו';
  if (value === 16) return 'טז';
  return `${HEBREW_TENS[Math.floor(value / 10)] ?? ''}${HEBREW_ONES[value % 10] ?? ''}`;
}

export function hebrewYearLabel(year: number) {
  const compact = year % 1000;
  let hundreds = Math.floor(compact / 100);
  const rest = compact % 100;
  let hundredsLetters = '';
  while (hundreds > 0) {
    const chunk = Math.min(hundreds, 4);
    hundredsLetters += HEBREW_HUNDREDS[chunk] ?? '';
    hundreds -= chunk;
  }
  const letters = `${hundredsLetters}${hebrewNumberBelow100(rest)}`;
  if (letters.length <= 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

function hebrewParts(date: Date) {
  const parts = hebrewPartsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const day = Number(get('day'));
  const month = get('month');
  const year = Number(get('year'));
  return { day, month, year, key: `${year}:${month}` };
}

function hebrewDisplayParts(date: Date) {
  const parts = hebrewCompactFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: Number(get('day')),
    month: get('month'),
    year: Number(get('year')),
  };
}

function hebrewYearScanRange(year: number) {
  return {
    start: atNoon(year - 3762, 0, 1),
    end: atNoon(year - 3759, 11, 31),
  };
}

export function hebrewDateParts(value: string) {
  const date = parseISODate(value);
  const keyParts = hebrewParts(date);
  const displayParts = hebrewDisplayParts(date);
  return {
    day: keyParts.day,
    monthKey: keyParts.month,
    monthLabel: displayParts.month,
    year: keyParts.year,
  };
}

export function listHebrewMonthsForYear(year: number): HebrewMonthOption[] {
  const { start, end } = hebrewYearScanRange(year);
  const months: HebrewMonthOption[] = [];
  const seen = new Set<string>();
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const keyParts = hebrewParts(cursor);
    if (keyParts.year !== year || seen.has(keyParts.month)) continue;
    seen.add(keyParts.month);
    months.push({ key: keyParts.month, label: hebrewDisplayParts(cursor).month });
  }
  return months;
}

export function hebrewDateToISO(input: { year: number; monthKey: string; day: number }) {
  const { start, end } = hebrewYearScanRange(input.year);
  let fallback: Date | null = null;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const parts = hebrewParts(cursor);
    if (parts.year !== input.year || parts.month !== input.monthKey) continue;
    fallback = cursor;
    if (parts.day === input.day) return toISODate(cursor);
  }
  if (fallback) return toISODate(fallback);
  throw new Error('לא ניתן למצוא את התאריך העברי שנבחר.');
}

function generateGregorian(startDate: string, dueDay: number, count: number) {
  const start = parseISODate(startDate);
  const occurrences: GeneratedBillingOccurrence[] = [];
  let cursor = atNoon(start.getFullYear(), start.getMonth(), 1);

  while (occurrences.length < count) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const due = atNoon(cursor.getFullYear(), cursor.getMonth(), Math.min(dueDay, lastDay));
    if (due >= start) {
      const iso = toISODate(due);
      occurrences.push({
        sequence_no: occurrences.length + 1,
        due_date: iso,
        calendar_label: gregorianLabel(due),
        period_key: `schedule:gregorian:${iso}`,
      });
    }
    cursor = atNoon(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return occurrences;
}

function firstDayOfHebrewMonth(date: Date) {
  let cursor = date;
  const key = hebrewParts(cursor).key;
  for (let i = 0; i < 31; i += 1) {
    const previous = addDays(cursor, -1);
    if (hebrewParts(previous).key !== key) break;
    cursor = previous;
  }
  return cursor;
}

function generateHebrew(startDate: string, dueDay: number, count: number) {
  const start = parseISODate(startDate);
  const occurrences: GeneratedBillingOccurrence[] = [];
  let cursor = firstDayOfHebrewMonth(start);
  let monthDates: Array<{ date: Date; day: number }> = [];
  let monthKey = hebrewParts(cursor).key;

  const finishMonth = () => {
    if (monthDates.length === 0 || occurrences.length >= count) return;
    const exact = monthDates.find((item) => item.day === dueDay);
    const chosen = exact ?? monthDates[monthDates.length - 1];
    if (chosen.date >= start) {
      const iso = toISODate(chosen.date);
      occurrences.push({
        sequence_no: occurrences.length + 1,
        due_date: iso,
        calendar_label: hebrewLabelFormatter.format(chosen.date),
        period_key: `schedule:hebrew:${iso}`,
      });
    }
  };

  // 48 Hebrew months need at most a little over four Gregorian years.
  // The guard keeps a malformed Intl implementation from looping forever.
  for (let guard = 0; guard < 2200 && occurrences.length < count; guard += 1) {
    const parts = hebrewParts(cursor);
    if (parts.key !== monthKey) {
      finishMonth();
      monthDates = [];
      monthKey = parts.key;
      if (occurrences.length >= count) break;
    }
    monthDates.push({ date: cursor, day: parts.day });
    cursor = addDays(cursor, 1);
  }

  if (occurrences.length < count) finishMonth();
  if (occurrences.length !== count) throw new Error('לא ניתן ליצור לוח תשלומים עברי מלא.');
  return occurrences;
}

export function generateBillingSchedule(input: {
  calendar: BillingCalendar;
  dueDay: number;
  startDate: string;
  count?: number;
}): GeneratedBillingOccurrence[] {
  const maxDay = input.calendar === 'hebrew' ? 30 : 31;
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > maxDay) {
    throw new Error(`יום התשלום חייב להיות בין 1 ל-${maxDay}.`);
  }
  const count = input.count ?? 48;
  return input.calendar === 'hebrew'
    ? generateHebrew(input.startDate, input.dueDay, count)
    : generateGregorian(input.startDate, input.dueDay, count);
}

export const formatBillingDate = (value: string) => new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(parseISODate(value));

export const formatBillingShortDate = (value: string, calendar: BillingCalendar = 'gregorian') => {
  const date = parseISODate(value);
  if (calendar === 'hebrew') {
    const parts = hebrewCompactFormatter.formatToParts(date);
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? 0);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
    return `${HEBREW_DAY_LABELS[day - 1] ?? day} ב${month} ${hebrewYearLabel(year)}`;
  }
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};
