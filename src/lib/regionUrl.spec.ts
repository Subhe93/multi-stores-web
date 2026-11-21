import { describe, expect, it } from 'vitest';
import { buildRegionUrl, type RegionUrlContext } from './regionUrl';
import { NAMEZ_EU as EU, NAMEZ_MARKETS as MARKETS, NAMEZ_SE as SE } from '@/test/regionFixtures';

const onEu = (over: Partial<RegionUrlContext> = {}): RegionUrlContext => ({
  storeSlug: 'namez-se', current: EU, markets: MARKETS, storeCustomDomain: null,
  primaryLocale: 'en', locales: ['en', 'de', 'fr', 'ar'], currentLocale: 'de',
  pathname: '/de/products/x', search: '?sort=1', ...over,
});
const onSe = (over: Partial<RegionUrlContext> = {}): RegionUrlContext => ({
  storeSlug: 'namez-se', current: SE, markets: MARKETS, storeCustomDomain: null,
  primaryLocale: 'sv', locales: ['sv', 'en', 'ar'], currentLocale: 'sv',
  pathname: '/products/x', search: '', ...over,
});

describe('buildRegionUrl: same market', () => {
  it('switches the language prefix and keeps the query', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onEu())).toBe('/fr/products/x?sort=1');
    expect(buildRegionUrl({ country: 'DE', locale: 'en' }, onEu())).toBe('/products/x?sort=1');
    expect(buildRegionUrl({ country: 'DE', locale: 'de' }, onEu({ currentLocale: 'en', pathname: '/', search: '' }))).toBe('/de');
  });

  it('uses a registered translated slug', () => {
    expect(buildRegionUrl({ country: 'DE', locale: 'fr' }, onEu({ pathByLocale: { fr: '/products/carte' } })))
      .toBe('/fr/products/carte?sort=1');
  });

  it('drops stale c / cd / rg params', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onEu({ search: '?sort=1&c=old&cd=2&rg=NL' })))
      .toBe('/fr/products/x?sort=1');
    expect(buildRegionUrl({ country: 'BE', locale: 'fr' }, onEu({ search: '?rg=NL' }))).toBe('/fr/products/x');
  });

  it('same locale in the same market: no navigation (only the stored country changes)', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'de' }, onEu())).toBeNull();
    expect(buildRegionUrl({ country: 'SE', locale: 'sv' }, onSe())).toBeNull();
  });
});

describe('buildRegionUrl: another market', () => {
  it('namez.se -> BE / de lands on namez.shop/de with rg', () => {
    expect(buildRegionUrl({ country: 'BE', locale: 'de' }, onSe())).toBe('https://namez.shop/de/products/x?rg=BE');
  });

  it('carries the guest cart after rg and keeps the query', () => {
    expect(buildRegionUrl({ country: 'be', locale: 'de' }, onSe({ search: '?sort=1&rg=XX&c=old', cart: { param: 'ABC', dropped: 2 } })))
      .toBe('https://namez.shop/de/products/x?sort=1&rg=BE&c=ABC&cd=2');
  });

  it('a locale the target does not serve falls back to its default (no prefix)', () => {
    expect(buildRegionUrl({ country: 'FR', locale: 'sv' }, onSe())).toBe('https://namez.shop/products/x?rg=FR');
  });

  it('"Other countries" from eu goes to the default market without rg', () => {
    expect(buildRegionUrl({ country: null, locale: 'sv' }, onEu())).toBe('https://namez.se/products/x?sort=1');
    expect(buildRegionUrl({ country: 'SE', locale: 'en' }, onEu())).toBe('https://namez.se/en/products/x?sort=1&rg=SE');
  });

  it('the legacy storeCustomDomain is used for a hostless default market', () => {
    const se = { ...SE, primary_hostname: null };
    expect(buildRegionUrl({ country: 'SE', locale: 'sv' }, onEu({ markets: [se, EU], storeCustomDomain: 'namez.example' })))
      .toBe('https://namez.example/products/x?sort=1&rg=SE');
  });

  it('uses the translated slug of the target locale', () => {
    expect(buildRegionUrl({ country: 'SE', locale: 'sv' }, onEu({ search: '', pathByLocale: { sv: '/products/metallkort' } })))
      .toBe('https://namez.se/products/metallkort?rg=SE');
  });
});

describe('buildRegionUrl: store without the markets app (language only)', () => {
  // Regression guard: the same relative URLs LocaleSwitcher builds today.
  const plain = (over: Partial<RegionUrlContext> = {}): RegionUrlContext => ({
    storeSlug: 's', current: null, markets: [], storeCustomDomain: null, primaryLocale: 'en',
    locales: ['en', 'ar', 'ku'], currentLocale: 'en', pathname: '/products/x', search: '?q=a+b', ...over,
  });

  it('adds, swaps and strips the prefix with the query kept byte for byte', () => {
    expect(buildRegionUrl({ country: null, locale: 'ar' }, plain())).toBe('/ar/products/x?q=a+b');
    expect(buildRegionUrl({ country: null, locale: 'en' }, plain({ currentLocale: 'ar', pathname: '/ar/products/x' })))
      .toBe('/products/x?q=a+b');
    expect(buildRegionUrl({ country: null, locale: 'ar' }, plain({ currentLocale: 'ku', pathname: '/ku', search: '' })))
      .toBe('/ar');
    expect(buildRegionUrl({ country: null, locale: 'en' }, plain({ currentLocale: 'ku', pathname: '/ku/', search: '' })))
      .toBe('/');
    expect(buildRegionUrl({ country: 'BE', locale: 'en' }, plain())).toBeNull();
  });
});
