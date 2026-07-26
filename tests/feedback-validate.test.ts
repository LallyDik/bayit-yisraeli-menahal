import { describe, expect, it } from 'vitest';
import { validateFeedback } from '../supabase/functions/submit-feedback/validate';

// validateFeedback returns a discriminated union, so the accepted-shape fields
// are only reachable after narrowing. This does the narrowing once and fails
// loudly if a case that should pass validation does not.
const accepted = (input: Record<string, unknown>) => {
  const result = validateFeedback(input);
  if (!result.ok) throw new Error(`expected acceptance, got: ${result.error}`);
  return result;
};

describe('validateFeedback', () => {
  it('accepts a normal message', () => {
    expect(validateFeedback({ message: 'הכפתור של התשלומים לא נטען' }))
      .toEqual({ ok: true, message: 'הכפתור של התשלומים לא נטען', email: null, page: null });
  });

  it('trims surrounding whitespace', () => {
    expect(validateFeedback({ message: '  יש באג  ' }))
      .toEqual({ ok: true, message: 'יש באג', email: null, page: null });
  });

  it('rejects a missing message', () => {
    expect(validateFeedback({})).toEqual({ ok: false, error: 'message is required' });
  });

  it('rejects a message that is only whitespace', () => {
    expect(validateFeedback({ message: '   ' })).toEqual({ ok: false, error: 'message is required' });
  });

  it('rejects a message over 2000 characters', () => {
    expect(validateFeedback({ message: 'x'.repeat(2001) })).toEqual({ ok: false, error: 'message is too long' });
  });

  it('accepts a message of exactly 2000 characters', () => {
    const result = validateFeedback({ message: 'x'.repeat(2000) });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-string message', () => {
    expect(validateFeedback({ message: 42 })).toEqual({ ok: false, error: 'message is required' });
  });

  // A bot fills every field it finds; a human never sees this one.
  it('rejects a filled honeypot', () => {
    expect(validateFeedback({ message: 'hello', website: 'http://spam.example' }))
      .toEqual({ ok: false, error: 'rejected' });
  });

  it('ignores an empty honeypot', () => {
    expect(validateFeedback({ message: 'hello', website: '' }).ok).toBe(true);
  });

  it('keeps a plausible email and drops a malformed one', () => {
    expect(accepted({ message: 'hi', email: 'a@b.co' }).email).toBe('a@b.co');
    expect(accepted({ message: 'hi', email: 'not-an-email' }).email).toBeNull();
  });

  it('truncates an overlong page value rather than rejecting the message', () => {
    expect(accepted({ message: 'hi', page: '/'.repeat(500) }).page).toHaveLength(200);
  });
});
