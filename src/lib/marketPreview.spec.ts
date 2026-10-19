import { describe, expect, it } from 'vitest';
import { isMarketPreview, marketBody, marketKeyOf, marketQuery, requestMarketRef } from './market';
import { buildStoreAlternates, buildStoreOrigin, previewOrigin, type MarketUrlInput } from './storeUrl';

// Market preview (`<slug>--<key>.<platform host>`): the one helper that turns
// the request market into `?market=…&preview=1` / `{ market_key, preview }`,
// and the URL rules of a preview page (self/real-host canonical, no hreflang).

describe('marketQuery / marketBody', () => {
  it('is empty without a market (URLs of other stores stay byte-identical)', () => {
    expect(marketQuery(undefined, false)).toBe('');
    expect(marketQuery(null, true)).toBe('');
    expect(marketQuery({ key: '' }, false)).toBe('');
    expect(marketBody(undefined)).toEqual({});
    expect(marketKeyOf(undefined)).toBeUndefined();
  });

  it('a bare key or { key } yields exactly the previous query / body', () => {
    expect(marketQuery('eu', false)).toBe('?market=eu');
    expect(marketQuery('eu', true)).toBe('&market=eu');
    expect(marketQuery({ key: 'eu' }, false)).toBe('?market=eu');
    expect(marketQuery({ key: 'eu', preview: false }, false)).toBe('?market=eu');
    expect(marketBody('eu')).toEqual({ market_key: 'eu' });
    expect(marketBody({ key: 'eu' })).toEqual({ market_key: 'eu' });
    expect(isMarketPreview('eu')).toBe(false);
  });

  it('adds preview=1 / preview: true only for a preview ref', () => {
    expect(marketQuery({ key: 'eu', preview: true }, false)).toBe('?market=eu&preview=1');
    expect(marketQuery({ key: 'eu', preview: true }, true)).toBe('&market=eu&preview=1');
    expect(marketBody({ key: 'eu', preview: true })).toEqual({ market_key: 'eu', preview: true });
    expect(isMarketPreview({ key: 'eu', preview: true })).toBe(true);
    expect(marketKeyOf({ key: 'eu', preview: true })).toBe('eu');
  });

  it('requestMarketRef reads the proxy header pair', () => {
    expect(requestMarketRef(new Headers())).toBeUndefined();
    expect(requestMarketRef(new Headers({ 'x-market': 'eu' }))).toEqual({ key: 'eu' });
    expect(requestMarketRef(new Headers({ 'x-market': 'eu', 'x-market-preview': '1' }))).toEqual({ key: 'eu', preview: true });
    expect(requestMarketRef(new Headers({ 'x-market': 'eu', 'x-market-preview': '0' }))).toEqual({ key: 'eu' });
  });
});

const se: MarketUrlInput = {
  key: 'se',
  is_default: true,
  countries: ['SE'],
  default_locale: 'sv',
  locales: ['en'],
  primary_hostname: 'namez.se',
};

describe('preview URLs', () => {
  it('previewOrigin is one label under the platform host', () => {
    expect(previewOrigin('namez-se', 'eu')).toMatch(/^https?:\/\/namez-se--eu\./);
    const platform = buildStoreOrigin('namez-se', null);
    expect(previewOrigin('namez-se', 'eu')).toBe(platform.replace('namez-se.', 'namez-se--eu.'));
  });

  it('buildStoreOrigin: the real primary host when configured, else the preview host, never the default market host', () => {
    expect(buildStoreOrigin('namez-se', 'namez.se', { key: 'eu', preview: true, primary_hostname: 'namez.shop' })).toBe('https://namez.shop');
    expect(buildStoreOrigin('namez-se', 'namez.se', { key: 'eu', preview: true, primary_hostname: null })).toBe(previewOrigin('namez-se', 'eu'));
    // A LIVE market without a host keeps the legacy priority.
    expect(buildStoreOrigin('namez-se', 'namez.se', { key: 'eu', primary_hostname: null })).toBe('https://namez.se');
  });

  it('buildStoreAlternates on a preview: self canonical in the page locale, no hreflang', () => {
    const alt = buildStoreAlternates({
      origin: 'https://namez.shop',
      locale: 'sv',
      primaryLocale: 'en',
      secondaryLocales: ['sv'],
      path: '/products/mug',
      markets: [se],
      storeSlug: 'namez-se',
      pathByLocale: { sv: '/products/mugg' },
      market: { preview: true },
    });
    expect(alt).toEqual({ canonical: 'https://namez.shop/sv/products/mugg', languages: {} });
  });

  it('buildStoreAlternates: a LIVE market (or none) is unaffected by the option', () => {
    const base = {
      origin: 'https://namez.se',
      locale: 'en',
      primaryLocale: 'sv',
      secondaryLocales: ['en'],
      path: '/about',
      markets: [se],
      storeSlug: 'namez-se',
    };
    expect(buildStoreAlternates({ ...base, market: { preview: false } })).toEqual(buildStoreAlternates(base));
    expect(buildStoreAlternates({ ...base, market: null })).toEqual(buildStoreAlternates(base));
    expect(Object.keys(buildStoreAlternates(base).languages).length).toBeGreaterThan(0);
  });
});
