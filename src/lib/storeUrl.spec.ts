import { describe, expect, it } from 'vitest';
import { buildStoreAlternates, buildStoreOrigin, type MarketUrlInput } from './storeUrl';

// hreflang matrix for the markets app (M1-DESIGN §8): 2 markets × locales,
// collision handling, x-default, translated slugs, and — above all — that a
// store without markets gets exactly the previous output.

const se: MarketUrlInput = {
  key: 'se',
  is_default: true,
  countries: ['SE'],
  default_locale: 'sv',
  locales: ['en', 'ar'],
  primary_hostname: 'namez.se',
};

const eu: MarketUrlInput = {
  key: 'eu',
  is_default: false,
  countries: ['DE', 'FR', 'AT'],
  default_locale: 'en',
  locales: ['de', 'fr', 'ar'],
  primary_hostname: 'namez.shop',
};

describe('buildStoreOrigin', () => {
  it('keeps the legacy priority without a market', () => {
    expect(buildStoreOrigin('namez', 'shop.example.com')).toBe('https://shop.example.com');
    expect(buildStoreOrigin('namez', null)).toMatch(/^https?:\/\/namez\./);
  });

  it('prefers the market hostname, falls back to legacy when it has none', () => {
    expect(buildStoreOrigin('namez', 'shop.example.com', { primary_hostname: 'namez.se' })).toBe('https://namez.se');
    expect(buildStoreOrigin('namez', 'shop.example.com', { primary_hostname: null })).toBe('https://shop.example.com');
    expect(buildStoreOrigin('namez', null, null)).toBe(buildStoreOrigin('namez', null));
  });
});

describe('buildStoreAlternates (no markets)', () => {
  const legacy = {
    origin: 'https://shop.example.com',
    locale: 'ar',
    primaryLocale: 'en',
    secondaryLocales: ['ar', 'tr'],
    path: '/products/foo',
  };

  it('is byte-identical whether `markets` is omitted, null or empty', () => {
    const base = buildStoreAlternates(legacy);
    expect(base).toEqual({
      canonical: 'https://shop.example.com/ar/products/foo',
      languages: {
        en: 'https://shop.example.com/products/foo',
        ar: 'https://shop.example.com/ar/products/foo',
        tr: 'https://shop.example.com/tr/products/foo',
        'x-default': 'https://shop.example.com/products/foo',
      },
    });
    expect(buildStoreAlternates({ ...legacy, markets: null })).toEqual(base);
    expect(buildStoreAlternates({ ...legacy, markets: [] })).toEqual(base);
    expect(buildStoreAlternates({ ...legacy, markets: [], pathByLocale: { ar: '/products/bar' } })).toEqual(base);
  });

  it('falls back to the primary locale for an unknown ?lang', () => {
    expect(buildStoreAlternates({ ...legacy, locale: 'zz' }).canonical).toBe('https://shop.example.com/products/foo');
  });
});

describe('buildStoreAlternates (markets)', () => {
  const onSe = {
    origin: 'https://namez.se',
    locale: 'sv',
    primaryLocale: 'sv',
    secondaryLocales: ['en', 'ar'],
    path: '/products/metal-card',
    markets: [se, eu],
    storeSlug: 'namez',
  };

  it('emits lang-COUNTRY for single-country markets and lang for multi-country ones', () => {
    const { languages } = buildStoreAlternates(onSe);
    expect(languages['sv-SE']).toBe('https://namez.se/products/metal-card');
    expect(languages['en-SE']).toBe('https://namez.se/en/products/metal-card');
    expect(languages['ar-SE']).toBe('https://namez.se/ar/products/metal-card');
    expect(languages['en']).toBe('https://namez.shop/products/metal-card');
    expect(languages['de']).toBe('https://namez.shop/de/products/metal-card');
    expect(languages['fr']).toBe('https://namez.shop/fr/products/metal-card');
    expect(languages['ar']).toBe('https://namez.shop/ar/products/metal-card');
  });

  it('x-default is the default market in its default locale; canonical stays on the current origin', () => {
    const res = buildStoreAlternates(onSe);
    expect(res.languages['x-default']).toBe('https://namez.se/products/metal-card');
    expect(res.canonical).toBe('https://namez.se/products/metal-card');

    const onEu = buildStoreAlternates({
      ...onSe,
      origin: 'https://namez.shop',
      locale: 'de',
      primaryLocale: 'en',
      secondaryLocales: ['de', 'fr', 'ar'],
    });
    expect(onEu.canonical).toBe('https://namez.shop/de/products/metal-card');
    expect(onEu.languages['x-default']).toBe('https://namez.se/products/metal-card');
  });

  it('resolves code collisions in favour of the default market', () => {
    // Both markets are multi-country → both would emit a plain `en`.
    const seMulti: MarketUrlInput = { ...se, countries: ['SE', 'NO'] };
    const first = buildStoreAlternates({ ...onSe, markets: [eu, seMulti] });
    expect(first.languages['en']).toBe('https://namez.se/en/products/metal-card');
    const second = buildStoreAlternates({ ...onSe, markets: [seMulti, eu] });
    expect(second.languages['en']).toBe('https://namez.se/en/products/metal-card');
    expect(second.languages['ar']).toBe('https://namez.se/ar/products/metal-card');
    expect(second.languages['de']).toBe('https://namez.shop/de/products/metal-card');
  });

  it('uses translated slugs per locale when given', () => {
    const res = buildStoreAlternates({
      ...onSe,
      pathByLocale: { sv: '/products/metallkort', en: '/products/metal-card' },
    });
    expect(res.canonical).toBe('https://namez.se/products/metallkort');
    expect(res.languages['sv-SE']).toBe('https://namez.se/products/metallkort');
    expect(res.languages['en-SE']).toBe('https://namez.se/en/products/metal-card');
    expect(res.languages['de']).toBe('https://namez.shop/de/products/metal-card');
    expect(res.languages['x-default']).toBe('https://namez.se/products/metallkort');
  });

  it('uses the platform origin for a market without its own hostname and skips non-LIVE markets', () => {
    const platformOrigin = buildStoreOrigin('namez', null);
    const res = buildStoreAlternates({
      ...onSe,
      markets: [{ ...se, primary_hostname: null }, { ...eu, status: 'DRAFT' }],
    });
    expect(res.languages['sv-SE']).toBe(`${platformOrigin}/products/metal-card`);
    expect(res.languages['de']).toBeUndefined();
  });
});
