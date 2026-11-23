import { describe, expect, it } from 'vitest';
import { NAMEZ_EU, NAMEZ_EU_LEGACY, NAMEZ_SE } from './localePaths.fixtures';
import { marketUrlSlots } from './localePaths';
import type { MarketRoute } from './market';
import { productAlternates, productCanonicalSlug, type ProductAlternatesStore, type ProductSlugTranslation } from './productPaths';
import { matchedProductSlug, productRedirectSlug } from './productRedirect';
import { canonicalRedirectHref, encodeUrlPath, isNonCanonicalSlugForm, routeSlug } from './slugRoute';

// Fixture products (M164 §7): full set, missing translations, a degenerate
// slug, non-ASCII slugs.
const PRODUCTS: Record<string, ProductSlugTranslation[]> = {
  full: [
    { locale: 'sv', slug: 'personlig-3d-staende-namnskylt' },
    { locale: 'en', slug: 'personal-3d-standing-name-sign' },
    { locale: 'de', slug: 'personalisiertes-freistehendes-3d-namensschild' },
    { locale: 'fr', slug: 'plaque-nom-3d' },
    { locale: 'ar', slug: 'لافتة-اسم' },
  ],
  noEn: [
    { locale: 'sv', slug: '3d-bokstav-med-namn' },
    { locale: 'de', slug: '3d-buchstabe-mit-namen' },
  ],
  svOnly: [{ locale: 'sv', slug: 'tavla-med-namn' }],
  degenerateDe: [
    { locale: 'sv', slug: 'skylt-för-dörr' },
    { locale: 'en', slug: 'door-sign' },
    { locale: 'de', slug: '-' },
  ],
  encodedStored: [
    { locale: 'sv', slug: 'kl%c3%a4der' },
    { locale: 'en', slug: 'clothes' },
  ],
};

function marketStore(market: MarketRoute): ProductAlternatesStore {
  return {
    custom_domain: null,
    language_config: { primary_locale: market.default_locale, secondary_locales: market.locales },
    market,
    markets: [NAMEZ_SE, NAMEZ_EU],
  };
}

// Every URL root of both Namez markets: namez.se (root sv, /en, /ar) and
// namez.shop (root en, /de-de, /de-at, /fr-fr, /fr-be, /ar).
const SLOTS = [NAMEZ_SE, NAMEZ_EU].flatMap((m) =>
  marketUrlSlots(m)
    .filter((s) => s.locale === m.default_locale || m.locales.includes(s.locale))
    .map((s) => ({ market: m, prefix: s.prefix, locale: s.locale })),
);

/** What Next hands the page for a slug typed in the URL (percent-encoded). */
const asParam = (slug: string) => encodeURIComponent(slug);

function variants(slug: string): string[] {
  return [slug, slug.toUpperCase(), slug.charAt(0).toUpperCase() + slug.slice(1), slug.normalize('NFD')];
}

describe('productRedirectSlug: loop / fixed point (M164 §3.5)', () => {
  for (const slot of SLOTS) {
    for (const [name, translations] of Object.entries(PRODUCTS)) {
      it(`${slot.market.primary_hostname}${slot.prefix || '/'} · ${name}`, () => {
        const store = marketStore(slot.market);
        for (const tr of translations) {
          if (!tr.slug) continue;
          for (const typed of variants(tr.slug)) {
            const raw = asParam(typed);
            const first = productRedirectSlug({ rawSlug: raw, translations, store, locale: slot.locale, allowLocaleRedirect: true });
            if (!first) continue;
            // The hop lands on a URL whose param is the encoded target.
            const landed = encodeUrlPath(`/${first}`).slice(1);
            const second = productRedirectSlug({ rawSlug: landed, translations, store, locale: slot.locale, allowLocaleRedirect: true });
            expect(second, `${typed} -> ${first} -> ${second}`).toBeNull();
            // The target is the canonical of productAlternates, always.
            const canonical = productAlternates({
              storeSlug: 'namez-se',
              store,
              translations,
              slug: matchedProductSlug({ translations }, routeSlug(raw)),
              locale: slot.locale,
              pathPrefix: slot.prefix,
            }).canonical;
            expect(canonical.endsWith(encodeUrlPath(`/products/${first}`))).toBe(true);
          }
        }
      });
    }
  }
});

