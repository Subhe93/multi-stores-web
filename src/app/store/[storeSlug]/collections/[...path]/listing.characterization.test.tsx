import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { listingFixtureProducts, type FixtureProduct } from '@/test/fixtures/listingProducts';

// Characterization of the /collections/[...path] route. Recorded BEFORE the
// opt-in server pagination: a collection at or below the threshold (every
// live store today) must render the same HTML, request the same list and
// hand the builder section the same `listing` prop. The API mock also answers
// the paged form with a small total, so this file runs unchanged after the
// implementation.

const state = {
  store: {} as Record<string, unknown>,
  products: [] as FixtureProduct[],
  template: null as unknown,
  market: undefined as string | undefined,
};

const TREE = [
  {
    id: 'c1',
    slug: 'kok',
    path: ['kok'],
    thumbnail_url: '/uploads/collections/kok.jpg',
    translations: [
      { locale: 'sv', name: 'Kök', description: '<p>Allt för köket</p>', long_description: '<h2>Om köket</h2><p>Lång text</p>' },
      { locale: 'ar', name: 'مطبخ', description: '<p>كل شيء للمطبخ</p>' },
    ],
    children: [
      {
        id: 'c2',
        slug: 'koppar',
        path: ['kok', 'koppar'],
        translations: [{ locale: 'sv', name: 'Koppar' }, { locale: 'ar', name: 'أكواب' }],
        children: [],
      },
    ],
  },
];

const api = {
  getStore: vi.fn(async () => state.store),
  // A fresh array per call: the route sorts the answer in place.
  getProducts: vi.fn(async (..._args: unknown[]) => structuredClone(state.products)),
  getProductsPage: vi.fn(async (_slug: string, params: { page: number; limit: number }) => {
    const start = (params.page - 1) * params.limit;
    return {
      items: structuredClone(state.products.slice(start, start + params.limit)),
      total: state.products.length,
      page: params.page,
      limit: params.limit,
      has_more: params.page * params.limit < state.products.length,
      legacy: false,
    };
  }),
  getCreatorCategories: vi.fn(async () => structuredClone(TREE)),
  getPublishedCollectionTemplate: vi.fn(async () => state.template),
};
const sectionProps = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
}));
vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: () => api.getStore(),
    getProducts: (...a: unknown[]) => api.getProducts(...a),
    getProductsPage: (...a: [string, { page: number; limit: number }]) => api.getProductsPage(...a),
    getCreatorCategories: () => api.getCreatorCategories(),
    getPublishedCollectionTemplate: () => api.getPublishedCollectionTemplate(),
  },
  resolveMediaUrl: (u?: string | null) => (u ? (u.startsWith('http') ? u : `https://api.example.com${u}`) : ''),
}));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => state.market,
  getRequestNoindex: async () => false,
  getRequestPathPrefix: async () => undefined,
  getRequestPathCountry: async () => null,
}));
vi.mock('@/lib/focusedStorefront.server', () => ({ redirectFocusedBrowsing: async () => undefined }));
vi.mock('@/lib/preloadSections', () => ({ preloadSectionData: async () => ({}) }));
vi.mock('@/themes/registry', () => ({ resolveTheme: () => ({ key: 'minimal' }) }));
vi.mock('@/themes/SectionRenderer', () => ({
  SectionRenderer: (p: { listing: unknown; locale: string }): ReactNode => {
    sectionProps(p);
    return <div data-testid="sections" />;
  },
}));

import CollectionPage from './page';

const SV_STORE = {
  name: 'Namez',
  currency: 'SEK',
  custom_domain: 'namez.se',
  language_config: { primary_locale: 'sv', secondary_locales: ['ar'] },
  theme: { hero: { collections: { enabled: true, show_count: true } } },
  theme_key: 'minimal',
};

