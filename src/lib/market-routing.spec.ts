import { describe, expect, it } from 'vitest';
import {
  MARKET_404_SEGMENT,
  decideStoreRoute,
  detectVisitorCountry,
  isBotUserAgent,
  marketHreflangCode,
  pickSuggestedMarket,
} from './market-routing';

// Locale decision extracted from proxy.ts (M1-DESIGN §8 / L13). The manual
// matrix of §7 WP-C.5: namez.se, namez.se/en, namez.se/sv → 301,
// namez.se/de → 404, plus the legacy branch for stores without a market.

const seMarket = { key: 'se', default_locale: 'sv', locales: ['en', 'ar'], countries: ['SE'] };
const euMarket = { key: 'eu', default_locale: 'en', locales: ['de', 'fr', 'ar'], countries: ['DE', 'FR', 'AT'] };

describe('decideStoreRoute without a market (legacy)', () => {
  it('matches the global locale list and writes an empty cookie', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/', market: null })).toEqual({
      kind: 'rewrite', storePath: '/store/namez', urlLocale: null, locale: '', cookieLocale: '',
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/products/foo', market: null })).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez/products/foo', urlLocale: null, cookieLocale: '',
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/ar/products/foo', market: null })).toEqual({
      kind: 'rewrite', storePath: '/store/namez/products/foo', urlLocale: 'ar', locale: 'ar', cookieLocale: 'ar',
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/de', market: null })).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez/', urlLocale: 'de',
    });
  });

  it('never redirects a prefix equal to the (unknown) primary locale', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/en/products', market: null }).kind).toBe('rewrite');
  });
});

describe('decideStoreRoute with a market', () => {
  it('serves the unprefixed URL in the market default locale (cookie = default)', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/', market: seMarket })).toEqual({
      kind: 'rewrite', storePath: '/store/namez', urlLocale: null, locale: 'sv', cookieLocale: 'sv',
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/products/foo', market: seMarket })).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez/products/foo', locale: 'sv', cookieLocale: 'sv',
    });
  });

  it('serves a secondary locale of the market with its prefix', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/en/products/foo', market: seMarket })).toEqual({
      kind: 'rewrite', storePath: '/store/namez/products/foo', urlLocale: 'en', locale: 'en', cookieLocale: 'en',
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/ar', market: seMarket })).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez/', urlLocale: 'ar',
    });
  });

  it('301s a prefix equal to the market default locale, keeping the query', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/sv/products/foo', search: '?sort=newest', market: seMarket })).toEqual({
      kind: 'redirect', location: '/products/foo?sort=newest', status: 301,
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/sv', market: seMarket })).toEqual({
      kind: 'redirect', location: '/', status: 301,
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/en', market: euMarket })).toEqual({
      kind: 'redirect', location: '/', status: 301,
    });
  });

  it('404s a global locale the market does not serve', () => {
    expect(MARKET_404_SEGMENT).toBe('market-not-found');
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/de/products/foo', market: seMarket })).toEqual({
      kind: 'notfound', storePath: '/store/namez/market-not-found', status: 404,
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/tr', market: euMarket }).kind).toBe('notfound');
  });

  it('does not treat non-locale segments as prefixes', () => {
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/deals', market: seMarket })).toMatchObject({
      kind: 'rewrite', storePath: '/store/namez/deals', urlLocale: null,
    });
    expect(decideStoreRoute({ storeSlug: 'namez', pathname: '/svenska', market: seMarket }).kind).toBe('rewrite');
  });
});

describe('marketHreflangCode', () => {
  it('appends the country only for single-country markets', () => {
    expect(marketHreflangCode(seMarket, 'sv')).toBe('sv-SE');
    expect(marketHreflangCode({ countries: ['de'] }, 'de')).toBe('de-DE');
    expect(marketHreflangCode(euMarket, 'de')).toBe('de');
    expect(marketHreflangCode({ countries: [] }, 'en')).toBe('en');
  });
});

describe('visitor country + suggestion', () => {
  it('prefers the CDN header and falls back to the Accept-Language region', () => {
    expect(detectVisitorCountry({ cfCountry: 'se', acceptLanguage: 'de-DE' })).toBe('SE');
    expect(detectVisitorCountry({ cfCountry: 'XX', acceptLanguage: 'de,de-AT;q=0.8' })).toBe('AT');
    expect(detectVisitorCountry({ vercelCountry: 'FR' })).toBe('FR');
    expect(detectVisitorCountry({ acceptLanguage: 'en' })).toBeNull();
    expect(detectVisitorCountry({})).toBeNull();
  });

  it('suggests the market covering the country, never the current one', () => {
    const markets = [seMarket, euMarket];
    expect(pickSuggestedMarket('DE', seMarket, markets)).toBe('eu');
    expect(pickSuggestedMarket('SE', seMarket, markets)).toBeNull();
    expect(pickSuggestedMarket('US', seMarket, markets)).toBeNull();
    expect(pickSuggestedMarket(null, seMarket, markets)).toBeNull();
    expect(pickSuggestedMarket('SE', euMarket, markets)).toBe('se');
  });

  it('recognises crawler user agents', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBotUserAgent('Chrome-Lighthouse')).toBe(true);
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/130')).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
  });
});
