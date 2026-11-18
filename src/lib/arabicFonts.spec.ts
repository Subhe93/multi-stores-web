import { describe, expect, it } from 'vitest';
import { ARABIC_FONTS, arabicFontOrNull } from './arabicFonts';
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
