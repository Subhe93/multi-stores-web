import { describe, expect, it } from 'vitest';
import { countryFlagUrl, resolveLocaleMeta } from './localeMeta';

describe('resolveLocaleMeta', () => {
  it('maps the store content locales to their flag and native name', () => {
    const table: Array<[string, string, string]> = [
      ['en', 'gb', 'English'],
      ['ar', 'sa', 'العربية'],
      ['tr', 'tr', 'Türkçe'],
      ['de', 'de', 'Deutsch'],
      ['fr', 'fr', 'Français'],
      ['sv', 'se', 'Svenska'],
    ];
    for (const [locale, cc, label] of table) {
      expect(resolveLocaleMeta(locale)).toEqual({ code: locale, label, flagUrl: `https://flagcdn.com/${cc}.svg` });
    }
  });

  it('Arabic uses the complete Saudi flag artwork and Persian the Iranian one (flagcdn SVG, not a local redraw)', () => {
    expect(resolveLocaleMeta('ar').flagUrl).toBe('https://flagcdn.com/sa.svg');
    expect(resolveLocaleMeta('ar-SA').flagUrl).toBe('https://flagcdn.com/sa.svg');
    expect(resolveLocaleMeta('AR').flagUrl).toBe('https://flagcdn.com/sa.svg');
    expect(resolveLocaleMeta('fa').flagUrl).toBe('https://flagcdn.com/ir.svg');
  });

  it('Kurdish uses the bundled, unmodified Kurdistan flag; other locales keep flagcdn', () => {
    expect(resolveLocaleMeta('ku')).toEqual({ code: 'ku', label: 'Kurdî', flagUrl: '/flags/kurdistan.svg' });
    expect(resolveLocaleMeta('ku-TR').flagUrl).toBe('/flags/kurdistan.svg');
    for (const l of ['en', 'ar', 'fa', 'sv', 'tr']) expect(resolveLocaleMeta(l).flagUrl).toMatch(/^https:\/\/flagcdn\.com\/[a-z]{2}\.svg$/);
  });

  it('an unknown locale has no flag and shows its code', () => {
    expect(resolveLocaleMeta('xx')).toEqual({ code: 'xx', label: 'XX', flagUrl: '' });
  });
});

describe('countryFlagUrl', () => {
  it('builds the flagcdn URL of an ISO2 country, else empty (globe fallback)', () => {
    expect(countryFlagUrl('BE')).toBe('https://flagcdn.com/be.svg');
    expect(countryFlagUrl(' se ')).toBe('https://flagcdn.com/se.svg');
    expect(countryFlagUrl('BEL')).toBe('');
    expect(countryFlagUrl(null)).toBe('');
    expect(countryFlagUrl('../x')).toBe('');
  });
});
