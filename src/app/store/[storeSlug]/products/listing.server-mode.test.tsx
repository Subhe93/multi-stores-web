import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { listingFixtureProducts, type FixtureProduct } from '@/test/fixtures/listingProducts';

// /products in server mode: the API reports more matching products than
// LISTING_SERVER_THRESHOLD, so the route renders only the first page (in the
// API's order), counts from `total` and hands the grid / section the
// pagination state.

const state = {
  store: {} as Record<string, unknown>,
  firstPage: [] as FixtureProduct[],
  total: 0,
  template: null as unknown,
};

const api = {
  getStore: vi.fn(async () => state.store),
  getProducts: vi.fn<(...args: unknown[]) => Promise<FixtureProduct[]>>(async () => structuredClone(state.firstPage)),
  getProductsPage: vi.fn(async (_slug: string, params: { page: number; limit: number }) => ({
    items: structuredClone(state.firstPage.slice(0, params.limit)),
    total: state.total,
    page: params.page,
    limit: params.limit,
    has_more: params.page * params.limit < state.total,
    legacy: false,
  })),
  getCreatorCategories: vi.fn(async () => []),
  getPublishedCatalogTemplate: vi.fn(async () => state.template),
};
const sectionProps = vi.fn();
const gridProps = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
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
    getPublishedCatalogTemplate: () => api.getPublishedCatalogTemplate(),
  },
  resolveMediaUrl: (u?: string | null) => (u ? (u.startsWith('http') ? u : `https://api.example.com${u}`) : ''),
}));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => 'se',
  getRequestNoindex: async () => false,
}));
vi.mock('@/lib/focusedStorefront.server', () => ({ redirectFocusedBrowsing: async () => undefined }));
vi.mock('@/lib/preloadSections', () => ({ preloadSectionData: async () => ({}) }));
vi.mock('@/themes/registry', () => ({ resolveTheme: () => ({ key: 'minimal' }) }));
vi.mock('@/themes/SectionRenderer', () => ({
  SectionRenderer: (p: { listing: unknown }): ReactNode => {
    sectionProps(p);
    return <div data-testid="sections" />;
  },
}));
vi.mock('@/components/listing/ListingPagedGrid', async () => {
  const actual = await vi.importActual<typeof import('@/components/listing/ListingPagedGrid')>(
    '@/components/listing/ListingPagedGrid',
  );
  return {
    ListingPagedGrid: (p: Parameters<typeof actual.ListingPagedGrid>[0]) => {
      gridProps(p);
      return <actual.ListingPagedGrid {...p} />;
    },
  };
});

import StoreProductsPage from './page';

async function renderPage(searchParams: Record<string, string> = {}) {
  const tree = await StoreProductsPage({
    params: Promise.resolve({ storeSlug: 'namez-se' }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(tree);
}

const ldItems = (html: string): string[] => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]!.replace(/\\u003c/g, '<')),
  );
  const page = blocks.find((b) => b['@type'] === 'CollectionPage');
  return (page?.mainEntity?.itemListElement ?? []).map((e: { name?: string; item?: { name?: string } }) => e.name ?? e.item?.name);
};

/** Card anchors of the product grid, in order. */
const cards = (html: string) => [...html.matchAll(/<a[^>]*href="\/(?:ar\/)?products\/[^"?]+"[\s\S]*?<\/a>/g)].map((m) => m[0]);

beforeEach(() => {
  state.store = {
    name: 'Namez',
    currency: 'SEK',
    custom_domain: 'namez.se',
    language_config: { primary_locale: 'sv', secondary_locales: ['ar'] },
    theme: { hero: { products: { enabled: true, show_count: true } } },
    theme_key: 'minimal',
  };
  // The API's order for the requested sort (deliberately not the price order).
  state.firstPage = listingFixtureProducts();
  state.total = 61;
  state.template = null;
  for (const fn of Object.values(api)) fn.mockClear();
  sectionProps.mockClear();
  gridProps.mockClear();
});

describe('/products in server mode (total above the threshold)', () => {
  it('requests the probe then the first page with the sort, never the full list', async () => {
    await renderPage({ sort: 'price_asc', search: 'mugg', creator_category: 'kok', category: 'dead' });
    expect(api.getProducts).not.toHaveBeenCalled();
    expect(api.getProductsPage.mock.calls).toEqual([
      ['namez-se', { locale: 'sv', creator_category: 'kok', search: 'mugg', page: 1, limit: 1 }, 'se'],
      ['namez-se', { locale: 'sv', creator_category: 'kok', search: 'mugg', sort: 'price_asc', page: 1, limit: 60 }, 'se'],
    ]);
  });

  it('counts from total, keeps the API order and lists only the first page in JSON-LD', async () => {
    const html = await renderPage({ sort: 'price_asc' });
    // Hero and sort bar count.
    expect(html.match(/61 store\.productsCount/g)).toHaveLength(2);
    // No in-memory re-sort: p1 (120), p2 (80), p3 (300) as the API sent them.
    expect(cards(html).map((c) => c.match(/href="([^"]+)"/)![1])).toEqual([
      '/products/mugg',
      '/products/presentkort',
      '/products/poster',
    ]);
    expect(html).toContain('role="status"');
    expect(html).toContain('product.shownOfTotal[shown=3,total=61]');
    expect(html).toContain('>product.loadMore</button>');
    // Unfiltered except the sort: JSON-LD describes the rendered first page.
    expect(ldItems(html)).toEqual(['Mugg', 'Presentkort', 'Poster']);
  });

  it('hands the grid the card projection and the pagination state', async () => {
    await renderPage({ lang: 'ar', sort: 'newest' });
    expect(gridProps).toHaveBeenCalledTimes(1);
    const p = gridProps.mock.calls[0]![0];
    expect(p).toMatchObject({
      storeSlug: 'namez-se',
      locale: 'ar',
      lp: '/ar',
      currency: 'SEK',
      gridClassName: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6',
      variant: 'catalog',
      pagination: { total: 61, pageSize: 60, hasMore: true, request: { locale: 'ar', sort: 'newest' } },
    });
    expect(p.initial.map((c: { id: string }) => c.id)).toEqual(['p1', 'p2', 'p3']);
    // tax_rate_bp is kept, descriptions are not shipped to the client.
    expect(p.initial[0].tax_rate_bp).toBe(2500);
    expect(JSON.stringify(p.initial)).not.toContain('beskrivning');
  });

  it('cards are the same markup as the legacy grid', async () => {
    const server = cards(await renderPage({ lang: 'ar' }));
    state.total = 3;
    const legacy = cards(await renderPage({ lang: 'ar' }));
    expect(server).toHaveLength(3);
    expect(server).toEqual(legacy);
  });

  it('template branch: card projection plus pagination', async () => {
    state.template = { snapshot: { sections: [{ id: 's1', section_key: 'product-listing', settings: {} }] } };
    await renderPage({ sort: 'price_desc' });
    const listing = (sectionProps.mock.calls[0]![0] as { listing: Record<string, unknown> }).listing;
    expect(listing.pagination).toEqual({
      total: 61,
      pageSize: 60,
      hasMore: true,
      request: { locale: 'sv', sort: 'price_desc' },
    });
    const products = listing.products as Array<Record<string, unknown>>;
    expect(products.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(products.map((p) => p.tax_rate_bp)).toEqual([2500, undefined, undefined]);
  });
});
