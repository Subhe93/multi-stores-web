import { describe, expect, it } from 'vitest';
import { buildStoreAlternates, type MarketUrlInput } from './storeUrl';
import { decideStoreRoute, MARKET_404_SEGMENT } from './market-routing';

// Kurmanji ('ku') while it is in review: served under /ku/, never advertised.

const origin = 'https://shop.example.com';

describe('buildStoreAlternates with a locale in review', () => {
  it('no markets: ku is left out of hreflang, the rest is unchanged', () => {
    const withKu = buildStoreAlternates({ origin, locale: 'sv', primaryLocale: 'sv', secondaryLocales: ['en', 'ku'], path: '/om-oss' });
    const without = buildStoreAlternates({ origin, locale: 'sv', primaryLocale: 'sv', secondaryLocales: ['en'], path: '/om-oss' });
    expect(withKu).toEqual(without);
    expect(withKu.languages).toEqual({
      sv: 'https://shop.example.com/om-oss',
      en: 'https://shop.example.com/en/om-oss',
      'x-default': 'https://shop.example.com/om-oss',
    });
  });

  it('a page rendered in ku: self canonical, no hreflang', () => {
    expect(
      buildStoreAlternates({ origin, locale: 'ku', primaryLocale: 'sv', secondaryLocales: ['en', 'ku'], path: '/om-oss' }),
    ).toEqual({ canonical: 'https://shop.example.com/ku/om-oss', languages: {} });
  });

  it('markets: ku is left out of every market set', () => {
    const se: MarketUrlInput = {
      key: 'se', is_default: true, countries: ['SE'], default_locale: 'sv', locales: ['en', 'ku'],
      primary_hostname: 'shop.example.com', status: 'LIVE',
    };
    const out = buildStoreAlternates({
      origin, locale: 'en', primaryLocale: 'sv', secondaryLocales: ['en', 'ku'], path: '/p', markets: [se], storeSlug: 'shop',
    });
    expect(Object.keys(out.languages).sort()).toEqual(['en-SE', 'sv-SE', 'x-default']);
    expect(out.canonical).toBe('https://shop.example.com/en/p');
  });
});

describe('decideStoreRoute with ku', () => {
  it('legacy: the /ku prefix is stripped like any storefront locale', () => {
    expect(decideStoreRoute({ storeSlug: 's', pathname: '/ku/cart', market: null })).toEqual({
      kind: 'rewrite', storePath: '/store/s/cart', urlLocale: 'ku', locale: 'ku', cookieLocale: 'ku',
    });
  });

  it('market serving ku: rewrite; market without it: 404', () => {
    expect(
      decideStoreRoute({ storeSlug: 's', pathname: '/ku/cart', market: { default_locale: 'sv', locales: ['ku'] } }),
    ).toMatchObject({ kind: 'rewrite', storePath: '/store/s/cart', urlLocale: 'ku', cookieLocale: 'ku' });
    expect(
      decideStoreRoute({ storeSlug: 's', pathname: '/ku/cart', market: { default_locale: 'sv', locales: ['en'] } }),
    ).toEqual({ kind: 'notfound', storePath: `/store/s/${MARKET_404_SEGMENT}`, status: 404 });
  });
});
