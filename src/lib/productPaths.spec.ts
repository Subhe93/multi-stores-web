import { describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import { isUsableSlug } from './slugRoute';
import type { MarketRoute } from './market';
import {
  productAlternates,
  productLinkFallbackLocale,
  productLinkPath,
  productLinkSlug,
  productPathByLocale,
  slugRecordToTranslations,
  type ProductAlternatesStore,
  type ProductSlugTranslation,
} from './productPaths';

const translations = [
  { locale: 'sv', slug: 'studentskylt-med-guldtext' },
  { locale: 'en', slug: 'student-sign-with-gold-text' },
  { locale: 'de', slug: 'abschlussschild-mit-goldschrift' },
  { locale: 'fr', slug: '' },
  // M163: a degenerate slug (404) is never a canonical / hreflang target.
  { locale: 'ar', slug: '-' },
  { locale: null, slug: 'x' },
];

describe('productPathByLocale (M161 A)', () => {
  it('maps every translation and skips empty and degenerate slugs', () => {
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

// -- M163: product links = canonical slug --------------------------------

const full: ProductSlugTranslation[] = [
  { locale: 'sv', slug: 'studentskylt-med-guldtext' },
  { locale: 'en', slug: 'student-sign-with-gold-text' },
  { locale: 'de', slug: 'abschlussschild-mit-goldschrift' },
];
// The live case on namez.shop: no `en` row.
const noEn: ProductSlugTranslation[] = [
  { locale: 'sv', slug: '3d-bokstav-med-namn' },
  { locale: 'de', slug: '3d-buchstabe-mit-namen' },
];
const svOnly: ProductSlugTranslation[] = [{ locale: 'sv', slug: '3d-bokstav-med-namn' }];
const degenerateDe: ProductSlugTranslation[] = [
  { locale: 'sv', slug: 'tavla-med-namn' },
  { locale: 'en', slug: 'name-board' },
  { locale: 'de', slug: '-' },
];
const none: ProductSlugTranslation[] = [
  { locale: 'sv', slug: '' },
  { locale: 'en', slug: null },
  { locale: 'de', slug: '--' },
];

describe('productLinkFallbackLocale (M163)', () => {
  it('market default wins over primary, then primary, then en', () => {
    expect(productLinkFallbackLocale('sv', NAMEZ_EU)).toBe('en');
    expect(productLinkFallbackLocale('en', NAMEZ_SE)).toBe('sv');
    expect(productLinkFallbackLocale('sv', null)).toBe('sv');
    expect(productLinkFallbackLocale('sv')).toBe('sv');
    expect(productLinkFallbackLocale(undefined, null)).toBe('en');
    expect(productLinkFallbackLocale('', { default_locale: '' })).toBe('en');
  });
});

describe('productLinkSlug / productLinkPath (M163)', () => {
  const eu = productLinkFallbackLocale('en', NAMEZ_EU);
  const se = productLinkFallbackLocale('sv', NAMEZ_SE);
  const plain = productLinkFallbackLocale('sv', null);

  it('namez.shop root (en)', () => {
    expect(productLinkSlug(full, 'en', eu)).toBe('student-sign-with-gold-text');
    expect(productLinkSlug(noEn, 'en', eu)).toBe('3d-bokstav-med-namn');
  });

  it('namez.shop /de-de and /de-at (de): the German slug, never the Swedish one when de exists', () => {
    expect(productLinkSlug(full, 'de', eu)).toBe('abschlussschild-mit-goldschrift');
    expect(productLinkSlug(noEn, 'de', eu)).toBe('3d-buchstabe-mit-namen');
    expect(productLinkSlug(svOnly, 'de', eu)).toBe('3d-bokstav-med-namn');
    expect(productLinkSlug(degenerateDe, 'de', eu)).toBe('name-board');
  });

  it('namez.se (sv default): sv, en, ar', () => {
    expect(productLinkSlug(full, 'sv', se)).toBe('studentskylt-med-guldtext');
    expect(productLinkSlug(full, 'en', se)).toBe('student-sign-with-gold-text');
    expect(productLinkSlug(full, 'ar', se)).toBe('studentskylt-med-guldtext');
  });

  it('store without markets (sv primary + en)', () => {
    expect(productLinkSlug(full, 'sv', plain)).toBe('studentskylt-med-guldtext');
    expect(productLinkSlug(full, 'en', plain)).toBe('student-sign-with-gold-text');
    expect(productLinkSlug(svOnly, 'en', plain)).toBe('3d-bokstav-med-namn');
  });

  it('missing translations and no usable slug', () => {
    expect(productLinkSlug(full, 'fr', eu)).toBe('student-sign-with-gold-text');
    expect(productLinkSlug(none, 'de', eu)).toBeNull();
    expect(productLinkSlug(null, 'de', eu)).toBeNull();
    expect(productLinkSlug(undefined, 'de', eu)).toBeNull();
    expect(productLinkPath(none, { locale: 'de', fallbackLocale: eu, id: 'p1' })).toBe('/products/p1');
    expect(productLinkPath(noEn, { locale: 'de', fallbackLocale: eu, id: 'p1' })).toBe('/products/3d-buchstabe-mit-namen');
  });

  it('a single-locale store keeps its only slug on every locale', () => {
    expect(productLinkSlug(svOnly, 'sv', 'sv')).toBe('3d-bokstav-med-namn');
    expect(productLinkSlug(svOnly, 'sv', 'en')).toBe('3d-bokstav-med-namn');
  });
});

describe('product links = canonical (M163)', () => {
  const euStore: ProductAlternatesStore = {
    custom_domain: null,
    language_config: { primary_locale: 'en', secondary_locales: NAMEZ_EU.locales },
    market: NAMEZ_EU,
    markets: [NAMEZ_SE, NAMEZ_EU],
  };
  const seStore: ProductAlternatesStore = {
    custom_domain: null,
    language_config: { primary_locale: 'sv', secondary_locales: NAMEZ_SE.locales },
    market: NAMEZ_SE,
    markets: [NAMEZ_SE, NAMEZ_EU],
  };
  const plainStore: ProductAlternatesStore = {
    custom_domain: 'anna.se',
    language_config: { primary_locale: 'sv', secondary_locales: ['en'] },
  };

  const views: Array<{
    name: string;
    storeSlug: string;
    store: ProductAlternatesStore;
    locale: string;
    pathPrefix?: string;
    prefix: string;
  }> = [
    { name: 'namez.shop root', storeSlug: 'namez-se', store: euStore, locale: 'en', prefix: '' },
    { name: 'namez.shop /de-de', storeSlug: 'namez-se', store: euStore, locale: 'de', pathPrefix: '/de-de', prefix: '/de-de' },
    { name: 'namez.shop /de-at', storeSlug: 'namez-se', store: euStore, locale: 'de', pathPrefix: '/de-at', prefix: '/de-at' },
    { name: 'namez.se root', storeSlug: 'namez-se', store: seStore, locale: 'sv', prefix: '' },
    { name: 'namez.se /en', storeSlug: 'namez-se', store: seStore, locale: 'en', prefix: '/en' },
    { name: 'no market sv', storeSlug: 'anna', store: plainStore, locale: 'sv', prefix: '' },
    { name: 'no market /en', storeSlug: 'anna', store: plainStore, locale: 'en', prefix: '/en' },
  ];
  const products: Array<[string, ProductSlugTranslation[]]> = [
    ['full', full],
    ['noEn', noEn],
    ['svOnly', svOnly],
    ['degenerateDe', degenerateDe],
  ];
  const usableSlugsOf = (tr: ProductSlugTranslation[]) => tr.map((t) => t.slug).filter(isUsableSlug);
  const hasUsable = (tr: ProductSlugTranslation[], locale: string) =>
    tr.some((t) => t.locale === locale && isUsableSlug(t.slug));
  const marketOf = (store: ProductAlternatesStore): MarketRoute | null => store.market ?? null;

  for (const v of views) {
    for (const [pname, tr] of products) {
      it(`${v.name} / ${pname}`, () => {
        const market = marketOf(v.store);
        const fallback = productLinkFallbackLocale(v.store.language_config?.primary_locale, market);
        const slug = productLinkSlug(tr, v.locale, fallback)!;
        expect(slug).toBeTruthy();
        // With a market the canonical does not depend on the requested slug
        // when the locale or the default locale has its own slug: every URL
        // a visitor may land on canonicalises to the link.
        const independent = !!market && (hasUsable(tr, v.locale) || hasUsable(tr, fallback));
        if (independent) {
          for (const requested of usableSlugsOf(tr)) {
            const { canonical } = productAlternates({
              storeSlug: v.storeSlug,
              store: v.store,
              translations: tr,
              slug: requested,
              locale: v.locale,
              pathPrefix: v.pathPrefix,
            });
            expect(new URL(canonical).pathname).toBe(`${v.prefix}/products/${slug}`);
          }
        }
        // Fixed point: the page the link opens canonicalises to itself.
        const self = productAlternates({
          storeSlug: v.storeSlug,
          store: v.store,
          translations: tr,
          slug,
          locale: v.locale,
          pathPrefix: v.pathPrefix,
        }).canonical;
        expect(new URL(self).pathname).toBe(`${v.prefix}/products/${slug}`);
      });
    }
  }
});
