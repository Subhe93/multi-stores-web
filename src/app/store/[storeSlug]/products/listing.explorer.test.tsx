import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { listingFixtureProducts } from '@/test/fixtures/listingProducts';

// /products with the filtered listing setting (theme_customizations.listing):
// one paged request with filters + facets, the explorer gets the first page,
// refined views are noindex; without the setting nothing changes.

const state = {
  store: {} as Record<string, unknown>,
  template: null as unknown,
  explorerFails: false,
};

const facets = {
  collection: [{ value: 'kok', label: 'Kök', count: 2, parent: null }],
  type: [],
  color: [],
  size: [],
  price: { min: 10, max: 99 },
  in_stock: { count: 2 },
};

const api = {
  getStore: vi.fn(async () => state.store),
  getProducts: vi.fn(async () => listingFixtureProducts()),
  getProductsPage: vi.fn(async (_slug: string, params: { page: number; limit: number; facets?: string }) => {
    if (params.facets && state.explorerFails) throw new Error('down');
    const all = listingFixtureProducts();
    return {
      items: all.slice(0, params.limit),
      total: all.length,
      page: params.page,
      limit: params.limit,
      has_more: all.length > params.limit,
      legacy: false,
      ...(params.facets ? { facets } : {}),
    };
  }),
  getCreatorCategories: vi.fn(async () => []),
  getPublishedCatalogTemplate: vi.fn(async () => state.template),
};
const explorerProps = vi.fn();
const sectionProps = vi.fn();

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: () => api.getStore(),
    getProducts: () => api.getProducts(),
    getProductsPage: (...a: [string, { page: number; limit: number; facets?: string }]) => api.getProductsPage(...a),
    getCreatorCategories: () => api.getCreatorCategories(),
    getPublishedCatalogTemplate: () => api.getPublishedCatalogTemplate(),
  },
  resolveMediaUrl: (u?: string | null) => u || '',
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
vi.mock('@/components/listing/explorer/ListingExplorer.client', () => ({
  ListingExplorer: (p: unknown): ReactNode => {
    explorerProps(p);
    return <div data-testid="explorer" />;
  },
}));

import StoreProductsPage, { generateMetadata } from './page';

const STORE = {
  name: 'Namez',
  currency: 'SEK',
  language_config: { primary_locale: 'sv', secondary_locales: ['ar'] },
  theme: { hero: { products: { enabled: true, show_count: true } } },
  theme_customizations: { listing: { filters: ['collection', 'price'], density: 3 } },
};

const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await StoreProductsPage({ params: Promise.resolve({ storeSlug: 'shop' }), searchParams: Promise.resolve(searchParams) }),
  );

beforeEach(() => {
  state.store = structuredClone(STORE);
  state.template = null;
  state.explorerFails = false;
  for (const fn of [...Object.values(api), explorerProps, sectionProps]) fn.mockClear();
});

describe('/products with the filtered listing', () => {
  it('loads one faceted first page and renders the explorer', async () => {
    const html = await render({ color: 'Black', creator_category: 'kok', sort: 'name' });
    expect(html).toContain('data-testid="explorer"');
    expect(api.getProducts).not.toHaveBeenCalled();
    expect(api.getProductsPage).toHaveBeenCalledTimes(1);
    expect(api.getProductsPage.mock.calls[0]![1]).toEqual({
      locale: 'sv',
      sort: 'name',
      page: 1,
      limit: 24,
      filters: { collection: 'kok', color: 'black' },
      facets: '1',
    });
    const init = (explorerProps.mock.calls[0]![0] as { init: Record<string, unknown> }).init;
    expect(init).toMatchObject({
      storeSlug: 'shop',
      kind: 'catalog',
      basePath: '/products',
      total: listingFixtureProducts().length,
      facets,
      settings: { filters: ['collection', 'price'], density: 3, style: 'bar' },
      state: { collection: ['kok'], color: ['black'], sort: 'name' },
    });
  });

  it('falls back to the listing of before when the faceted request fails', async () => {
    state.explorerFails = true;
    const html = await render();
    expect(html).not.toContain('data-testid="explorer"');
    expect(api.getProducts).toHaveBeenCalledTimes(1);
  });

  it('hands the explorer to a published template section', async () => {
    state.template = { snapshot: { sections: [{ id: 's1', section_key: 'product-listing', settings: {} }] } };
    await render({ size: 'm' });
    const listing = (sectionProps.mock.calls[0]![0] as { listing: { explorer?: { state: unknown }; isFiltered: boolean } }).listing;
    expect(listing.explorer?.state).toMatchObject({ size: ['m'] });
    expect(listing.isFiltered).toBe(true);
  });

  it('noindexes refined views only; the canonical stays clean', async () => {
    const meta = (q: Record<string, string>) =>
      generateMetadata({ params: Promise.resolve({ storeSlug: 'shop' }), searchParams: Promise.resolve(q) });
    expect((await meta({})).robots).toBeUndefined();
    const refined = await meta({ color: 'black' });
    expect(refined.robots).toEqual({ index: false, follow: true });
    expect(String(refined.alternates?.canonical)).not.toContain('color');
  });

  it('without the setting the request and markup stay as before', async () => {
    state.store = { ...structuredClone(STORE), theme_customizations: {} };
    const html = await render({ color: 'black' });
    expect(html).not.toContain('data-testid="explorer"');
    expect(api.getProductsPage.mock.calls.every((c) => !('facets' in c[1]))).toBe(true);
    const meta = await generateMetadata({ params: Promise.resolve({ storeSlug: 'shop' }), searchParams: Promise.resolve({ color: 'black' }) });
    expect(meta.robots).toBeUndefined();
  });
});
