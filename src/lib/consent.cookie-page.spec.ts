import { describe, expect, it } from 'vitest';
import { COOKIE_POLICY_SLUGS, cookiePolicyHref } from './consent';

const page = (slug: string) => ({ slug, translations: [] });

describe('cookiePolicyHref', () => {
  it('uses the API cookie_page_slug (e.g. a LANDING page absent from pages)', () => {
    expect(cookiePolicyHref({ cookie_page_slug: 'om-cookies', pages: [page('om-oss')] })).toBe(
      '/om-cookies',
    );
  });

  it('cookie_page_slug wins over the pages lookup', () => {
    expect(cookiePolicyHref({ cookie_page_slug: 'om-cookies', pages: [page('cookies')] })).toBe(
      '/om-cookies',
    );
  });

  it('falls back to the published pages when the API sends no slug (older API)', () => {
    expect(cookiePolicyHref({ pages: [page('om-oss'), page('cookie-policy')] })).toBe(
      '/cookie-policy',
    );
    expect(cookiePolicyHref({ cookie_page_slug: null, pages: [page('cookies')] })).toBe('/cookies');
  });

  it('null when nothing matches', () => {
    expect(cookiePolicyHref({ cookie_page_slug: null, pages: [page('om-oss')] })).toBeNull();
    expect(cookiePolicyHref({})).toBeNull();
    expect(cookiePolicyHref({ pages: null })).toBeNull();
  });

  it('slug list stays identical to the API', () => {
    expect(COOKIE_POLICY_SLUGS).toEqual(['om-cookies', 'cookies', 'cookie-policy', 'cookiepolicy']);
  });
});
