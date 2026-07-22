// The public origin. Everything that needs an absolute URL — canonical tags,
// Open Graph, the sitemap — derives it from here, so moving domains is a
// one-line change instead of a search across eight files.
export const SITE_URL = 'https://nihulschirut.com';

/** Joins `path` onto the canonical origin, collapsing any repeated slashes. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, '')}`;
}
