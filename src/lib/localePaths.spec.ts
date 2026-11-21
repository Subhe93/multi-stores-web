import { describe, expect, it } from 'vitest';
import {
  activeLocalePaths,
  isRemappedLocale,
  legacyRedirectAlias,
  linkPrefix,
  localePathPrefix,
  localePathSwitchTarget,
  localeKeepsCountry,
  switchableLocales,
  marketHreflangCode,
  marketUrlSlots,
  matchLocalePath,
  pageLinkPrefix,
  primaryLocalePath,
  rebaseAliasTarget,
  remapLegacyLocaleTarget,
  stripStorePrefix,
  usesLocalePaths,
} from './localePaths';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from './localePaths.fixtures';
import type { MarketLocalePath } from './market';

// M156 §4.1: the pure locale-path module.

const eu = NAMEZ_EU;

describe('activeLocalePaths (activity rule §3.3)', () => {
  it('keeps the active Namez rows in stored order and drops the nl rows (nl is not a storefront locale)', () => {
    expect(activeLocalePaths(eu).map((r) => r.path)).toEqual(['de-de', 'de-at', 'fr-fr', 'fr-be', 'ar']);
    expect(usesLocalePaths(eu)).toBe(true);
  });

  it('a market without rows, with [] or with only inactive rows does not use locale paths', () => {
    expect(usesLocalePaths(NAMEZ_EU_LEGACY)).toBe(false);
    expect(usesLocalePaths({ ...NAMEZ_EU_LEGACY, locale_paths: [] })).toBe(false);
    expect(usesLocalePaths({ ...NAMEZ_EU_LEGACY, locale_paths: eu.locale_paths!.filter((r) => r.locale === 'nl') })).toBe(false);
    expect(usesLocalePaths(null)).toBe(false);
    expect(usesLocalePaths(NAMEZ_SE)).toBe(false);
  });

  it('a locale the market does not serve, or a country it no longer has, makes the row inactive', () => {
    const noAr = { ...eu, locales: ['de', 'fr'] };
    expect(activeLocalePaths(noAr).map((r) => r.path)).toEqual(['de-de', 'de-at', 'fr-fr', 'fr-be']);
    const noAt = { ...eu, countries: eu.countries.filter((c) => c !== 'AT') };
    expect(activeLocalePaths(noAt).map((r) => r.path)).not.toContain('de-at');
  });

  it('drops malformed rows defensively (path mismatch, default locale, duplicates, foreign hreflang)', () => {
    const rows = [
      { path: 'de-at', locale: 'de', country: 'DE', hreflang: ['de-DE'] }, // path does not match its row
      { path: 'en', locale: 'en', country: null, hreflang: ['en'] }, // default locale
      { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'fr', 'de-AT', 'de'] },
      { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE'] }, // duplicate path
      { path: 'DE-AT', locale: 'de', country: 'AT', hreflang: ['de-AT'] }, // upper-case path
      { path: 'de-at', locale: 'de', country: 'at', hreflang: ['DE-at', 'de'] }, // case normalised; `de` already used
      null,
      'x',
    ] as unknown as MarketLocalePath[];
    const m = { ...eu, locale_paths: rows };
    expect(activeLocalePaths(m)).toEqual([
      { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'de'] },
      { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
    ]);
  });
});

