import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStoreAlternates, buildStoreOrigin, isIndexableMarket, isServableMarket, marketPublicHostname, storeHref, type MarketUrlInput } from './storeUrl';

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

  it('uses the platform origin for a hostless ALWAYS market and skips non-LIVE markets', () => {
    const platformOrigin = buildStoreOrigin('namez', null);
    const res = buildStoreAlternates({
      ...onSe,
      markets: [{ ...se, primary_hostname: null, indexing: 'ALWAYS' }, { ...eu, status: 'DRAFT' }],
    });
    expect(res.languages['sv-SE']).toBe(`${platformOrigin}/products/metal-card`);
    expect(res.languages['de']).toBeUndefined();
  });

  describe('M6.1 indexing modes', () => {
    it('isIndexableMarket: NEVER never, ALWAYS anywhere, AUTO only with a custom domain', () => {
      // AUTO (explicit and absent) needs a hostname: the platform subdomain is noindex.
      expect(isIndexableMarket(se)).toBe(true);
      expect(isIndexableMarket({ ...se, indexing: 'AUTO' })).toBe(true);
      expect(isIndexableMarket({ ...se, primary_hostname: null })).toBe(false);
      expect(isIndexableMarket({ ...se, primary_hostname: null, indexing: 'AUTO' })).toBe(false);
      // ALWAYS: indexable on the platform subdomain too.
      expect(isIndexableMarket({ ...se, primary_hostname: null, indexing: 'ALWAYS' })).toBe(true);
      // NEVER: not indexable even with a hostname, but still servable.
      const euNever: MarketUrlInput = { ...eu, indexing: 'NEVER' };
      expect(isIndexableMarket(euNever)).toBe(false);
      expect(isServableMarket(euNever)).toBe(true);
      // Servability still wins: a hostless secondary market or a DRAFT one is out.
      expect(isIndexableMarket({ ...eu, primary_hostname: null, indexing: 'ALWAYS' })).toBe(false);
      expect(isIndexableMarket({ ...eu, status: 'DRAFT', indexing: 'ALWAYS' })).toBe(false);
    });

    it("a NEVER market is left out of other markets' hreflang lists", () => {
      const euNever: MarketUrlInput = { ...eu, indexing: 'NEVER' };
      const res = buildStoreAlternates({ ...onSe, markets: [se, euNever] });
      expect(res.languages['sv-SE']).toBe('https://namez.se/products/metal-card');
      expect(res.languages['de']).toBeUndefined();
      expect(res.languages['x-default']).toBe('https://namez.se/products/metal-card');
    });

    it('a hostless AUTO default market is left out, the same market as ALWAYS is advertised', () => {
      const hostless: MarketUrlInput = { ...se, primary_hostname: null };
      const auto = buildStoreAlternates({ ...onSe, markets: [hostless, eu] });
      expect(auto.languages['sv-SE']).toBeUndefined();
      expect(auto.languages['de']).toBe('https://namez.shop/de/products/metal-card');
      const always = buildStoreAlternates({ ...onSe, markets: [{ ...hostless, indexing: 'ALWAYS' }, eu] });
      expect(always.languages['sv-SE']).toBe(`${buildStoreOrigin('namez', null)}/products/metal-card`);
    });

    it('a default AUTO market without a StoreDomain row counts the legacy custom_domain as its host (Namez on resumely.net)', () => {
      const hostless: MarketUrlInput = { ...se, primary_hostname: null };
      expect(marketPublicHostname(hostless, 'resumely.net')).toBe('resumely.net');
      expect(marketPublicHostname(hostless, null)).toBeNull();
      // Only the default market inherits the legacy domain; its own row wins.
      expect(marketPublicHostname({ ...eu, primary_hostname: null }, 'resumely.net')).toBeNull();
      expect(marketPublicHostname(se, 'resumely.net')).toBe('namez.se');
      expect(isIndexableMarket(hostless, 'resumely.net')).toBe(true);
      expect(isIndexableMarket(hostless, null)).toBe(false);
      expect(isIndexableMarket({ ...hostless, indexing: 'NEVER' }, 'resumely.net')).toBe(false);

      // On the EU market: the default market is advertised on the custom domain.
      const onEu = buildStoreAlternates({
        ...onSe,
        origin: 'https://namez.shop',
        locale: 'de',
        primaryLocale: 'en',
        secondaryLocales: ['de', 'fr', 'ar'],
        markets: [hostless, eu],
        storeCustomDomain: 'resumely.net',
      });
      expect(onEu.languages['sv-SE']).toBe('https://resumely.net/products/metal-card');
      expect(onEu.languages['en-SE']).toBe('https://resumely.net/en/products/metal-card');
      expect(onEu.languages['x-default']).toBe('https://resumely.net/products/metal-card');
      expect(onEu.languages['de']).toBe('https://namez.shop/de/products/metal-card');
      // On the default market itself (origin = custom domain via buildStoreOrigin).
      const onSelf = buildStoreAlternates({
        ...onSe,
        origin: buildStoreOrigin('namez', 'resumely.net', hostless),
        markets: [hostless, eu],
        storeCustomDomain: 'resumely.net',
      });
      expect(onSelf.canonical).toBe('https://resumely.net/products/metal-card');
      expect(onSelf.languages['sv-SE']).toBe('https://resumely.net/products/metal-card');
      // Without the legacy domain the same market is dropped (platform subdomain = noindex).
      expect(buildStoreAlternates({ ...onSe, markets: [hostless, eu] }).languages['sv-SE']).toBeUndefined();
    });

    it('the explicit `noindex` verdict (proxy header) yields a self canonical and no hreflang, like a preview', () => {
      const onEu = buildStoreAlternates({
        ...onSe,
        origin: 'https://namez.shop',
        locale: 'de',
        primaryLocale: 'en',
        secondaryLocales: ['de', 'fr', 'ar'],
        markets: [se, eu],
        market: { preview: false },
        noindex: true,
      });
      expect(onEu.canonical).toBe('https://namez.shop/de/products/metal-card');
      expect(onEu.languages).toEqual({});
      // Without the verdict the same page advertises the full set.
      const indexable = buildStoreAlternates({ ...onSe, market: { preview: false }, noindex: false });
      expect(Object.keys(indexable.languages).length).toBeGreaterThan(1);
      // Legacy callers (no markets) are affected the same way, nothing else changes.
      const legacy = buildStoreAlternates({
        origin: 'https://shop.example.com',
        locale: 'ar',
        primaryLocale: 'en',
        secondaryLocales: ['ar'],
        path: '/x',
        noindex: true,
      });
      expect(legacy).toEqual({ canonical: 'https://shop.example.com/ar/x', languages: {} });
    });
  });
});

