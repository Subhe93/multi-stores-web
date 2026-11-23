import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketRoute } from '@/lib/market';

// M163: every product link of a section is the canonical URL of the
// rendered locale (the slug `productAlternates` canonicalises to), never the
// primary / market-default slug when the locale has its own one.

const market = { current: null as MarketRoute | null };

vi.mock('@/lib/api', () => ({
  storefront: { getProducts: () => new Promise(() => {}), getProductsPage: () => new Promise(() => {}) },
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => market.current }));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));
vi.mock('@/components/product/PriceTaxSuffix', () => ({
  PriceTaxSuffix: ({ className }: { className?: string }) => <span className={className}>vat-note</span>,
}));

import { StorePathPrefixProvider } from '@/hooks/useStorePathPrefix';
import { NAMEZ_EU } from '@/lib/localePaths.fixtures';
import type { SectionRenderProps } from '../../types';
import { featuredProductsSection } from './FeaturedProducts';
import { collectionProductsSection } from './CollectionProducts';
import { productSliderSection } from './ProductSlider';
import { objectStudySection } from '../../creative/sections/ObjectStudy';
import { pickedHref, toPickedProduct } from '../../creative/data/pickedProducts';

const tr = (locale: string, slug: string) => ({ locale, title: `${locale} title`, slug });
// The live namez.shop case (no `en` row) and a product with every locale.
const NO_EN = { id: 'p1', base_price: 10, translations: [tr('sv', '3d-bokstav-med-namn'), tr('de', '3d-buchstabe-mit-namen')], images: [] };
const FULL = {
  id: 'p2',
  base_price: 20,
  translations: [tr('sv', 'studentskylt-med-guldtext'), tr('en', 'student-sign-with-gold-text'), tr('de', 'abschlussschild-mit-goldschrift')],
  images: [],
};
const SV_ONLY = { id: 'p3', base_price: 30, translations: [tr('sv', 'bara-svensk')], images: [] };

const ROWS = {
  'featured-products': featuredProductsSection,
  'collection-products': collectionProductsSection,
  'product-slider': productSliderSection,
} as const;

function productHrefs(key: keyof typeof ROWS, props: Partial<SectionRenderProps>, pathPrefix?: string): string[] {
  const def = ROWS[key];
  const Component = def.Component;
  const html = renderToStaticMarkup(
    <StorePathPrefixProvider value={pathPrefix}>
      <Component
        settings={{ ...def.defaultSettings }}
        content={{ heading: 'Picks' }}
        locale="en"
        primaryLocale="en"
        storeSlug="namez-se"
        currency="EUR"
        preloaded={[NO_EN, FULL, SV_ONLY]}
        {...props}
      />
    </StorePathPrefixProvider>,
  );
  const el = document.createElement('div');
  el.innerHTML = html;
  const hrefs = Array.from(el.querySelectorAll('a[href*="/products/"]')).map((a) => a.getAttribute('href') || '');
  return [...new Set(hrefs)];
}

beforeEach(() => {
  market.current = null;
});

describe.each(Object.keys(ROWS) as Array<keyof typeof ROWS>)('%s product links (M163)', (key) => {
  it('namez.shop /de-de: the German slug, the market default (en) slug, then the first usable one', () => {
    market.current = NAMEZ_EU;
    expect(productHrefs(key, { locale: 'de', primaryLocale: 'en' }, '/de-de')).toEqual([
      '/de-de/products/3d-buchstabe-mit-namen',
      '/de-de/products/abschlussschild-mit-goldschrift',
      '/de-de/products/bara-svensk',
    ]);
  });

  it('namez.shop root (en): the en slug; no en row gives the first usable slug', () => {
    market.current = NAMEZ_EU;
    expect(productHrefs(key, { locale: 'en', primaryLocale: 'en' }, '')).toEqual([
      '/products/3d-bokstav-med-namn',
      '/products/student-sign-with-gold-text',
      '/products/bara-svensk',
    ]);
  });

  it('store without markets, primary sv: the sv slugs as today', () => {
    expect(productHrefs(key, { locale: 'sv', primaryLocale: 'sv' })).toEqual([
      '/products/3d-bokstav-med-namn',
      '/products/studentskylt-med-guldtext',
      '/products/bara-svensk',
    ]);
  });

  it('single-locale store: links identical to today', () => {
    expect(productHrefs(key, { locale: 'sv', primaryLocale: 'sv', preloaded: [SV_ONLY] })).toEqual(['/products/bara-svensk']);
  });
});

describe('creative picked products (M163)', () => {
  const row = { translations: FULL.translations, base_price: 20 };

  it('toPickedProduct: url is the canonical path of the locale, the slug stays the owner key', () => {
    const de = toPickedProduct(row, 'studentskylt-med-guldtext', 'de', 'en');
    expect(de?.slug).toBe('studentskylt-med-guldtext');
    expect(de?.url).toBe('/products/abschlussschild-mit-goldschrift');
    expect(toPickedProduct(row, 'studentskylt-med-guldtext', 'fr', 'en')?.url).toBe('/products/student-sign-with-gold-text');
    // No usable translation slug: the owner slug, as before.
    expect(toPickedProduct({ translations: [{ locale: 'sv', title: 'X', slug: '-' }] }, 'owner-slug', 'sv', 'sv')?.url).toBe(
      '/products/owner-slug',
    );
  });

  it('pickedHref keeps the owner query and hash, else the owner URL', () => {
    const live = { url: '/products/abschlussschild-mit-goldschrift' };
    expect(pickedHref('/products/x?ref=a#b', live)).toBe('/products/abschlussschild-mit-goldschrift?ref=a#b');
    expect(pickedHref('/en/products/x', live)).toBe('/products/abschlussschild-mit-goldschrift');
    expect(pickedHref('/products/x', null)).toBe('/products/x');
    expect(pickedHref('/products/x', {})).toBe('/products/x');
  });

  it('object-study on /de-de links the German slug even when the owner typed the Swedish one', () => {
    const preloaded = { products: { 'studentskylt-med-guldtext': toPickedProduct(row, 'studentskylt-med-guldtext', 'de', 'en') } };
    const html = renderToStaticMarkup(
      <objectStudySection.Component
        locale="de"
        primaryLocale="en"
        pathPrefix="/de-de"
        storeSlug="namez-se"
        settings={{ ...objectStudySection.defaultSettings, product_url: '/products/studentskylt-med-guldtext', image: '/uploads/a.webp' }}
        content={{ cta_text: 'Ansehen' }}
        preloaded={preloaded}
      />,
    );
    const hrefs = [...html.matchAll(/href="([^"]*\/products\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs)).toEqual(new Set(['/de-de/products/abschlussschild-mit-goldschrift']));
  });
});
