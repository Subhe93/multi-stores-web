import { describe, expect, it } from 'vitest';
import { intlLocale } from './intlLocale';

describe('intlLocale', () => {
  it('maps Kurmanji to fixed Intl locales for numbers and dates', () => {
    expect(intlLocale('ku')).toBe('de');
    expect(intlLocale('ku', 'number')).toBe('de');
    expect(intlLocale('ku', 'date')).toBe('en-GB');
    expect(intlLocale('ku-Latn', 'date')).toBe('en-GB');
  });

  it('leaves every other locale unchanged', () => {
    for (const l of ['en', 'ar', 'tr', 'de', 'fr', 'sv', 'pt-BR']) {
      expect(intlLocale(l)).toBe(l);
      expect(intlLocale(l, 'date')).toBe(l);
    }
    expect(intlLocale('')).toBe('en');
    expect(intlLocale(null)).toBe('en');
  });

  it('formats Kurmanji prices like CLDR ku', () => {
    const f = (l: string) =>
      new Intl.NumberFormat(l, { style: 'currency', currency: 'SEK' }).format(1234.5);
    expect(f(intlLocale('ku'))).toBe(f('de'));
  });
});
