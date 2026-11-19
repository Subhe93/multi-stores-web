import { describe, expect, it } from 'vitest';
import {
  formatLocale,
  isLocaleNotServed,
  isStoreOnlyLocale,
  matchStoreLocalePrefix,
  publicLocales,
  storeServesLocale,
  switcherLocales,
} from './storeLocales';

describe('isStoreOnlyLocale / matchStoreLocalePrefix', () => {
  it('ku is store-only, the six platform locales are not', () => {
    expect(isStoreOnlyLocale('ku')).toBe(true);
    for (const l of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) expect(isStoreOnlyLocale(l)).toBe(false);
    expect(isStoreOnlyLocale('')).toBe(false);
    expect(isStoreOnlyLocale(null)).toBe(false);
    expect(isStoreOnlyLocale('xx')).toBe(false);
  });

  it('matches a whole first segment only', () => {
    expect(matchStoreLocalePrefix('/ku')).toBe('ku');
    expect(matchStoreLocalePrefix('/ku/cart')).toBe('ku');
    expect(matchStoreLocalePrefix('/sv/cart')).toBe('sv');
    expect(matchStoreLocalePrefix('/kurta')).toBeNull();
    expect(matchStoreLocalePrefix('/products/ku')).toBeNull();
    expect(matchStoreLocalePrefix('/')).toBeNull();
  });
});

describe('switcherLocales', () => {
  it('a store without a review locale gets exactly the old filter', () => {
    expect(switcherLocales('en', ['ar', 'sv'], 'en')).toEqual(['ar', 'sv']);
    expect(switcherLocales('en', ['en'], 'en')).toEqual([]);
    expect(switcherLocales('en', ['', 'de', 'en'], 'de')).toEqual(['de']);
    expect(switcherLocales('en', undefined, 'en')).toEqual([]);
  });

  it('hides ku while it is in review, unless it is the current locale', () => {
    expect(switcherLocales('sv', ['en', 'ku'], 'sv')).toEqual(['en']);
    expect(switcherLocales('sv', ['en', 'ku'], 'en')).toEqual(['en']);
    expect(switcherLocales('sv', ['ku'], 'sv')).toEqual([]);
    // The reviewer on /ku/ sees it selected and can switch back.
    expect(switcherLocales('sv', ['en', 'ku'], 'ku')).toEqual(['en', 'ku']);
    expect(switcherLocales('sv', ['ku'], 'ku')).toEqual(['ku']);
  });
});

describe('publicLocales', () => {
  it('drops review locales, keeps order', () => {
    expect(publicLocales(['sv', 'ku', 'en'])).toEqual(['sv', 'en']);
    expect(publicLocales(['en', 'ar'])).toEqual(['en', 'ar']);
  });
});

describe('storeServesLocale / isLocaleNotServed', () => {
  const legacy = { language_config: { primary_locale: 'sv', secondary_locales: ['en'] } };
  const legacyKu = { language_config: { primary_locale: 'sv', secondary_locales: ['en', 'ku'] } };
  const marketKu = {
    language_config: { primary_locale: 'sv', secondary_locales: [] },
    market: { default_locale: 'sv', locales: ['ku'] },
  };

  it('legacy store without ku: /ku/ is not served (404), platform locales never gate', () => {
    expect(storeServesLocale(legacy, 'ku')).toBe(false);
    expect(isLocaleNotServed('ku', legacy)).toBe(true);
    // A platform locale the store has not enabled keeps today's behaviour.
    expect(isLocaleNotServed('ar', legacy)).toBe(false);
    expect(isLocaleNotServed('', legacy)).toBe(false);
    expect(isLocaleNotServed(null, legacy)).toBe(false);
  });

  it('a store that enabled ku (secondary or market locale) serves it', () => {
    expect(isLocaleNotServed('ku', legacyKu)).toBe(false);
    expect(isLocaleNotServed('ku', marketKu)).toBe(false);
  });

  it('a reduced payload without language_config does not serve ku', () => {
    expect(isLocaleNotServed('ku', { language_config: null })).toBe(true);
    expect(isLocaleNotServed('ku', null)).toBe(true);
  });
});

describe('formatLocale', () => {
  it('maps ku, returns every other value unchanged', () => {
    expect(formatLocale('ku')).toBe('de');
    expect(formatLocale('ku', 'date')).toBe('en-GB');
    for (const l of ['en', 'ar', 'tr', 'de', 'fr', 'sv', 'pt-BR']) {
      expect(formatLocale(l)).toBe(l);
      expect(formatLocale(l, 'date')).toBe(l);
    }
    expect(formatLocale('')).toBe('');
    expect(formatLocale(undefined)).toBeUndefined();
  });

  it('ku prices and dates format identically on any ICU build', () => {
    const price = (l: string) =>
      new Intl.NumberFormat(formatLocale(l), { style: 'currency', currency: 'SEK' }).format(1234.5);
    expect(price('ku')).toBe(price('de'));
    expect(price('ku')).toMatch(/^1\.234,50\s?kr|^1\.234,50\s?SEK/);
    // The six locales are untouched.
    expect(price('sv')).toBe(new Intl.NumberFormat('sv', { style: 'currency', currency: 'SEK' }).format(1234.5));
    const d = new Date(Date.UTC(2026, 10, 19));
    const date = (l: string) =>
      new Intl.DateTimeFormat(formatLocale(l, 'date'), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
    expect(date('ku')).toBe('19 November 2026');
  });
});
