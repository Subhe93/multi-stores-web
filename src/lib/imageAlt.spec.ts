import { describe, expect, it } from 'vitest';
import { localizedImageAlt, pickAltTranslations, resolveImageAlt, storedImageAlt } from './imageAlt';

// M170 A: alt text of a product image per locale. Chain: locale alt ->
// base-language alt -> default alt -> the caller's fallback (product title).

describe('resolveImageAlt', () => {
  const img = {
    alt_text: 'Röd dalahäst',
    alt_translations: { de: 'Rotes Dalapferd', 'de-AT': 'Rotes Dalapferd (AT)', en: 'Red Dala horse' },
  };

  it('uses the alt of the page locale', () => {
    expect(resolveImageAlt(img, 'de', 'Titel')).toBe('Rotes Dalapferd');
    expect(resolveImageAlt(img, 'en', 'Title')).toBe('Red Dala horse');
    expect(resolveImageAlt(img, 'de-AT', 'Titel')).toBe('Rotes Dalapferd (AT)');
  });

  it('a regional locale falls back to its base language', () => {
    expect(resolveImageAlt(img, 'de-DE', 'Titel')).toBe('Rotes Dalapferd');
    expect(resolveImageAlt(img, 'en-GB', 'Title')).toBe('Red Dala horse');
  });

  it('matches the locale without regard to case or separator', () => {
    expect(resolveImageAlt(img, 'de-at', 'Titel')).toBe('Rotes Dalapferd (AT)');
    expect(resolveImageAlt(img, 'de_AT', 'Titel')).toBe('Rotes Dalapferd (AT)');
  });

  it('a locale without an alt uses the default alt, never another language', () => {
    expect(resolveImageAlt(img, 'fr', 'Titre')).toBe('Röd dalahäst');
    expect(resolveImageAlt(img, 'sv', 'Titel')).toBe('Röd dalahäst');
    // A base-language page never borrows a regional alt.
    expect(resolveImageAlt({ alt_text: 'Standard', alt_translations: { 'de-AT': 'AT' } }, 'de', 'T')).toBe('Standard');
  });

  it('no stored alt at all: the fallback (product title)', () => {
    expect(resolveImageAlt({ alt_translations: { de: 'Pferd' } }, 'fr', 'Titre')).toBe('Titre');
    expect(resolveImageAlt({ alt_text: null }, 'fr', 'Titre')).toBe('Titre');
    expect(resolveImageAlt({ alt_text: '' }, 'fr', 'Titre')).toBe('Titre');
    expect(resolveImageAlt({}, 'fr', 'Titre')).toBe('Titre');
    expect(resolveImageAlt(undefined, 'fr', 'Titre')).toBe('Titre');
    expect(resolveImageAlt(null, 'fr', '')).toBe('');
  });

  it('an image without a map resolves exactly as before M170 (alt || alt_text || title)', () => {
    const before = (i: { alt?: string | null; alt_text?: string | null }, title: string) => i.alt || i.alt_text || title;
    const cases = [
      { alt: 'A', alt_text: 'B' },
      { alt: '', alt_text: 'B' },
      { alt_text: 'B ' },
      { alt_text: null },
      { alt: null, alt_text: '' },
      {},
    ];
    for (const c of cases) {
      for (const locale of ['sv', 'de', 'de-AT']) expect(resolveImageAlt(c, locale, 'Title')).toBe(before(c, 'Title'));
    }
  });

  it('empty, blank and non-string map values are skipped', () => {
    expect(resolveImageAlt({ alt_text: 'D', alt_translations: { de: '' } }, 'de', 'T')).toBe('D');
    expect(resolveImageAlt({ alt_text: 'D', alt_translations: { de: '   ' } }, 'de', 'T')).toBe('D');
    expect(resolveImageAlt({ alt_text: 'D', alt_translations: { de: 5 } }, 'de', 'T')).toBe('D');
    expect(resolveImageAlt({ alt_text: 'D', alt_translations: { 'de-AT': ' ', de: 'Pferd' } }, 'de-AT', 'T')).toBe('Pferd');
  });

  it('a malformed map never throws', () => {
    for (const bad of [null, 'de', 5, ['de'], true]) {
      expect(resolveImageAlt({ alt_text: 'D', alt_translations: bad }, 'de', 'T')).toBe('D');
    }
  });

  it('the localized alt wins over a pre-resolved `alt`', () => {
    expect(resolveImageAlt({ alt: 'Pre', alt_text: 'D', alt_translations: { de: 'Pferd' } }, 'de', 'T')).toBe('Pferd');
    expect(resolveImageAlt({ alt: 'Pre', alt_text: 'D', alt_translations: { de: 'Pferd' } }, 'fr', 'T')).toBe('Pre');
  });
});

