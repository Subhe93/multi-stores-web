import { describe, expect, it } from 'vitest';
import { isDefinitiveNotFound, nullWhenNotFound, StoreUnavailableError } from './apiAvailability';

// A single-resource read (product, page, legal page) answers 404 only when
// the API definitively said so. An API failure must stay a 5xx: with the
// fetch cache expired at once after an edit, a hiccup would otherwise turn a
// live product page into a 404 for crawlers.

const apiError = (status?: number) => Object.assign(new Error('x'), status === undefined ? {} : { status });

describe('nullWhenNotFound', () => {
  it.each([404, 400, 403, 410, 422])('returns null for a definitive %i', (status) => {
    expect(isDefinitiveNotFound(apiError(status))).toBe(true);
    expect(nullWhenNotFound(apiError(status))).toBeNull();
  });

  it.each([408, 429, 500, 502, 503, 504])('rethrows %i as StoreUnavailableError', (status) => {
    expect(() => nullWhenNotFound(apiError(status))).toThrow(StoreUnavailableError);
  });

  it('rethrows a network error (no status) and non-error values', () => {
    expect(() => nullWhenNotFound(apiError())).toThrow(StoreUnavailableError);
    expect(() => nullWhenNotFound(new TypeError('fetch failed'))).toThrow(StoreUnavailableError);
    expect(() => nullWhenNotFound('boom')).toThrow(StoreUnavailableError);
    expect(() => nullWhenNotFound(null)).toThrow(StoreUnavailableError);
  });
});