describe('productRedirectSlug: market targets', () => {
  const eu = marketStore(NAMEZ_EU);
  const se = marketStore(NAMEZ_SE);
  const go = (store: ProductAlternatesStore, slug: string, locale: string, translations = PRODUCTS.full) =>
    productRedirectSlug({ rawSlug: asParam(slug), translations, store, locale, allowLocaleRedirect: true });

  it('sv hero slug on /de-de goes to the de slug', () => {
    expect(go(eu, 'personlig-3d-staende-namnskylt', 'de')).toBe('personalisiertes-freistehendes-3d-namensschild');
    expect(go(eu, '3d-bokstav-med-namn', 'de', PRODUCTS.noEn)).toBe('3d-buchstabe-mit-namen');
  });

  it('the canonical slug itself renders (no hop)', () => {
    expect(go(eu, 'personalisiertes-freistehendes-3d-namensschild', 'de')).toBeNull();
    expect(go(se, 'personlig-3d-staende-namnskylt', 'sv')).toBeNull();
    expect(go(eu, 'لافتة-اسم', 'ar')).toBeNull();
  });

  it('missing translation: falls back to the market default slug, then primary', () => {
    // namez.shop root (en) without an en row: sv is neither default nor present -> self.
    expect(go(eu, '3d-bokstav-med-namn', 'en', PRODUCTS.noEn)).toBeNull();
    expect(go(eu, '3d-buchstabe-mit-namen', 'en', PRODUCTS.noEn)).toBeNull();
    // fr on namez.shop for a product without fr: market default (en) slug.
    expect(go(eu, 'skylt-för-dörr', 'fr', PRODUCTS.degenerateDe)).toBe('door-sign');
    // degenerate de slug: falls back to en.
    expect(go(eu, 'skylt-för-dörr', 'de', PRODUCTS.degenerateDe)).toBe('door-sign');
    expect(go(eu, 'door-sign', 'de', PRODUCTS.degenerateDe)).toBeNull();
  });

  it('en slug on namez.se root goes to the sv slug', () => {
    expect(go(se, 'personal-3d-standing-name-sign', 'sv')).toBe('personlig-3d-staende-namnskylt');
  });

  it('case variant of another locale slug: one hop to the canonical', () => {
    expect(go(eu, 'Personlig-3D-Staende-Namnskylt', 'de')).toBe('personalisiertes-freistehendes-3d-namensschild');
  });

  it('a stored slug with %xx octets is never a target; unconfirmed slugs never redirect', () => {
    expect(go(se, 'clothes', 'sv', PRODUCTS.encodedStored)).toBeNull();
    expect(go(eu, 'not-a-slug-of-this-product', 'de')).toBeNull();
  });

  it('legacy eu market (bare /de folder) behaves the same', () => {
    const legacy = { ...eu, market: NAMEZ_EU_LEGACY, markets: [NAMEZ_SE, NAMEZ_EU_LEGACY] };
    expect(go(legacy, 'personlig-3d-staende-namnskylt', 'de')).toBe('personalisiertes-freistehendes-3d-namensschild');
  });
});

