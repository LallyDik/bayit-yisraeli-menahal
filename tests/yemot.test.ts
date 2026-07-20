import { describe, expect, it } from 'vitest';
import { sanitize, say, num, play, playAndHangup, read } from '../supabase/functions/ivr-payments/yemot';

// The protocol packs everything into one line, so a stray separator inside a
// charge label or tenant name silently turns one spoken message into two.
describe('yemot protocol', () => {
  describe('sanitize', () => {
    it('strips every character the protocol uses as a separator', () => {
      expect(sanitize('שכר דירה - יולי')).toBe('שכר דירה יולי');
      expect(sanitize('חשמל. מים & גז')).toBe('חשמל מים גז');
      expect(sanitize(`דירת ה"מרתף" של יוסי`)).toBe('דירת המרתף של יוסי');
      expect(sanitize('א|ב')).toBe('א ב');
    });

    it('collapses the whitespace it leaves behind', () => {
      expect(sanitize('שכר   דירה  --  יולי')).toBe('שכר דירה יולי');
    });

    it('survives null and undefined labels', () => {
      expect(sanitize(null)).toBe('');
      expect(sanitize(undefined)).toBe('');
    });
  });

  describe('message types', () => {
    it('prefixes text with t- and numbers with n-', () => {
      expect(say('שלום')).toBe('t-שלום');
      expect(num(4900)).toBe('n-4900');
    });

    it('rounds numbers, because a decimal point would split the message', () => {
      expect(num(893.7)).toBe('n-894');
      expect(num('1250.4')).toBe('n-1250');
      expect(num(null)).toBe('n-0');
    });
  });

  describe('commands', () => {
    it('joins messages with a period', () => {
      expect(play(say('יש'), num(4), say('חיובים'))).toBe('id_list_message=t-יש.n-4.t-חיובים');
    });

    it('appends the hangup folder as the last message', () => {
      expect(playAndHangup(say('שלום'))).toBe('id_list_message=t-שלום.g-hangup');
    });

    it('builds a read with all fourteen positional options in order', () => {
      expect(read('k0', ['1', '2', '3', '9'], say('בחרו'))).toBe(
        'read=t-בחרו=k0,no,1,1,7,No,no,no,,1.2.3.9,,,,',
      );
    });

    it('keeps a sanitized label from breaking the command', () => {
      const command = read('k2', ['1', '3'], say('שכר דירה - יולי'), num(4900));
      expect(command).toBe('read=t-שכר דירה יולי.n-4900=k2,no,1,1,7,No,no,no,,1.3,,,,');
      // Exactly one "=" separating messages from options, and one per command.
      expect(command.split('=').length - 1).toBe(2);
    });
  });
});

describe('hebrew labels in the wild', () => {
  it('drops the em dash that real charge labels carry', () => {
    expect(sanitize('שכר דירה — יולי')).toBe('שכר דירה יולי');
    expect(sanitize('ארנונה – בדיקה')).toBe('ארנונה בדיקה');
  });
});
