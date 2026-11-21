import { describe, expect, it } from 'vitest';
import { buildStoreAlternates, localizeStoreUrl, storeLocalePath, storeLocalePrefix } from './storeUrl';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from './localePaths.fixtures';
import type { MarketRoute } from './market';

// M156 §6: canonical + hreflang with language-country paths. One function,
// one input set, one alternate list: every URL of the set emits the same
// list (reciprocity), only the canonical changes.

const markets = [NAMEZ_SE, NAMEZ_EU];

function alternatesFor(origin: string, market: MarketRoute, locale: string, pathPrefix: string | undefined, list = markets) {
  return buildStoreAlternates({
    origin,
    locale,
    primaryLocale: market.default_locale,
    secondaryLocales: market.locales,
    path: '/products/x',
    markets: list,
    market,
    storeSlug: 'namez-se',
    pathPrefix,
  });
}

const EXPECTED_LANGUAGES: Record<string, string> = {
  'sv-SE': 'https://namez.se/products/x',
  'en-SE': 'https://namez.se/en/products/x',
  'ar-SE': 'https://namez.se/ar/products/x',
  en: 'https://namez.shop/products/x',
  'de-DE': 'https://namez.shop/de-de/products/x',
  de: 'https://namez.shop/de-de/products/x',
  'de-AT': 'https://namez.shop/de-at/products/x',
  'fr-FR': 'https://namez.shop/fr-fr/products/x',
  fr: 'https://namez.shop/fr-fr/products/x',
  'fr-BE': 'https://namez.shop/fr-be/products/x',
  ar: 'https://namez.shop/ar/products/x',
  'x-default': 'https://namez.shop/products/x',
};

