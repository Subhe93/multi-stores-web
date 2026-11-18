import { describe, expect, it } from 'vitest';
import { resolveLocaleMeta } from './localeMeta';

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

  it('an unknown locale has no flag and shows its code', () => {
    expect(resolveLocaleMeta('xx')).toEqual({ code: 'xx', label: 'XX', flagUrl: '' });
  });
});