describe('productRedirectSlug: case rule only', () => {
  const table: Array<[string, string]> = [
    ['personlig-3d-staende-namnskylt', 'personlig-3d-staende-namnskylt'],
    [asParam('PERSONLIG-3D-STAENDE-NAMNSKYLT'), 'personlig-3d-staende-namnskylt'],
    [asParam('Skylt-För-Dörr'), 'skylt-för-dörr'],
    [asParam('skylt-för-dörr'.normalize('NFD')), 'skylt-för-dörr'],
    [asParam('skylt-för-dörr'), 'skylt-för-dörr'],
    ['door-sign', 'door-sign'],
  ];
  const translations = [...PRODUCTS.full, ...PRODUCTS.degenerateDe.slice(0, 1)];

  it('allowLocaleRedirect false equals isNonCanonicalSlugForm (previews, focused stores)', () => {
    for (const store of [marketStore(NAMEZ_EU), marketStore(NAMEZ_SE)]) {
      for (const [raw, stored] of table) {
        for (const locale of ['sv', 'en', 'de', 'ku']) {
          const got = productRedirectSlug({ rawSlug: raw, translations, store, locale, allowLocaleRedirect: false });
          const storedMatch = translations.some((t) => t.slug === stored);
          expect(got).toBe(storedMatch && isNonCanonicalSlugForm(raw, stored) ? stored : null);
        }
      }
    }
  });

  it('no market (multi-locale and single-locale): another locale slug never redirects', () => {
    const multi: ProductAlternatesStore = { language_config: { primary_locale: 'sv', secondary_locales: ['en', 'de'] } };
    const single: ProductAlternatesStore = { language_config: { primary_locale: 'sv', secondary_locales: [] } };
    for (const store of [multi, single, null]) {
      expect(productRedirectSlug({ rawSlug: 'personal-3d-standing-name-sign', translations: PRODUCTS.full, store, locale: 'de', allowLocaleRedirect: true })).toBeNull();
      expect(productRedirectSlug({ rawSlug: 'personlig-3d-staende-namnskylt', translations: PRODUCTS.full, store, locale: 'en', allowLocaleRedirect: true })).toBeNull();
      // The case rule still applies.
      expect(productRedirectSlug({ rawSlug: 'Door-Sign', translations: PRODUCTS.degenerateDe, store, locale: 'en', allowLocaleRedirect: true })).toBe('door-sign');
    }
  });
});

describe('productCanonicalSlug parity with productAlternates', () => {
  const stores: Array<[string, ProductAlternatesStore, string | undefined]> = [
    ['eu /de-de', marketStore(NAMEZ_EU), '/de-de'],
    ['eu root', marketStore(NAMEZ_EU), ''],
    ['se root', marketStore(NAMEZ_SE), undefined],
    ['eu preview', { ...marketStore(NAMEZ_EU), market: { ...NAMEZ_EU, preview: true } }, ''],
    ['no indexable market', { ...marketStore(NAMEZ_EU), markets: [] }, ''],
    ['no market', { language_config: { primary_locale: 'sv', secondary_locales: ['en', 'de'] } }, undefined],
  ];
  for (const [name, store, pathPrefix] of stores) {
    it(name, () => {
      for (const translations of Object.values(PRODUCTS)) {
        for (const tr of translations) {
          if (!tr.slug) continue;
          for (const locale of ['sv', 'en', 'de', 'fr', 'ar', 'ku', 'xx']) {
            for (const noindex of [false, true]) {
              const slug = productCanonicalSlug({ store, translations, matchedSlug: tr.slug, locale, noindex });
              const alt = productAlternates({ storeSlug: 'namez-se', store, translations, slug: tr.slug, locale, pathPrefix, noindex });
              expect(alt.canonical.endsWith(encodeUrlPath(`/products/${slug}`)), `${locale} ${tr.slug} ${alt.canonical}`).toBe(true);
            }
          }
        }
      }
    });
  }
});

describe('redirect href keeps the campaign query (M164 §3.3)', () => {
  it('utm, click ids, variant, design, repeated keys; prefix kept; lang dropped', () => {
    const query = {
      lang: 'de',
      utm_source: 'google',
      utm_campaign: 'black friday',
      gclid: 'abc',
      fbclid: 'f1',
      ttclid: 't1',
      msclkid: 'm1',
      variant: '12',
      design: 'd-1',
      tag: ['a', 'b'],
    };
    const href = canonicalRedirectHref('/products/3d-buchstabe-mit-namen', query, '/de-de');
    expect(href).toBe(
      '/de-de/products/3d-buchstabe-mit-namen?utm_source=google&utm_campaign=black+friday&gclid=abc&fbclid=f1&ttclid=t1&msclkid=m1&variant=12&design=d-1&tag=a&tag=b',
    );
    expect(canonicalRedirectHref('/products/x', { utm_source: 'fb' }, '')).toBe('/products/x?utm_source=fb');
    expect(canonicalRedirectHref('/products/x', { lang: 'ar', gclid: '1' })).toBe('/ar/products/x?gclid=1');
    expect(canonicalRedirectHref('/products/x', { lang: 'de', gclid: '1' }, '/de-at')).toBe('/de-at/products/x?gclid=1');
  });
});
