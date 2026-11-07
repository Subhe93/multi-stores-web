import { describe, expect, it } from 'vitest';
import {
  checkoutViewerToken, encodePreviewCookie, previewTokenFor, resolveStorefrontFetchOptions,
  STOREFRONT_VIEWER_HEADER, storefrontViewerHeaders,
} from './storePreview';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdG9yZV9pZCI6InMifQ.c2lnbmF0dXJl';
const fallback = { next: { tags: ['store:namez-se'], revalidate: 3600 } };

describe('storePreview', () => {
  it('binds the cookie to the slug it was accepted for', () => {
    const cookie = encodePreviewCookie('namez-se', JWT);
    expect(previewTokenFor('namez-se', cookie)).toBe(JWT);
    expect(previewTokenFor('other-store', cookie)).toBeNull();
    expect(previewTokenFor('namez-se', null)).toBeNull();
    expect(previewTokenFor('namez-se', 'namez-se:not-a-jwt')).toBeNull();
    expect(previewTokenFor('namez-se', JWT)).toBeNull();
  });

  it('gated store + cookie for this slug → Bearer token, no-store', () => {
    const opts = resolveStorefrontFetchOptions({
      slug: 'namez-se',
      store: { coming_soon: true },
      cookie: encodePreviewCookie('namez-se', JWT),
      fallback,
    });
    expect(opts).toEqual({ token: JWT, cache: 'no-store' });
    expect(
      resolveStorefrontFetchOptions({ slug: 'namez-se', store: { paused: true }, cookie: encodePreviewCookie('namez-se', JWT), fallback }),
    ).toEqual({ token: JWT, cache: 'no-store' });
  });

  it('LIVE store → the cached options unchanged, even with a cookie', () => {
    const opts = resolveStorefrontFetchOptions({
      slug: 'namez-se',
      store: { status: 'LIVE' },
      cookie: encodePreviewCookie('namez-se', JWT),
      fallback,
    });
    expect(opts).toBe(fallback);
  });

  it('gated store without a cookie, or a cookie of another slug → cached options', () => {
    expect(resolveStorefrontFetchOptions({ slug: 'namez-se', store: { coming_soon: true }, cookie: null, fallback })).toBe(fallback);
    expect(
      resolveStorefrontFetchOptions({ slug: 'namez-se', store: { coming_soon: true }, cookie: encodePreviewCookie('other', JWT), fallback }),
    ).toBe(fallback);
  });

  it('picks the checkout config bearer: edit-hint token, then the session', () => {
    // No document here: the preview cookie is never read.
    expect(checkoutViewerToken('namez-se', { editHintToken: JWT, sessionToken: 'session' })).toBe(JWT);
    expect(checkoutViewerToken('namez-se', { editHintToken: 'not-a-jwt', sessionToken: 'session' })).toBe('session');
    expect(checkoutViewerToken('namez-se', { editHintToken: null, sessionToken: null })).toBeNull();
  });
});

describe('storefrontViewerHeaders', () => {
  it('sends the viewer token as a Bearer header only when it is usable', () => {
    expect(storefrontViewerHeaders(JWT)).toEqual({ [STOREFRONT_VIEWER_HEADER]: `Bearer ${JWT}` });
    expect(STOREFRONT_VIEWER_HEADER).toBe('X-Storefront-Viewer');
    expect(storefrontViewerHeaders(null)).toEqual({});
    expect(storefrontViewerHeaders('')).toEqual({});
    expect(storefrontViewerHeaders('bad token')).toEqual({});
    expect(storefrontViewerHeaders('abc\r\nX-Evil: 1')).toEqual({});
  });
});
