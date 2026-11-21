import { describe, expect, it } from 'vitest';
import { decideStoreRoute } from './market-routing';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from './localePaths.fixtures';

// M156 §4.2 / §4.3: locale decisions of a market with language-country paths
// (namez.shop configured as §2.3, nl not enabled), plus the regression rule:
// markets without active rows decide exactly as before (no pathPrefix).

const slug = 'namez-se';
const route = (pathname: string, market = NAMEZ_EU as typeof NAMEZ_EU | null, search = '') =>
  decideStoreRoute({ storeSlug: slug, pathname, search, market });

describe('decideStoreRoute: locale-path market (§4.3)', () => {
  it('/ and unprefixed pages: default locale, root prefix, no country', () => {
    expect(route('/')).toEqual({
      kind: 'rewrite', storePath: '/store/namez-se', urlLocale: null, locale: 'en', cookieLocale: 'en',
      pathPrefix: '', pathCountry: null,
    });
    expect(route('/products/x')).toMatchObject({ storePath: '/store/namez-se/products/x', locale: 'en', pathPrefix: '' });
  });

  it('country paths serve their locale with their country', () => {
    expect(route('/de-de/products/x')).toEqual({
      kind: 'rewrite', storePath: '/store/namez-se/products/x', urlLocale: 'de', locale: 'de', cookieLocale: 'de',
      pathPrefix: '/de-de', pathCountry: 'DE',
    });
    expect(route('/de-at/products/x')).toMatchObject({ locale: 'de', pathPrefix: '/de-at', pathCountry: 'AT' });
    expect(route('/fr-fr/collections/a')).toMatchObject({ locale: 'fr', pathPrefix: '/fr-fr', pathCountry: 'FR' });
    expect(route('/fr-be')).toMatchObject({ storePath: '/store/namez-se/', locale: 'fr', pathPrefix: '/fr-be', pathCountry: 'BE' });
  });

  it('the language-only /ar path: locale ar, no country', () => {
    expect(route('/ar/products/x')).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez-se/products/x', urlLocale: 'ar', locale: 'ar', pathPrefix: '/ar', pathCountry: null,
    });
  });

  it('inactive nl paths and unknown xx-yy segments are 404', () => {
    for (const p of ['/nl-nl/x', '/nl-be', '/xx-be/products', '/de-ch/x']) {
      expect(route(p)).toEqual({ kind: 'notfound', storePath: '/store/namez-se/market-not-found', status: 404 });
    }
  });

  it('other xx-yy slugs (no storefront language, no market country) stay root pages', () => {
    for (const p of ['/om-os', '/my-id', '/qa-qs/x']) {
      expect(route(p)).toMatchObject({ kind: 'rewrite', storePath: `/store/namez-se${p}`, urlLocale: null, locale: 'en', pathPrefix: '', pathCountry: null });
    }
  });

  it('old bare folders of remapped locales 301 to the primary path in one hop (query kept)', () => {
    expect(route('/de/products/x', NAMEZ_EU, '?utm=1')).toEqual({ kind: 'redirect', location: '/de-de/products/x?utm=1', status: 301 });
    expect(route('/de')).toEqual({ kind: 'redirect', location: '/de-de', status: 301 });
    expect(route('/fr/collections/a')).toEqual({ kind: 'redirect', location: '/fr-fr/collections/a', status: 301 });
  });

  it('/en/… still 301s to the unprefixed URL; global locales not served are 404', () => {
    expect(route('/en/x', NAMEZ_EU, '?a=1')).toEqual({ kind: 'redirect', location: '/x?a=1', status: 301 });
    expect(route('/en')).toEqual({ kind: 'redirect', location: '/', status: 301 });
    expect(route('/sv/x').kind).toBe('notfound');
    expect(route('/tr/x').kind).toBe('notfound');
  });

  it('upper case paths and non-locale segments fall through to the page lookup', () => {
    expect(route('/DE-AT/x')).toMatchObject({ kind: 'rewrite', storePath: '/store/namez-se/DE-AT/x', locale: 'en', pathPrefix: '' });
    expect(route('/nl/x')).toMatchObject({ kind: 'rewrite', storePath: '/store/namez-se/nl/x', locale: 'en' });
    expect(route('/deals')).toMatchObject({ kind: 'rewrite', storePath: '/store/namez-se/deals' });
  });

  it('a served locale without any row keeps its bare folder', () => {
    const noArRow = { ...NAMEZ_EU, locale_paths: NAMEZ_EU.locale_paths!.filter((r) => r.locale !== 'ar') };
    expect(route('/ar/x', noArRow)).toMatchObject({ kind: 'rewrite', locale: 'ar', pathPrefix: '/ar', pathCountry: null });
  });
});

describe('decideStoreRoute: regression for markets without active locale paths', () => {
  const cases = ['/', '/products/x', '/de/products/x', '/de', '/fr/a', '/ar/x', '/en/x', '/sv', '/de-at/x', '/nl-be'];

  it('locale_paths absent, [] or only inactive rows -> the same decisions as before, without pathPrefix', () => {
    const empty = { ...NAMEZ_EU_LEGACY, locale_paths: [] };
    const inactive = { ...NAMEZ_EU_LEGACY, locale_paths: NAMEZ_EU.locale_paths!.filter((r) => r.locale === 'nl') };
    // The pre-M156 market shape: only default_locale + locales.
    const bare = { default_locale: 'en', locales: ['de', 'fr', 'ar'] };
    for (const p of cases) {
      const before = route(p, bare as typeof NAMEZ_EU);
      expect(route(p, NAMEZ_EU_LEGACY)).toEqual(before);
      expect(route(p, empty)).toEqual(before);
      expect(route(p, inactive)).toEqual(before);
      expect(before).not.toHaveProperty('pathPrefix');
      expect(before).not.toHaveProperty('pathCountry');
    }
    // Spot checks of today's behaviour.
    expect(route('/de/products/x', NAMEZ_EU_LEGACY)).toMatchObject({ kind: 'rewrite', locale: 'de', storePath: '/store/namez-se/products/x' });
    expect(route('/de-at/x', NAMEZ_EU_LEGACY)).toMatchObject({ kind: 'rewrite', storePath: '/store/namez-se/de-at/x', locale: 'en' });
  });

  it('namez.se (default market) is unchanged', () => {
    expect(route('/en/products/x', NAMEZ_SE)).toEqual({
      kind: 'rewrite', storePath: '/store/namez-se/products/x', urlLocale: 'en', locale: 'en', cookieLocale: 'en',
    });
    expect(route('/de/x', NAMEZ_SE).kind).toBe('notfound');
  });

  it('legacy stores (no market) are unchanged', () => {
    expect(route('/de-at/x', null)).toEqual({
      kind: 'rewrite', storePath: '/store/namez-se/de-at/x', urlLocale: null, locale: '', cookieLocale: '',
    });
  });
});