async function renderPage(path: string[], searchParams: Record<string, string> = {}) {
  const tree = await CollectionPage({
    params: Promise.resolve({ storeSlug: 'namez-se', path }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  state.store = structuredClone(SV_STORE);
  state.products = listingFixtureProducts();
  state.template = null;
  state.market = undefined;
  for (const fn of Object.values(api)) fn.mockClear();
  sectionProps.mockClear();
});

describe('collection built-in listing (unchanged)', () => {
  it('default view: HTML and the list request', async () => {
    expect(await renderPage(['kok'])).toMatchSnapshot();
    expect(api.getProducts).toHaveBeenCalledTimes(1);
    expect(api.getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', creator_category: 'kok' }, undefined);
  });

  it('sorted by price, searched, secondary locale, market, child collection', async () => {
    state.market = 'se';
    expect(await renderPage(['kok', 'koppar'], { lang: 'ar', sort: 'price_asc', search: 'mugg' })).toMatchSnapshot();
    expect(api.getProducts).toHaveBeenCalledTimes(1);
    expect(api.getProducts).toHaveBeenCalledWith(
      'namez-se',
      { locale: 'ar', creator_category: 'koppar', search: 'mugg' },
      'se',
    );
  });

  it('newest and price descending orders', async () => {
    expect(await renderPage(['kok'], { sort: 'newest' })).toMatchSnapshot();
    expect(await renderPage(['kok'], { sort: 'price_desc' })).toMatchSnapshot();
  });

  it('an empty collection', async () => {
    state.products = [];
    expect(await renderPage(['kok'])).toMatchSnapshot();
  });
});

describe('collection through a published COLLECTION_TEMPLATE (unchanged)', () => {
  it('hands the section the same listing prop, without pagination', async () => {
    state.template = { snapshot: { sections: [{ id: 's1', section_key: 'product-listing', settings: {} }] } };
    const out = await renderPage(['kok'], { sort: 'newest', search: 'm' });
    expect(out).toMatchSnapshot();
    expect(sectionProps).toHaveBeenCalledTimes(1);
    const props = sectionProps.mock.calls[0]![0] as { listing: Record<string, unknown>; locale: string };
    expect(props.locale).toBe('sv');
    expect('pagination' in props.listing).toBe(false);
    expect(props.listing).toEqual({
      kind: 'collection',
      products: [
        {
          id: 'p1',
          base_price: 120,
          compare_at_price: 150,
          created_at: '2026-11-03T10:00:00.000Z',
          translations: [
            { locale: 'sv', title: 'Mugg', slug: 'mugg' },
            { locale: 'ar', title: 'كوب', slug: '-' },
          ],
          images: [{ url: '/uploads/products/mugg.jpg' }],
          promotions: [{ type: 'PERCENTAGE', value: 20, translations: [{ title: 'Rea' }] }],
          vendor: { company_name: 'Namez AB' },
        },
        {
          id: 'p2',
          base_price: 80,
          compare_at_price: undefined,
          created_at: '2026-11-02T10:00:00.000Z',
          translations: [{ locale: 'sv', title: 'Presentkort', slug: 'presentkort' }],
          images: [],
          promotions: [{ type: 'FIXED_AMOUNT', value: 10, translations: [{ title: 'Tio av' }] }],
          vendor: undefined,
        },
        {
          id: 'p3',
          base_price: 300,
          compare_at_price: undefined,
          created_at: '2026-11-01T10:00:00.000Z',
          translations: [
            { locale: 'en', title: 'Poster', slug: 'poster' },
            { locale: 'ar', title: 'ملصق', slug: 'ملصق' },
          ],
          images: [{ url: 'https://cdn.example.com/poster.svg' }],
          promotions: undefined,
          vendor: undefined,
        },
      ],
      collections: [],
      collection: TREE[0],
      collectionPath: [],
      query: { search: 'm', sort: 'newest' },
      hero: { enabled: true, show_count: true },
      basePath: '/collections/kok',
      isFiltered: true,
    });
    expect(api.getProducts).toHaveBeenCalledWith('namez-se', { locale: 'sv', creator_category: 'kok', search: 'm' }, undefined);
  });
});

// M164: the product-link rewriter is server-only; identity here (covered by its own specs).
vi.mock('@/lib/productLinkCanonical.server', () => ({
  productLinkRewriter: async () => ({
    sections: async (s: unknown) => s,
    menus: async (m: unknown) => m,
    html: async (h: unknown) => h,
  }),
}));