describe('primary path, remapped locales', () => {
  it('language-only row, else the row with the plain code, else the first row', () => {
    expect(primaryLocalePath(eu, 'de')?.path).toBe('de-de');
    expect(primaryLocalePath(eu, 'fr')?.path).toBe('fr-fr');
    expect(primaryLocalePath(eu, 'ar')?.path).toBe('ar');
    expect(primaryLocalePath(eu, 'nl')).toBeNull();
    const noPlain = { ...eu, locale_paths: [
      { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
      { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE'] },
    ] };
    expect(primaryLocalePath(noPlain, 'de')?.path).toBe('de-at');
    const withLangOnly = { ...eu, locale_paths: [
      { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
      { path: 'de', locale: 'de', country: null, hreflang: ['de'] },
    ] };
    expect(primaryLocalePath(withLangOnly, 'de')?.path).toBe('de');
  });

  it('de and fr are remapped; ar (language-only row) and en are not', () => {
    expect(isRemappedLocale(eu, 'de')).toBe(true);
    expect(isRemappedLocale(eu, 'fr')).toBe(true);
    expect(isRemappedLocale(eu, 'ar')).toBe(false);
    expect(isRemappedLocale(eu, 'en')).toBe(false);
  });
});

describe('matchLocalePath', () => {
  it('matches the first segment of an active path, exact lower case', () => {
    expect(matchLocalePath(eu, '/de-at/products/x')).toEqual({ entry: eu.locale_paths![1], rest: '/products/x' });
    expect(matchLocalePath(eu, '/de-at')?.rest).toBe('/');
    expect(matchLocalePath(eu, '/de-at/')?.rest).toBe('/');
    expect(matchLocalePath(eu, '/ar/x')?.entry.path).toBe('ar');
    expect(matchLocalePath(eu, '/DE-AT/x')).toBeNull();
    expect(matchLocalePath(eu, '/nl-be/x')).toBeNull();
    expect(matchLocalePath(eu, '/de-atx')).toBeNull();
    expect(matchLocalePath(eu, '/de/x')).toBeNull();
    expect(matchLocalePath(NAMEZ_EU_LEGACY, '/de-at/x')).toBeNull();
  });
});

describe('marketUrlSlots', () => {
  it('legacy market: root + bare folders with marketHreflangCode (today\'s set)', () => {
    expect(marketUrlSlots(NAMEZ_SE)).toEqual([
      { prefix: '', locale: 'sv', country: null, hreflang: ['sv-SE'] },
      { prefix: '/en', locale: 'en', country: null, hreflang: ['en-SE'] },
      { prefix: '/ar', locale: 'ar', country: null, hreflang: ['ar-SE'] },
    ]);
    expect(marketUrlSlots(NAMEZ_EU_LEGACY).map((s) => [s.prefix, s.hreflang])).toEqual([
      ['', ['en']], ['/de', ['de']], ['/fr', ['fr']], ['/ar', ['ar']],
    ]);
  });

  it('locale-path market: root, active rows in stored order, bare folders for served locales without rows', () => {
    expect(marketUrlSlots(eu)).toEqual([
      { prefix: '', locale: 'en', country: null, hreflang: ['en'] },
      { prefix: '/de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'de'] },
      { prefix: '/de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
      { prefix: '/fr-fr', locale: 'fr', country: 'FR', hreflang: ['fr-FR', 'fr'] },
      { prefix: '/fr-be', locale: 'fr', country: 'BE', hreflang: ['fr-BE'] },
      { prefix: '/ar', locale: 'ar', country: null, hreflang: ['ar'] },
    ]);
    const noArRow = { ...eu, locale_paths: eu.locale_paths!.filter((r) => r.locale !== 'ar') };
    expect(marketUrlSlots(noArRow).at(-1)).toEqual({ prefix: '/ar', locale: 'ar', country: null, hreflang: ['ar'] });
  });

  it('marketHreflangCode keeps its formula', () => {
    expect(marketHreflangCode({ countries: ['SE'] }, 'sv')).toBe('sv-SE');
    expect(marketHreflangCode({ countries: ['DE', 'AT'] }, 'de')).toBe('de');
  });
});

describe('localePathPrefix matrix', () => {
  it.each([
    ['en', 'DE', ''],
    ['en', null, ''],
    ['de', 'DE', '/de-de'],
    ['de', 'AT', '/de-at'],
    ['de', 'FI', '/de-de'], // no row for FI: primary path
    ['de', null, '/de-de'],
    ['fr', 'BE', '/fr-be'],
    ['fr', 'FR', '/fr-fr'],
    ['fr', 'DE', '/fr-fr'],
    ['ar', 'AT', '/ar'], // language-only row for every country
    ['ar', null, '/ar'],
  ])('%s + %s -> %j', (locale, country, expected) => {
    expect(localePathPrefix(eu, locale, country)).toBe(expected);
  });

  it('a served locale without rows keeps its bare folder; legacy markets keep /<locale>', () => {
    const noArRow = { ...eu, locale_paths: eu.locale_paths!.filter((r) => r.locale !== 'ar') };
    expect(localePathPrefix(noArRow, 'ar', 'DE')).toBe('/ar');
    expect(localePathPrefix(NAMEZ_EU_LEGACY, 'de', 'AT')).toBe('/de');
  });
});

describe('stripStorePrefix', () => {
  it('strips an active path, else a bare locale folder, else nothing', () => {
    const all = ['en', 'de', 'fr', 'ar'];
    expect(stripStorePrefix('/de-at/products/x', eu, all)).toEqual({ prefix: '/de-at', rest: '/products/x' });
    expect(stripStorePrefix('/de-at', eu, all)).toEqual({ prefix: '/de-at', rest: '/' });
    expect(stripStorePrefix('/ar/cart', eu, all)).toEqual({ prefix: '/ar', rest: '/cart' });
    expect(stripStorePrefix('/de/x', eu, all)).toEqual({ prefix: '/de', rest: '/x' });
    expect(stripStorePrefix('/products/x', eu, all)).toEqual({ prefix: '', rest: '/products/x' });
    expect(stripStorePrefix('/de-at/x', null, all)).toEqual({ prefix: '', rest: '/de-at/x' });
  });
});

describe('redirect helpers', () => {
  it('remapLegacyLocaleTarget: /de/… -> /de-de/…, query and hash kept, others unchanged', () => {
    expect(remapLegacyLocaleTarget('/de/products/y', eu)).toBe('/de-de/products/y');
    expect(remapLegacyLocaleTarget('/de', eu)).toBe('/de-de');
    expect(remapLegacyLocaleTarget('/de?x=1#top', eu)).toBe('/de-de?x=1#top');
    expect(remapLegacyLocaleTarget('/fr/a/b?c=d', eu)).toBe('/fr-fr/a/b?c=d');
    expect(remapLegacyLocaleTarget('/ar/x', eu)).toBe('/ar/x');
    expect(remapLegacyLocaleTarget('/products/x', eu)).toBe('/products/x');
    expect(remapLegacyLocaleTarget('/deals', eu)).toBe('/deals');
    expect(remapLegacyLocaleTarget('/de/x', NAMEZ_EU_LEGACY)).toBe('/de/x');
  });

  it('legacyRedirectAlias: /de-at/x -> /de/x; null for the root, /ar and legacy markets', () => {
    expect(legacyRedirectAlias('/de-at/produkt/x', eu)).toEqual({ alias: '/de/produkt/x', entry: eu.locale_paths![1] });
    expect(legacyRedirectAlias('/de-at', eu)?.alias).toBe('/de');
    expect(legacyRedirectAlias('/ar/x', eu)).toBeNull();
    expect(legacyRedirectAlias('/produkt/x', eu)).toBeNull();
    expect(legacyRedirectAlias('/de-at/x', NAMEZ_EU_LEGACY)).toBeNull();
  });

  it('rebaseAliasTarget keeps the visited prefix for a target in the same locale', () => {
    const at = eu.locale_paths![1]!;
    expect(rebaseAliasTarget('/de/products/y', at, eu)).toBe('/de-at/products/y');
    expect(rebaseAliasTarget('/de?x=1', at, eu)).toBe('/de-at?x=1');
    expect(rebaseAliasTarget('/products/y', at, eu)).toBe('/products/y');
    expect(rebaseAliasTarget('/fr/y', at, eu)).toBe('/fr-fr/y');
    expect(rebaseAliasTarget('/deals', at, eu)).toBe('/deals');
  });
});

describe('link prefixes', () => {
  it('linkPrefix: the request prefix when given, else the legacy formula', () => {
    expect(linkPrefix({ locale: 'de', primaryLocale: 'en' })).toBe('/de');
    expect(linkPrefix({ locale: 'en', primaryLocale: 'en' })).toBe('');
    expect(linkPrefix({ locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' })).toBe('/de-at');
    expect(linkPrefix({ locale: 'en', primaryLocale: 'en', pathPrefix: '' })).toBe('');
  });

  it('pageLinkPrefix keeps the pages\' `lang ? /lang : \'\'` without a request prefix', () => {
    expect(pageLinkPrefix(undefined, 'ar')).toBe('/ar');
    expect(pageLinkPrefix(undefined, undefined)).toBe('');
    expect(pageLinkPrefix('/de-at', 'de')).toBe('/de-at');
    expect(pageLinkPrefix('', null)).toBe('');
  });

  it('localePathSwitchTarget maps a language to the path of the country; null for legacy markets', () => {
    const all = ['en', 'de', 'fr', 'ar'];
    expect(localePathSwitchTarget(eu, '/de-at/products/x', 'en', 'AT', all)).toBe('/products/x');
    expect(localePathSwitchTarget(eu, '/products/x', 'de', 'AT', all)).toBe('/de-at/products/x');
    expect(localePathSwitchTarget(eu, '/de-at', 'ar', 'AT', all)).toBe('/ar');
    expect(localePathSwitchTarget(eu, '/', 'fr', 'BE', all)).toBe('/fr-be');
    expect(localePathSwitchTarget(NAMEZ_EU_LEGACY, '/de/x', 'fr', null, all)).toBeNull();
  });

  it('switchableLocales hides a language that would change the chosen country', () => {
    const all = ['en', 'de', 'fr', 'ar'];
    // FI has no de/fr row: /de-de would rewrite ms-region to DE.
    expect(localeKeepsCountry(eu, 'de', 'FI')).toBe(false);
    expect(switchableLocales(eu, all, 'FI', 'en')).toEqual(['en', 'ar']);
    expect(switchableLocales(eu, all, 'AT', 'de')).toEqual(['en', 'de', 'ar']);
    expect(switchableLocales(eu, all, 'BE', 'fr')).toEqual(['en', 'fr', 'ar']);
    // No country chosen, or one the market does not sell to: every language.
    expect(switchableLocales(eu, all, null, 'en')).toEqual(all);
    expect(switchableLocales(eu, all, 'SE', 'en')).toEqual(all);
    // The current language always stays listed.
    expect(switchableLocales(eu, all, 'FI', 'de')).toEqual(['en', 'de', 'ar']);
    // Markets without locale paths: unchanged.
    expect(switchableLocales(NAMEZ_EU_LEGACY, all, 'FI', 'en')).toEqual(all);
  });
});
