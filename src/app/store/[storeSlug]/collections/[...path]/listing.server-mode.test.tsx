import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { listingFixtureProducts, type FixtureProduct } from '@/test/fixtures/listingProducts';

// Collection page in server mode: more matching products than
// LISTING_SERVER_THRESHOLD, so only the first page is rendered (API order),
// the count comes from `total` and the grid gets the pagination state.

const state = { firstPage: [] as FixtureProduct[], total: 0, template: null as unknown, thumb: true };

const tree = () => [
  {
    id: 'c1',
    slug: 'kok',
    path: ['kok'],
    ...(state.thumb ? { thumbnail_url: '/uploads/collections/kok.jpg' } : {}),
    translations: [{ locale: 'sv', name: 'Kök' }],
    children: [],
  },
];

const api = {
  getProducts: vi.fn<(...args: unknown[]) => Promise<FixtureProduct[]>>(async () => structuredClone(state.firstPage)),
  getProductsPage: vi.fn(async (_slug: string, params: { page: number; limit: number }) => ({
    items: structuredClone(state.firstPage.slice(0, params.limit)),
    total: state.total,
    page: params.page,
    limit: params.limit,
    has_more: params.page * params.limit < state.total,
    legacy: false,
  })),
};
const sectionProps = vi.fn();
const gridProps = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: async () => ({
      name: 'Namez',
      currency: 'SEK',
      custom_domain: 'namez.se',
      language_config: { primary_locale: 'sv', secondary_locales: ['ar'] },
      theme: { hero: { collections: { enabled: true, show_count: true } } },
    }),
    getProducts: (...a: unknown[]) => api.getProducts(...a),
    getProductsPage: (...a: [string, { page: number; limit: number }]) => api.getProductsPage(...a),
    getCreatorCategories: async () => tree(),
    getPublishedCollectionTemplate: async () => state.template,
  },
  resolveMediaUrl: (u?: string | null) => (u ? (u.startsWith('http') ? u : `https://api.example.com${u}`) : ''),
}));
vi.mock('@/lib/market.server', () => ({ getRequestMarket: async () => undefined, getRequestNoindex: async () => false, getRequestPathPrefix: async () => undefined, getRequestPathCountry: async () => null }));
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

import CollectionPage from './page';

async function renderPage(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(
    await CollectionPage({
      params: Promise.resolve({ storeSlug: 'namez-se', path: ['kok'] }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

const ldNames = (html: string): string[] => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  return blocks.find((b) => b['@type'] === 'CollectionPage').mainEntity.itemListElement.map((e: { name: string }) => e.name);
};
const cards = (html: string) => [...html.matchAll(/<a[^>]*href="\/(?:ar\/)?products\/[^"?]+"[\s\S]*?<\/a>/g)].map((m) => m[0]);

beforeEach(() => {
  state.firstPage = listingFixtureProducts();
  state.total = 75;
  state.template = null;
  state.thumb = true;
  api.getProducts.mockClear();
  api.getProductsPage.mockClear();
  sectionProps.mockClear();
  gridProps.mockClear();
});

describe('collection page in server mode', () => {
  it('first page with the sort and search, count from total, JSON-LD of the first page', async () => {
    const html = await renderPage({ sort: 'price_desc', search: 'm' });
    expect(api.getProducts).not.toHaveBeenCalled();
    expect(api.getProductsPage).toHaveBeenLastCalledWith(
      'namez-se',
      { locale: 'sv', creator_category: 'kok', search: 'm', sort: 'price_desc', page: 1, limit: 60 },
      undefined,
    );
    expect(html).toContain('75 store.productsCount');
    expect(html).toContain('product.shownOfTotal[shown=3,total=75]');
    expect(ldNames(html)).toEqual(['Mugg', 'Presentkort', 'Poster']);
    expect(gridProps.mock.calls[0]![0]).toMatchObject({
      variant: 'collection',
      priorityFirst: false,
      pagination: { total: 75, pageSize: 60, hasMore: true, request: { locale: 'sv', creator_category: 'kok', search: 'm', sort: 'price_desc' } },
    });
  });

  it('cards are the same markup as the legacy grid (with and without a banner image)', async () => {
    for (const thumb of [true, false]) {
      state.thumb = thumb;
      state.total = 75;
      const server = cards(await renderPage());
      state.total = 3;
      const legacy = cards(await renderPage());
      expect(server).toHaveLength(3);
      expect(server).toEqual(legacy);
    }
  });

  it('template branch: card projection plus pagination', async () => {
    state.template = { snapshot: { sections: [{ id: 's1', section_key: 'product-listing', settings: {} }] } };
    await renderPage({ lang: 'ar' });
    const listing = (sectionProps.mock.calls[0]![0] as { listing: Record<string, unknown> }).listing;
    expect(listing.pagination).toEqual({
      total: 75,
      pageSize: 60,
      hasMore: true,
      request: { locale: 'ar', creator_category: 'kok' },
    });
    expect((listing.products as Array<{ tax_rate_bp?: number }>)[0]!.tax_rate_bp).toBe(2500);
  });
});
