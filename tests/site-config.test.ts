import { describe, expect, it } from 'vitest';
import { SITE_URL, absoluteUrl } from '../src/config/site';

// Every canonical, og:url and sitemap entry is built from these, so a stray
// slash here shows up as a duplicate-content signal on every page at once.
describe('site config', () => {
  it('exposes the canonical origin without a trailing slash', () => {
    expect(SITE_URL).toBe('https://nihulschirut.com');
  });

  it('builds an absolute URL from a rooted path', () => {
    expect(absoluteUrl('/terms')).toBe('https://nihulschirut.com/terms');
  });

  it('tolerates a path that is missing its leading slash', () => {
    expect(absoluteUrl('privacy')).toBe('https://nihulschirut.com/privacy');
  });

  it('returns the bare origin with a trailing slash for the home page', () => {
    expect(absoluteUrl('/')).toBe('https://nihulschirut.com/');
  });

  it('never emits a double slash', () => {
    expect(absoluteUrl('//terms')).toBe('https://nihulschirut.com/terms');
  });
});
