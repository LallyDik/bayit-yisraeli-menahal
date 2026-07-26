// Pure input validation, kept in its own module so it can be unit tested with
// Vitest without booting Deno — the same split as shabbat.ts and yemot.ts.

export const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 200;

export type FeedbackValidation =
  | { ok: true; message: string; email: string | null; page: string | null }
  | { ok: false; error: string };

export function validateFeedback(input: Record<string, unknown>): FeedbackValidation {
  // Bots fill every input they can find. This one is hidden from humans, so
  // anything in it means the submission is automated.
  const honeypot = input.website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: false, error: 'rejected' };
  }

  const raw = input.message;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'message is required' };
  }

  const message = raw.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: 'message is too long' };
  }

  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

  // A wrong page value is not worth losing the feedback over, so clamp it.
  const rawPage = typeof input.page === 'string' ? input.page.trim() : '';
  const page = rawPage === '' ? null : rawPage.slice(0, MAX_PAGE_LENGTH);

  return { ok: true, message, email, page };
}
