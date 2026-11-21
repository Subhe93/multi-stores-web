import { describe, expect, it } from 'vitest';
import { regionLocales, requestRegionCountry, type RegionLocalesContext } from './region';
import { buildRegionUrl, type RegionUrlContext } from './regionUrl';
import { buildMarketSwitchUrl } from './marketSwitch';
import { checkoutPrefillCountry } from './checkoutCountries';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from './localePaths.fixtures';

// M156 §7: the M155 picker core with language-country paths. The picker UI
// is unchanged; only `regionLocales` and `buildRegionUrl` learn the paths.
// The M155 specs (region/regionUrl/marketSwitch.spec.ts) stay the regression
// cases for markets without paths.

const MARKETS = [NAMEZ_SE, NAMEZ_EU];

const ctxOnEu = (currentLocale = 'de'): RegionLocalesContext => ({
  current: NAMEZ_EU, markets: MARKETS, primaryLocale: 'en', secondaryLocales: NAMEZ_EU.locales, currentLocale,
});

describe('regionLocales on a locale-path market (§7.1)', () => {
  it.each([
    ['DE', ['de', 'en', 'ar']],
    ['AT', ['de', 'en', 'ar']],
    ['FR', ['fr', 'en', 'ar']],
    ['BE', ['fr', 'en', 'ar']],
    ['NL', ['en', 'ar']],
    ['FI', ['en', 'ar']],
    ['ES', ['en', 'ar']],
    ['PT', ['en', 'ar']],
  ])('%s -> %j', (country, expected) => {
    expect(regionLocales(country, ctxOnEu())).toEqual(expected);
  });

  it('Other countries / SE use the default market (namez.se) list', () => {
    expect(regionLocales(null, ctxOnEu())).toEqual(['sv', 'en', 'ar']);
    expect(regionLocales('SE', ctxOnEu())).toEqual(['sv', 'en', 'ar']);
  });

  it('dropping ar from eu.locales drops it everywhere', () => {
    const eu = { ...NAMEZ_EU, locales: ['de', 'fr'] };
    const ctx = { ...ctxOnEu(), current: eu, markets: [NAMEZ_SE, eu] };
    expect(regionLocales('BE', ctx)).toEqual(['fr', 'en']);
  });

  it('regression: the same market without paths keeps the M155 list', () => {
    const ctx = { ...ctxOnEu(), current: NAMEZ_EU_LEGACY, markets: [NAMEZ_SE, NAMEZ_EU_LEGACY] };
    expect(regionLocales('FI', ctx)).toEqual(['en', 'de', 'fr', 'ar']);
    expect(regionLocales('AT', ctx)).toEqual(['en', 'de', 'fr', 'ar']);
  });
});

const onEu = (over: Partial<RegionUrlContext> = {}): RegionUrlContext => ({
  storeSlug: 'namez-se', current: NAMEZ_EU, markets: MARKETS, storeCustomDomain: null,
  primaryLocale: 'en', locales: ['en', 'de', 'fr', 'ar'], currentLocale: 'de',
  pathname: '/de-de/products/x', search: '?sort=1', ...over,
});

