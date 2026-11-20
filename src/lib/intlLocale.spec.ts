import { describe, expect, it } from 'vitest';
import { intlLocale, withLatinDigits } from './intlLocale';

describe('intlLocale', () => {
  it('maps Kurmanji to fixed Intl locales for numbers and dates', () => {
    expect(intlLocale('ku')).toBe('de');
    expect(intlLocale('ku', 'number')).toBe('de');
    expect(intlLocale('ku', 'date')).toBe('en-GB');
    expect(intlLocale('ku-Latn', 'date')).toBe('en-GB');
  });

  it('leaves every other locale unchanged', () => {
    for (const l of ['en', 'tr', 'de', 'fr', 'sv', 'pt-BR']) {
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

  it('gives Arabic Latin digits for prices and dates (Namez 2026-11-20)', () => {
    expect(intlLocale('ar')).toBe('ar-u-nu-latn');
    expect(intlLocale('ar', 'date')).toBe('ar-u-nu-latn');
    expect(intlLocale('ar-SA')).toBe('ar-SA-u-nu-latn');
    const price = new Intl.NumberFormat(intlLocale('ar'), { style: 'currency', currency: 'EUR' }).format(9.9);
    expect(price).toMatch(/9[.,٫]90/);
    expect(price).not.toMatch(/[٠-٩]/);
  });

  it('withLatinDigits never adds a second numbering system', () => {
    expect(withLatinDigits('ar')).toBe('ar-u-nu-latn');
    expect(withLatinDigits('ar-u-nu-latn')).toBe('ar-u-nu-latn');
    expect(withLatinDigits('ar-u-ca-gregory-nu-arab')).toBe('ar-u-ca-gregory-nu-arab');
    expect(withLatinDigits('sv')).toBe('sv-u-nu-latn');
  });
});
