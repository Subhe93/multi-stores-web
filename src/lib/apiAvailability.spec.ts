import { describe, expect, it } from 'vitest';
import {
  isDefinitiveNotFound,
  nullWhenNotFound,
  readWithFallback,
  StoreUnavailableError,
} from './apiAvailability';

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

// `/{pageSlug}` asks the builder system and the legacy system. For a builder
// page the legacy lookup is an uncached 404 on every view, so a temporary
// failure of that call must not take the (cached) builder page down.
describe('readWithFallback', () => {
  type Page = { sections: number };
  const serves = (page: Page | null) => !!page?.sections;
  const fail = (status?: number) => Promise.reject(apiError(status));

  it('returns both values when both reads succeed', async () => {
    const out = await readWithFallback(Promise.resolve({ sections: 2 }), Promise.resolve('legacy'), serves);
    expect(out).toEqual([{ sections: 2 }, 'legacy']);
  });

  it.each([undefined, 500, 502, 503, 504, 408, 429])(
    'ignores a temporary fallback failure (%s) while the primary serves the page',
    async (status) => {
      const out = await readWithFallback(Promise.resolve({ sections: 2 }), fail(status), serves);
      expect(out).toEqual([{ sections: 2 }, null]);
    },
  );

  it('a definitive 404 from either side is null', async () => {
    expect(await readWithFallback<Page, string>(fail(404), Promise.resolve('legacy'), serves)).toEqual([null, 'legacy']);
    expect(await readWithFallback<Page, string>(Promise.resolve({ sections: 2 }), fail(404), serves)).toEqual([
      { sections: 2 },
      null,
    ]);
    expect(await readWithFallback<Page, string>(fail(404), fail(404), serves)).toEqual([null, null]);
  });

  it('a temporary fallback failure stays a 5xx when the primary does not serve the page', async () => {
    // Not found in the builder system: only the legacy answer could tell.
    await expect(readWithFallback<Page, string>(fail(404), fail(502), serves)).rejects.toThrow(StoreUnavailableError);
    // Found but not renderable (no sections): the legacy page would render.
    await expect(
      readWithFallback<Page, string>(Promise.resolve({ sections: 0 }), fail(), serves),
    ).rejects.toThrow(StoreUnavailableError);
  });

  it('a temporary primary failure is always fatal, whatever the fallback says', async () => {
    await expect(readWithFallback<Page, string>(fail(503), Promise.resolve('legacy'), serves)).rejects.toThrow(
      StoreUnavailableError,
    );
    await expect(readWithFallback<Page, string>(fail(), fail(502), serves)).rejects.toThrow(StoreUnavailableError);
  });

  it('a skipped side (null) reads as null', async () => {
    expect(await readWithFallback<Page, string>(null, Promise.resolve('legacy'), serves)).toEqual([null, 'legacy']);
    expect(await readWithFallback<Page, string>(Promise.resolve({ sections: 1 }), null, serves)).toEqual([
      { sections: 1 },
      null,
    ]);
    await expect(readWithFallback<Page, string>(null, fail(500), serves)).rejects.toThrow(StoreUnavailableError);
  });
});