describe('buildStoreAlternates with locale paths (§6.2)', () => {
  it('the exact <link> set of a Namez product page requested on /de-at/', () => {
    const out = alternatesFor('https://namez.shop', NAMEZ_EU, 'de', '/de-at');
    expect(out.canonical).toBe('https://namez.shop/de-at/products/x');
    expect(out.languages).toEqual(EXPECTED_LANGUAGES);
    expect(Object.keys(out.languages)).toEqual(Object.keys(EXPECTED_LANGUAGES));
  });

  it('all 11 URLs emit the same alternates; the canonical is each page itself', () => {
    const pages: [string, MarketRoute, string, string | undefined, string][] = [
      ['https://namez.se', NAMEZ_SE, 'sv', undefined, 'https://namez.se/products/x'],
      ['https://namez.se', NAMEZ_SE, 'en', undefined, 'https://namez.se/en/products/x'],
      ['https://namez.se', NAMEZ_SE, 'ar', undefined, 'https://namez.se/ar/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'en', '', 'https://namez.shop/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'de', '/de-de', 'https://namez.shop/de-de/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'de', '/de-at', 'https://namez.shop/de-at/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'fr', '/fr-fr', 'https://namez.shop/fr-fr/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'fr', '/fr-be', 'https://namez.shop/fr-be/products/x'],
      ['https://namez.shop', NAMEZ_EU, 'ar', '/ar', 'https://namez.shop/ar/products/x'],
    ];
    const canonicals = new Set<string>();
    for (const [origin, market, locale, prefix, canonical] of pages) {
      const out = alternatesFor(origin, market, locale, prefix);
      expect(out.canonical).toBe(canonical);
      expect(out.languages).toEqual(EXPECTED_LANGUAGES);
      canonicals.add(out.canonical);
    }
    // Every canonical is one of the advertised URLs (no orphan canonical).
    for (const c of canonicals) expect(Object.values(EXPECTED_LANGUAGES)).toContain(c);
    // 9 distinct pages + the 2 hreflang-only duplicates (de, fr) = 11 URLs.
    expect(canonicals.size).toBe(9);
  });

  it('translated slugs: de-DE, de and de-AT all use the de slug', () => {
    const out = buildStoreAlternates({
      origin: 'https://namez.shop',
      locale: 'de',
      primaryLocale: 'en',
      secondaryLocales: NAMEZ_EU.locales,
      path: '/products/x',
      pathByLocale: { de: '/products/x-de', sv: '/products/x-sv' },
      markets,
      market: NAMEZ_EU,
      storeSlug: 'namez-se',
      pathPrefix: '/de-at',
    });
    expect(out.canonical).toBe('https://namez.shop/de-at/products/x-de');
    expect(out.languages['de-DE']).toBe('https://namez.shop/de-de/products/x-de');
    expect(out.languages.de).toBe('https://namez.shop/de-de/products/x-de');
    expect(out.languages['de-AT']).toBe('https://namez.shop/de-at/products/x-de');
    expect(out.languages['sv-SE']).toBe('https://namez.se/products/x-sv');
  });

  it('x-default falls back to namez.se when eu is not the x-default market', () => {
    const eu = { ...NAMEZ_EU, is_x_default: undefined };
    const out = alternatesFor('https://namez.shop', eu, 'de', '/de-at', [NAMEZ_SE, eu]);
    expect(out.languages['x-default']).toBe('https://namez.se/products/x');
  });

  it('dropping ar from eu.locales drops the ar entry; no nl entry ever appears', () => {
    const eu = { ...NAMEZ_EU, locales: ['de', 'fr'] };
    const out = alternatesFor('https://namez.shop', eu, 'de', '/de-de', [NAMEZ_SE, eu]);
    expect(out.languages.ar).toBeUndefined();
    expect(Object.keys(out.languages).some((k) => k.startsWith('nl'))).toBe(false);
  });

  it('a prefix that does not belong to the locale falls back to the locale\'s primary path', () => {
    expect(alternatesFor('https://namez.shop', NAMEZ_EU, 'de', '/fr-be').canonical).toBe('https://namez.shop/de-de/products/x');
    expect(alternatesFor('https://namez.shop', NAMEZ_EU, 'en', '/de-at').canonical).toBe('https://namez.shop/products/x');
  });

  it('noindex / preview: self canonical under the request prefix, no hreflang', () => {
    const out = buildStoreAlternates({
      origin: 'https://namez.shop', locale: 'de', primaryLocale: 'en', secondaryLocales: NAMEZ_EU.locales,
      path: '/products/x', markets, market: NAMEZ_EU, noindex: true, pathPrefix: '/de-at',
    });
    expect(out).toEqual({ canonical: 'https://namez.shop/de-at/products/x', languages: {} });
  });
});

describe('regression: markets without locale paths', () => {
  it('output is byte-identical to the pre-M156 fixture', () => {
    const list = [NAMEZ_SE, NAMEZ_EU_LEGACY];
    const fromEu = alternatesFor('https://namez.shop', NAMEZ_EU_LEGACY, 'de', undefined, list);
    const expected = {
      canonical: 'https://namez.shop/de/products/x',
      languages: {
        'sv-SE': 'https://namez.se/products/x',
        'en-SE': 'https://namez.se/en/products/x',
        'ar-SE': 'https://namez.se/ar/products/x',
        en: 'https://namez.shop/products/x',
        de: 'https://namez.shop/de/products/x',
        fr: 'https://namez.shop/fr/products/x',
        ar: 'https://namez.shop/ar/products/x',
        'x-default': 'https://namez.shop/products/x',
      },
    };
    expect(JSON.stringify(fromEu)).toBe(JSON.stringify(expected));
    // `market` / `pathPrefix` absent: identical as well.
    const plain = buildStoreAlternates({
      origin: 'https://namez.shop', locale: 'de', primaryLocale: 'en', secondaryLocales: NAMEZ_EU_LEGACY.locales,
      path: '/products/x', markets: list, storeSlug: 'namez-se',
    });
    expect(JSON.stringify(plain)).toBe(JSON.stringify(expected));
  });

  it('stores without markets keep the single-origin output', () => {
    expect(buildStoreAlternates({ origin: 'https://s.example', locale: 'ar', primaryLocale: 'en', secondaryLocales: ['ar'], path: '/x' })).toEqual({
      canonical: 'https://s.example/ar/x',
      languages: { en: 'https://s.example/x', ar: 'https://s.example/ar/x', 'x-default': 'https://s.example/x' },
    });
  });
});

describe('URL helpers with a request prefix', () => {
  it('storeLocalePath: the 5th argument overrides the derived prefix', () => {
    expect(storeLocalePath('https://namez.shop', 'de', 'en', '/products/ä')).toBe('https://namez.shop/de/products/%c3%a4');
    expect(storeLocalePath('https://namez.shop', 'de', 'en', '/products/ä', '/de-at')).toBe('https://namez.shop/de-at/products/%c3%a4');
    expect(storeLocalePath('https://namez.shop', 'en', 'en', '', '')).toBe('https://namez.shop');
  });

  it('storeLocalePrefix takes the scope', () => {
    expect(storeLocalePrefix({ locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' })).toBe('/de-at');
    expect(storeLocalePrefix({ locale: 'de', primaryLocale: 'en' })).toBe('/de');
  });

  it('localizeStoreUrl never prefixes an already localized /de-at link twice', () => {
    expect(localizeStoreUrl('/products', '/de-at', 'de')).toBe('/de-at/products');
    expect(localizeStoreUrl('/de-at/products', '/de-at', 'de')).toBe('/de-at/products');
    expect(localizeStoreUrl('/', '/de-at', 'de')).toBe('/de-at');
    expect(localizeStoreUrl('/de/products', '/de-at', 'de')).toBe('/de/products');
    expect(localizeStoreUrl('/de-atx', '/de-at', 'de')).toBe('/de-at/de-atx');
    // Legacy prefix: unchanged behaviour.
    expect(localizeStoreUrl('/ar/x', '/ar', 'ar')).toBe('/ar/x');
    expect(localizeStoreUrl('/x', '/ar', 'ar')).toBe('/ar/x');
  });
});
