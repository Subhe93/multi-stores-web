import { describe, expect, it } from 'vitest';
import {
  isRegionMode, marketForCountry, parseRegionCookie, regionCookieString, regionCountries, regionLocales,
  regionOptions, selectedRegionCountry, REGION_COOKIE, type RegionMarket,
} from './region';
import { injectReviewLocales } from '@/test/reviewLocales';
import { NAMEZ_EU, NAMEZ_SE } from '@/test/regionFixtures';

const SE: RegionMarket = NAMEZ_SE;
const EU: RegionMarket = NAMEZ_EU;
const MARKETS = [SE, EU];

const ctxFor = (current: RegionMarket | null, currentLocale = 'en') => ({
  current, markets: current ? MARKETS : [], primaryLocale: 'sv', secondaryLocales: ['en', 'ar'], currentLocale,
});

describe('isRegionMode', () => {
  it('needs two servable LIVE markets', () => {
    expect(isRegionMode(MARKETS)).toBe(true);
    expect(isRegionMode([SE])).toBe(false);
    expect(isRegionMode([])).toBe(false);
    expect(isRegionMode(null)).toBe(false);
    expect(isRegionMode([SE, { ...EU, status: 'DRAFT' }])).toBe(false);
    expect(isRegionMode([SE, { ...EU, primary_hostname: null }])).toBe(false);
  });
});

describe('regionOptions', () => {
  it('lists SE + the ten EU countries + one "other countries" row on the default market', () => {
    const out = regionOptions(EU, MARKETS);
    expect(out).toHaveLength(12);
    expect(out.filter((o) => o.marketKey === 'eu').map((o) => o.country)).toEqual(EU.countries);
    expect(out.find((o) => o.country === 'SE')).toEqual({ country: 'SE', marketKey: 'default', currency: 'SEK' });
    expect(out[out.length - 1]).toEqual({ country: null, marketKey: 'default', currency: 'SEK' });
  });

  it('leaves out DRAFT and hostless non-default markets', () => {
    const out = regionOptions(SE, [SE, { ...EU, status: 'DRAFT' }, { ...EU, key: 'x', primary_hostname: null }]);
    expect(out.map((o) => o.country)).toEqual(['SE', null]);
  });

  it('resolves a country claimed twice current-first and normalises codes', () => {
    const a = { ...SE, countries: ['se', 'de '] };
    const b = { ...EU, countries: ['DE', 'xx1', 'be'] };
    expect(regionOptions(b, [a, b]).map((o) => `${o.country}:${o.marketKey}`))
      .toEqual(['DE:eu', 'BE:eu', 'SE:default', 'null:default']);
    expect(regionOptions(a, [a, b]).map((o) => `${o.country}:${o.marketKey}`))
      .toEqual(['SE:default', 'DE:default', 'BE:eu', 'null:default']);
  });

  it('regionCountries is the union of servable countries', () => {
    expect([...regionCountries(MARKETS)].sort()).toEqual([...EU.countries, 'SE'].sort());
  });
});

describe('marketForCountry', () => {
  it('maps a country to the market that sells there, else the default market', () => {
    expect(marketForCountry('BE', SE, MARKETS)?.key).toBe('eu');
    expect(marketForCountry('be', EU, MARKETS)?.key).toBe('eu');
    expect(marketForCountry('SE', EU, MARKETS)?.key).toBe('default');
    expect(marketForCountry('NO', EU, MARKETS)?.key).toBe('default');
    expect(marketForCountry(null, EU, MARKETS)?.key).toBe('default');
  });
});

describe('regionLocales', () => {
  it('derives the language list from the country\'s market (default first)', () => {
    expect(regionLocales('SE', ctxFor(EU))).toEqual(['sv', 'en', 'ar']);
    expect(regionLocales('BE', ctxFor(SE))).toEqual(['en', 'de', 'fr', 'ar']);
    expect(regionLocales(null, ctxFor(EU))).toEqual(['sv', 'en', 'ar']);
  });

  it('a store without the markets app: primary + its switcher locales', () => {
    expect(regionLocales(null, { ...ctxFor(null), primaryLocale: 'de', secondaryLocales: ['de', 'en', 'fr'] }))
      .toEqual(['de', 'en', 'fr']);
    expect(regionLocales('BE', { ...ctxFor(null), primaryLocale: 'de', secondaryLocales: [] })).toEqual(['de']);
  });

  it('countryLocales overrides the market list, intersected with what the market serves', () => {
    const eu = { ...EU, locales: ['de', 'fr', 'nl'] };
    const ctx = { ...ctxFor(eu), markets: [SE, eu], countryLocales: { BE: { default: 'nl', locales: ['fr', 'it'] } } };
    expect(regionLocales('BE', ctx)).toEqual(['nl', 'fr']);
    expect(regionLocales('DE', ctx)).toEqual(['en', 'de', 'fr', 'nl']);
    // Nothing served: the market list stays.
    expect(regionLocales('BE', { ...ctx, countryLocales: { BE: { default: 'it', locales: [] } } }))
      .toEqual(['en', 'de', 'fr', 'nl']);
  });

  describe('with ku in review', () => {
    injectReviewLocales('ku');
    it('hides a review locale unless it is the current locale', () => {
      const eu = { ...EU, locales: ['de', 'ku'] };
      const ctx = { ...ctxFor(eu), markets: [SE, eu] };
      expect(regionLocales('DE', ctx)).toEqual(['en', 'de']);
      expect(regionLocales('DE', { ...ctx, currentLocale: 'ku' })).toEqual(['en', 'de', 'ku']);
    });
  });
});

describe('selectedRegionCountry', () => {
  it('stored country when the current market sells there, else its only country, else null', () => {
    expect(selectedRegionCountry('BE', EU)).toBe('BE');
    expect(selectedRegionCountry('be', EU)).toBe('BE');
    expect(selectedRegionCountry(null, EU)).toBeNull();
    expect(selectedRegionCountry('BE', SE)).toBe('SE');
    expect(selectedRegionCountry(null, SE)).toBe('SE');
    expect(selectedRegionCountry('BE', null)).toBeNull();
  });
});

describe('region cookie', () => {
  it('parses an ISO2 code only', () => {
    expect(parseRegionCookie('BE')).toBe('BE');
    expect(parseRegionCookie(' be ')).toBe('BE');
    expect(parseRegionCookie('BEL')).toBeNull();
    expect(parseRegionCookie('<x>')).toBeNull();
    expect(parseRegionCookie('')).toBeNull();
    expect(parseRegionCookie(undefined)).toBeNull();
  });

  it('builds the set and delete strings', () => {
    expect(REGION_COOKIE).toBe('ms-region');
    expect(regionCookieString('be')).toBe('ms-region=BE; path=/; max-age=31536000; samesite=lax');
    expect(regionCookieString('BE', true)).toBe('ms-region=BE; path=/; max-age=31536000; samesite=lax; secure');
    expect(regionCookieString(null)).toBe('ms-region=; path=/; max-age=0; samesite=lax');
  });
});