describe('buildRegionUrl on a locale-path market (§7.2)', () => {
  it('AT + de from /de-de/ is a real navigation to /de-at/', () => {
    expect(buildRegionUrl({ country: 'AT', locale: 'de' }, onEu())).toBe('/de-at/products/x?sort=1');
  });

  it('same prefix and locale: null', () => {
    expect(buildRegionUrl({ country: 'DE', locale: 'de' }, onEu())).toBeNull();
    expect(buildRegionUrl({ country: 'FI', locale: 'en' }, onEu({ currentLocale: 'en', pathname: '/products/x' }))).toBeNull();
    expect(buildRegionUrl({ country: 'BE', locale: 'ar' }, onEu({ currentLocale: 'ar', pathname: '/ar/x' }))).toBeNull();
  });

  it('FI + en goes to the root; BE + fr from /fr-fr/ to /fr-be/', () => {
    expect(buildRegionUrl({ country: 'FI', locale: 'en' }, onEu())).toBe('/products/x?sort=1');
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onEu({ currentLocale: 'fr', pathname: '/fr-fr/x', search: '' }))).toBe('/fr-be/x');
    expect(buildRegionUrl({ country: 'AT', locale: 'ar' }, onEu({ search: '?rg=AT' }))).toBe('/ar/products/x');
    expect(buildRegionUrl({ country: 'AT', locale: 'de' }, onEu({ currentLocale: 'en', pathname: '/', search: '' }))).toBe('/de-at');
  });

  it('uses a registered translated slug', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onEu({ pathByLocale: { fr: '/products/carte' } }))).toBe('/fr-be/products/carte?sort=1');
  });

  it('cross market: namez.se -> BE + fr lands on namez.shop/fr-be/ with rg', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onSe({}))).toBe('https://namez.shop/fr-be/products/x?rg=BE');
    expect(buildRegionUrl({ country: 'AT', locale: 'de' }, onSe({}))).toBe('https://namez.shop/de-at/products/x?rg=AT');
    expect(buildRegionUrl({ country: 'FI', locale: 'en' }, onSe({}))).toBe('https://namez.shop/products/x?rg=FI');
    expect(buildRegionUrl({ country: 'ES', locale: 'ar' }, onSe({ currentLocale: 'ar', pathname: '/ar/products/x' }))).toBe('https://namez.shop/ar/products/x?rg=ES');
  });

  it('cross market: /de-at/ on eu -> SE + sv strips the country path', () => {
    expect(buildRegionUrl({ country: 'SE', locale: 'sv' }, onEu({ pathname: '/de-at/products/x', search: '' }))).toBe('https://namez.se/products/x?rg=SE');
    expect(buildRegionUrl({ country: 'SE', locale: 'en' }, onEu({ pathname: '/de-at/products/x', search: '' }))).toBe('https://namez.se/en/products/x?rg=SE');
  });
});

function onSe(over: Partial<RegionUrlContext>): RegionUrlContext {
  return {
    storeSlug: 'namez-se', current: NAMEZ_SE, markets: MARKETS, storeCustomDomain: null,
    primaryLocale: 'sv', locales: ['sv', 'en', 'ar'], currentLocale: 'sv', pathname: '/products/x', search: '', ...over,
  };
}

describe('buildMarketSwitchUrl targetCountry', () => {
  it('a target with locale paths uses the path of the chosen country; without one the primary path', () => {
    const base = { storeSlug: 'namez-se', current: NAMEZ_SE, target: NAMEZ_EU, pathname: '/en/products/x', locale: 'en' };
    expect(buildMarketSwitchUrl({ ...base, targetLocale: 'de', targetCountry: 'AT' })).toBe('https://namez.shop/de-at/products/x');
    expect(buildMarketSwitchUrl({ ...base, targetLocale: 'de' })).toBe('https://namez.shop/de-de/products/x');
    expect(buildMarketSwitchUrl({ ...base })).toBe('https://namez.shop/products/x');
  });

  it('a target without paths ignores targetCountry (M155 behaviour)', () => {
    expect(buildMarketSwitchUrl({
      storeSlug: 'namez-se', current: NAMEZ_SE, target: NAMEZ_EU_LEGACY, pathname: '/products/x', locale: 'sv', targetLocale: 'de', targetCountry: 'AT',
    })).toBe('https://namez.shop/de/products/x');
  });
});

describe('checkout prefill on a country path (§7.3)', () => {
  it('the path country wins over the cookie for this request', () => {
    expect(requestRegionCountry('AT', 'DE')).toBe('AT');
    expect(requestRegionCountry(null, 'de')).toBe('DE');
    expect(requestRegionCountry(undefined, undefined)).toBeNull();
    const options = [{ code: 'DE', name: 'Germany' }, { code: 'AT', name: 'Austria' }];
    expect(checkoutPrefillCountry({
      preferredCountry: requestRegionCountry('AT', 'DE'), defaultCountry: 'DE', formCountry: '', alreadyPrefilled: false, options,
    })).toBe('AT');
  });
});
