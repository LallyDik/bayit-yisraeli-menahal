// Yemot HaMashiach "API יוצא" protocol.
//
// Their server calls us on every step of a phone call and expects one line of
// commands back. Messages are joined by "." and each carries a one-letter type
// prefix ("t-" text/TTS, "n-" number, "g-" go to folder), which is why TTS text
// may not contain . - " ' & | — those are the protocol's own separators, and a
// charge label like "שכר דירה - יולי" would silently split into two messages.
// Reference: lib/response-functions.js in ShlomoCode/yemot-router2.

// Both sets are forbidden, but they are removed differently: quotes sit inside
// a word (שכ"ד), so replacing them with a space would split it, while a period
// or dash separates words and has to leave one behind.
const DROP_FROM_TTS = /["']/g;
// Em and en dashes are not protocol separators, but they are common in Hebrew
// labels ("שכר דירה — יולי") and the reader stumbles over them, so they go too.
const SPACE_IN_TTS = /[.\-—–&|]/g;

/** Strip the characters that would be read as protocol separators. */
export const sanitize = (text: unknown) =>
  String(text ?? '')
    .replace(DROP_FROM_TTS, '')
    .replace(SPACE_IN_TTS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const say = (text: unknown) => `t-${sanitize(text)}`;

/** Numbers get their own type so they are spoken as "four thousand nine
 *  hundred" rather than digit by digit. Rounded, because a decimal point is a
 *  message separator. */
export const num = (value: unknown) => `n-${Math.round(Number(value) || 0)}`;

const combine = (parts: string[]) => parts.filter(Boolean).join('.');

export const play = (...parts: string[]) => `id_list_message=${combine(parts)}`;

export const playAndHangup = (...parts: string[]) =>
  `id_list_message=${combine([...parts, 'g-hangup'])}`;

/**
 * Play a prompt and collect one keypress into `valName`, which comes back as a
 * query parameter on the next request.
 *
 * The 14 positional options are Yemot's, in their order:
 * valName, re_enter_if_exists, max_digits, min_digits, sec_wait,
 * typing_playback_mode, block_asterisk_key, block_zero_key, replace_char,
 * digits_allowed, amount_attempts, allow_empty, empty_val, block_change_keyboard.
 */
export const read = (valName: string, digitsAllowed: string[], ...parts: string[]) => {
  const options = [
    valName,
    'no',                      // re_enter_if_exists — ask once per step
    '1',                       // max_digits
    '1',                       // min_digits
    '7',                       // sec_wait
    'No',                      // typing_playback_mode
    'no',                      // block_asterisk_key
    'no',                      // block_zero_key
    '',                        // replace_char
    digitsAllowed.join('.'),   // digits_allowed
    '',                        // amount_attempts
    '',                        // allow_empty
    '',                        // empty_val
    '',                        // block_change_keyboard
  ];
  return `read=${combine(parts)}=${options.join(',')}`;
};