describe('storedImageAlt', () => {
  it('is the same chain without the title fallback', () => {
    expect(storedImageAlt({ alt_text: 'D', alt_translations: { de: 'Pferd' } }, 'de')).toBe('Pferd');
    expect(storedImageAlt({ alt_text: 'D', alt_translations: { de: 'Pferd' } }, 'de-AT')).toBe('Pferd');
    expect(storedImageAlt({ alt_text: 'D', alt_translations: { de: 'Pferd' } }, 'fr')).toBe('D');
    expect(storedImageAlt({ alt_translations: { de: 'Pferd' } }, 'fr')).toBeUndefined();
    expect(storedImageAlt({ alt_text: null }, 'fr')).toBeUndefined();
    expect(storedImageAlt(undefined, 'fr')).toBeUndefined();
  });

  it('without a locale only the default alt is used', () => {
    expect(storedImageAlt({ alt_text: 'D', alt_translations: { de: 'Pferd' } }, undefined)).toBe('D');
    expect(localizedImageAlt({ de: 'Pferd' }, null)).toBeUndefined();
  });
});

describe('a blank default alt counts as no alt', () => {
  it('whitespace-only alt_text / alt fall through to the title', () => {
    expect(storedImageAlt({ alt_text: '  ' }, 'de')).toBeUndefined();
    expect(resolveImageAlt({ alt_text: '  ' }, 'de', 'Titel')).toBe('Titel');
    expect(resolveImageAlt({ alt: ' ', alt_text: '\n' }, 'de', 'Titel')).toBe('Titel');
    // A blank pre-resolved alt does not hide a real default alt.
    expect(storedImageAlt({ alt: '  ', alt_text: 'Röd häst' }, 'sv')).toBe('Röd häst');
  });

  it('the localized alt still wins over a blank default', () => {
    expect(resolveImageAlt({ alt_text: ' ', alt_translations: { de: 'Pferd' } }, 'de', 'Titel')).toBe('Pferd');
    expect(resolveImageAlt({ alt_text: ' ', alt_translations: { de: 'Pferd' } }, 'sv', 'Titel')).toBe('Titel');
  });
});

describe('pickAltTranslations', () => {
  const map = { de: 'Pferd', 'de-AT': 'Pferd AT', en: 'Horse', fr: 'Cheval' };

  it('keeps the page locale and its base language only', () => {
    expect(pickAltTranslations(map, 'de-AT')).toEqual({ de: 'Pferd', 'de-AT': 'Pferd AT' });
    expect(pickAltTranslations(map, 'de')).toEqual({ de: 'Pferd' });
    expect(pickAltTranslations(map, 'en-GB')).toEqual({ en: 'Horse' });
  });

  it('nothing left, or not a map: undefined', () => {
    expect(pickAltTranslations(map, 'sv')).toBeUndefined();
    expect(pickAltTranslations({ de: ' ' }, 'de')).toBeUndefined();
    expect(pickAltTranslations(null, 'de')).toBeUndefined();
    expect(pickAltTranslations(['de'], 'de')).toBeUndefined();
  });

  it('the picked map resolves to the same alt as the full one', () => {
    for (const locale of ['de', 'de-AT', 'de-DE', 'en', 'fr', 'sv', 'tr']) {
      const full = { alt_text: 'Standard', alt_translations: map };
      const slim = { alt_text: 'Standard', alt_translations: pickAltTranslations(map, locale) };
      expect(resolveImageAlt(slim, locale, 'T')).toBe(resolveImageAlt(full, locale, 'T'));
    }
  });
});
