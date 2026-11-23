import { describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import { productAlternates, productPathByLocale, slugRecordToTranslations } from './productPaths';

const translations = [
  { locale: 'sv', slug: 'studentskylt-med-guldtext' },
  { locale: 'en', slug: 'student-sign-with-gold-text' },
  { locale: 'de', slug: 'abschlussschild-mit-goldschrift' },
  { locale: 'fr', slug: '' },
  { locale: null, slug: 'x' },
];

describe('productPathByLocale (M161 A)', () => {
  it('maps every translation and skips empty slugs', () => {
    expect(productPathByLocale(translations)).toEqual({
      sv: '/products/studentskylt-med-guldtext',
      en: '/products/student-sign-with-gold-text',
      de: '/products/abschlussschild-mit-goldschrift',
    });
    expect(productPathByLocale(null)).toEqual({});
  });

  it('the sitemap record gives the same map', () => {
    const rec = { sv: 'studentskylt-med-guldtext', en: 'student-sign-with-gold-text', de: 'abschlussschild-mit-goldschrift' };
    expect(productPathByLocale(slugRecordToTranslations(rec))).toEqual(productPathByLocale(translations));
  });
});

describe('productAlternates (M161 B1)', () => {
  const store = {
    custom_domain: null,
    language_config: { primary_locale: 'en', secondary_locales: NAMEZ_EU.locales },
    market: NAMEZ_EU,
    markets: [NAMEZ_SE, NAMEZ_EU],
  };

  it('canonical under /de-at uses the de slug even for an English request slug', () => {
    const alt = productAlternates({
      storeSlug: 'namez-se',
      store,
      translations,
      slug: 'student-sign-with-gold-text',
      locale: 'de',
      pathPrefix: '/de-at',
    });
    expect(alt.canonical).toBe('https://namez.shop/de-at/products/abschlussschild-mit-goldschrift');
    expect(alt.languages['sv-SE']).toBe('https://namez.se/products/studentskylt-med-guldtext');
  });

  it('without a market: the requested slug, single origin (unchanged)', () => {
    const alt = productAlternates({
      storeSlug: 'anna',
      store: { custom_domain: 'anna.se', language_config: { primary_locale: 'sv', secondary_locales: ['en'] } },
      translations,
      slug: 'studentskylt-med-guldtext',
      locale: 'en',
    });
    expect(alt.canonical).toBe('https://anna.se/en/products/studentskylt-med-guldtext');
    expect(alt.languages.sv).toBe('https://anna.se/products/studentskylt-med-guldtext');
  });
});
