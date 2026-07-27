import { describe, expect, it } from 'vitest';
import { markPaidLabel } from '../src/utils/payment';

describe('markPaidLabel', () => {
  it('cash → שולם', () => { expect(markPaidLabel('cash')).toBe('שולם'); });
  it('transfer → בוצעה העברה', () => { expect(markPaidLabel('transfer')).toBe('בוצעה העברה'); });
  it("check → הופקד צ'ק", () => { expect(markPaidLabel('check')).toBe("הופקד צ'ק"); });
  it('null → default סמן כשולם', () => { expect(markPaidLabel(null)).toBe('סמן כשולם'); });
  it('undefined → default סמן כשולם', () => { expect(markPaidLabel(undefined)).toBe('סמן כשולם'); });
});
