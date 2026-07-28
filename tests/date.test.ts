import { describe, expect, it } from 'vitest';
import { addDaysISO } from '../src/utils/date';

describe('addDaysISO', () => {
  it('adds days', () => { expect(addDaysISO('2026-07-27', 3)).toBe('2026-07-30'); });
  it('subtracts days', () => { expect(addDaysISO('2026-07-27', -2)).toBe('2026-07-25'); });
  it('zero is identity', () => { expect(addDaysISO('2026-07-27', 0)).toBe('2026-07-27'); });
  it('crosses a month', () => { expect(addDaysISO('2026-07-30', 3)).toBe('2026-08-02'); });
  it('crosses a year', () => { expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01'); });
});