describe('storeHref', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('turns a platform-host URL into a relative path (path + query + hash)', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://iwings-digital.com');
    expect(storeHref('https://iwings-digital.com/products')).toBe('/products');
    expect(storeHref('https://www.iwings-digital.com/products?sort=new#top')).toBe('/products?sort=new#top');
    expect(storeHref('https://iwings-digital.com')).toBe('/');
    expect(storeHref('http://IWINGS-DIGITAL.com/cart')).toBe('/cart');
  });

  it('treats every <slug>.<platformHost> subdomain (and its www. form) as the platform', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://iwings-digital.com');
    expect(storeHref('https://naturalcotton.iwings-digital.com/cart')).toBe('/cart');
    expect(storeHref('https://www.naturalcotton.iwings-digital.com/cart')).toBe('/cart');
  });

  it('leaves external links, custom domains, mailto/tel and relative paths unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://iwings-digital.com');
    for (const raw of [
      'https://namez.se/products',
      'https://instagram.com/namez.se',
      'https://notiwings-digital.com/x',
      'mailto:hi@example.com',
      'tel:+4670',
      '/products',
      '#top',
      '',
      'not a url',
    ]) {
      expect(storeHref(raw)).toBe(raw);
    }
  });

  it('is a no-op when NEXT_PUBLIC_WEB_URL is unset or invalid', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', '');
    expect(storeHref('https://iwings-digital.com/products')).toBe('https://iwings-digital.com/products');
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'nonsense');
    expect(storeHref('https://iwings-digital.com/products')).toBe('https://iwings-digital.com/products');
  });

  it('ignores the www. prefix of the configured platform host too', () => {
    vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'https://www.iwings-digital.com');
    expect(storeHref('https://iwings-digital.com/products')).toBe('/products');
    expect(storeHref('https://shop.iwings-digital.com/products')).toBe('/products');
  });
});
