import { describe, expect, it } from 'vitest';
import {
  canonicalRedirectHref,
  decodeRouteParam,
  encodeUrlPath,
  isNonCanonicalSlugForm,
  isUsableSlug,
  routeSlug,
  routeSlugs,
  slugsEqual,
} from './slugRoute';

// What Next 16 hands to a page for `/products/kläder` and an Arabic slug.
const KLADER_ENCODED = encodeURIComponent('kläder'); // kl%C3%A4der
const ARABIC = 'هدية-لأمي';
const ARABIC_ENCODED = encodeURIComponent(ARABIC);

describe('routeSlug', () => {
  it('decodes percent-encoded params (upper- and lowercase hex)', () => {
    expect(routeSlug(KLADER_ENCODED)).toBe('kläder');
    expect(routeSlug(KLADER_ENCODED.toLowerCase())).toBe('kläder');
    expect(routeSlug(ARABIC_ENCODED)).toBe(ARABIC);
  });

  it('lowercases and composes to NFC', () => {
    expect(routeSlug('Kläder')).toBe('kläder');
    expect(routeSlug(encodeURIComponent('KLÄDER'))).toBe('kläder');
  });

  it('leaves malformed escapes and ASCII slugs alone', () => {
    expect(routeSlug('100%-cotton')).toBe('100%-cotton');
    expect(routeSlug('3d_presenter')).toBe('3d_presenter');
    expect(routeSlug(undefined)).toBe('');
  });

  it('maps every catch-all segment', () => {
    expect(routeSlugs(['Parent', KLADER_ENCODED])).toEqual(['parent', 'kläder']);
    expect(routeSlugs(undefined)).toEqual([]);
  });
});

describe('decodeRouteParam / isNonCanonicalSlugForm', () => {
  it('keeps the requested case and Unicode form', () => {
    expect(decodeRouteParam(encodeURIComponent('Kläder'))).toBe('Kläder');
  });

  it('flags case and NFD variants of the stored slug', () => {
    expect(isNonCanonicalSlugForm(encodeURIComponent('Kläder'), 'kläder')).toBe(true);
    // A stored slug with literal octets must never trigger a redirect loop.
    expect(isNonCanonicalSlugForm('kl%25c3%25a4der', 'kl%c3%a4der')).toBe(false);
    expect(isNonCanonicalSlugForm('kl%c3%a4der', 'kl%c3%a4der')).toBe(false);
    expect(isNonCanonicalSlugForm(encodeURIComponent('kläder'), 'kläder')).toBe(true);
    expect(isNonCanonicalSlugForm('Shirt', 'shirt')).toBe(true);
  });

  it('does not flag the stored form, hex case or a different slug', () => {
    expect(isNonCanonicalSlugForm(KLADER_ENCODED, 'kläder')).toBe(false);
    expect(isNonCanonicalSlugForm(KLADER_ENCODED.toLowerCase(), 'kläder')).toBe(false);
    expect(isNonCanonicalSlugForm(ARABIC_ENCODED, ARABIC)).toBe(false);
    expect(isNonCanonicalSlugForm('shirts', 'shirt')).toBe(false);
  });

  it('converges on a legacy stored slug that is not lowercase', () => {
    expect(isNonCanonicalSlugForm('about-us', 'About-Us')).toBe(true);
    expect(isNonCanonicalSlugForm('About-Us', 'About-Us')).toBe(false);
  });

  it('slugsEqual compares lookup forms', () => {
    expect(slugsEqual(KLADER_ENCODED, 'Kläder')).toBe(true);
    expect(slugsEqual('a', 'b')).toBe(false);
  });
});

describe('isUsableSlug', () => {
  it('accepts slugs in any script', () => {
    expect(isUsableSlug('shirt')).toBe(true);
    expect(isUsableSlug('kläder')).toBe(true);
    expect(isUsableSlug(ARABIC)).toBe(true);
    expect(isUsableSlug('١٢٣')).toBe(true);
    expect(isUsableSlug('42')).toBe(true);
  });

  it('rejects empty and punctuation-only slugs', () => {
    expect(isUsableSlug('')).toBe(false);
    expect(isUsableSlug(undefined)).toBe(false);
    expect(isUsableSlug(null)).toBe(false);
    expect(isUsableSlug('-')).toBe(false);
    expect(isUsableSlug('--_')).toBe(false);
  });
});

describe('encodeUrlPath', () => {
  it('encodes each segment with lowercase hex', () => {
    expect(encodeUrlPath('/collections/parent/kläder')).toBe('/collections/parent/kl%c3%a4der');
    expect(encodeUrlPath(`/products/${ARABIC}`)).toBe(`/products/${ARABIC_ENCODED.toLowerCase()}`);
  });

  it('is idempotent on already-encoded paths', () => {
    expect(encodeUrlPath(`/collections/parent/${KLADER_ENCODED}`)).toBe('/collections/parent/kl%c3%a4der');
    const once = encodeUrlPath(`/products/${ARABIC}`);
    expect(encodeUrlPath(once)).toBe(once);
  });

  it('leaves ASCII paths, the root and a query string unchanged', () => {
    expect(encodeUrlPath('/products/3d_presenter')).toBe('/products/3d_presenter');
    expect(encodeUrlPath('')).toBe('');
    expect(encodeUrlPath('/products?sort=a&b=ä')).toBe('/products?sort=a&b=ä');
  });

  it('keeps an encoded slash inside a segment encoded', () => {
    expect(encodeUrlPath('/a%2Fb/c')).toBe('/a%2fb/c');
  });
});

describe('canonicalRedirectHref', () => {
  it('restores the locale prefix, encodes the path and keeps the query', () => {
    expect(canonicalRedirectHref('/collections/kläder', { lang: 'ar', sort: 'newest', search: 'a b' })).toBe(
      '/ar/collections/kl%c3%a4der?sort=newest&search=a+b',
    );
  });

  it('has no prefix or query when none was given', () => {
    expect(canonicalRedirectHref('/products/shirt', {})).toBe('/products/shirt');
    expect(canonicalRedirectHref('/products/shirt', { tag: ['a', 'b'], x: undefined })).toBe(
      '/products/shirt?tag=a&tag=b',
    );
  });
});
