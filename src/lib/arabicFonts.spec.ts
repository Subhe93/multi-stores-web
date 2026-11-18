import { describe, expect, it } from 'vitest';
import { ARABIC_FONTS, ARABIC_SCRIPT_LOCALES, arabicFontOrNull, isArabicScriptLocale } from './arabicFonts';
import { GOOGLE_FONT_SET } from './google-fonts';
import { buildGoogleFontsHref, isAllowedGoogleCssUrl } from './storeFonts';

describe('curated Arabic fonts', () => {
  it('pins the six families and their order (mirrored by the dashboard)', () => {
    expect([...ARABIC_FONTS]).toEqual([
      'Noto Naskh Arabic',
      'Markazi Text',
      'Noto Kufi Arabic',
      'Noto Sans Arabic',
      'IBM Plex Sans Arabic',
      'Cairo',
    ]);
  });

  it('every family is in the Google catalog and builds an allow-listed URL', () => {
    for (const family of ARABIC_FONTS) {
      expect(GOOGLE_FONT_SET.has(family), family).toBe(true);
      const href = buildGoogleFontsHref([family]);
      expect(href, family).not.toBeNull();
      expect(isAllowedGoogleCssUrl(href!), family).toBe(true);
    }
  });

  it('reads a stored value: allow-listed after trim, anything else is unset', () => {
    expect(arabicFontOrNull('Cairo')).toBe('Cairo');
    expect(arabicFontOrNull('  Noto Naskh Arabic ')).toBe('Noto Naskh Arabic');
    for (const raw of [undefined, null, '', '   ', 'Comic Sans', 'cairo', 'Amiri', 'Tajawal', 12, {}, ['Cairo']]) {
      expect(arabicFontOrNull(raw), String(raw)).toBeNull();
    }
  });
});

describe('Arabic-script locales', () => {
  it('pins the list', () => {
    expect([...ARABIC_SCRIPT_LOCALES]).toEqual(['ar', 'fa', 'ur', 'ps', 'ckb', 'sd', 'ug']);
  });

  it('reads the base tag, in any case, with a region or script suffix', () => {
    for (const locale of ['ar', 'ar-SA', 'ar_EG', 'AR', 'Ar-ae', 'fa', 'fa-IR', 'ur', 'ps', 'ckb', 'ckb-IQ', 'sd', 'ug', ' ar ']) {
      expect(isArabicScriptLocale(locale), locale).toBe(true);
    }
  });

  it('is false for every other locale and for a value that is not a locale', () => {
    for (const locale of ['en', 'sv', 'tr', 'de', 'fr', 'he', 'arc', 'far', 'en-AR', '', '-ar', undefined, null, 12, {}, ['ar']]) {
      expect(isArabicScriptLocale(locale), String(locale)).toBe(false);
    }
  });
});
