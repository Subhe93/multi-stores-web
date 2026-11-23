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
  /** M166 A: total the API reports (undefined = the fixture length). */
  total: undefined as number | undefined,
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
      total: state.total ?? all.length,
      page: params.page,
      limit: params.limit,
      has_more: (state.total ?? all.length) > params.page * params.limit,
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
  state.total = undefined;
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

// M166 A: crawlable pagination of the explorer listing.
describe('/products?page=N with the filtered listing', () => {
  const meta = (q: Record<string, string>) =>
    generateMetadata({ params: Promise.resolve({ storeSlug: 'shop' }), searchParams: Promise.resolve(q) });

  it('server-renders page N (API page N, 24 per page) and hands the page to the explorer', async () => {
    state.total = 34;
    await render({ page: '2' });
    expect(api.getProductsPage.mock.calls[0]![1]).toMatchObject({ page: 2, limit: 24 });
    const init = (explorerProps.mock.calls[0]![0] as { init: Record<string, unknown> }).init;
    expect(init.page).toBe(2);
    expect(init.total).toBe(34);
  });

  it('page 1 carries no page in the explorer init', async () => {
    state.total = 34;
    await render();
    const init = (explorerProps.mock.calls[0]![0] as { init: Record<string, unknown> }).init;
    expect(init.page).toBeUndefined();
  });

  it('a page beyond the last one is a 404', async () => {
    state.total = 34;
    await expect(render({ page: '3' })).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });

  it('non-canonical page values answer one 308 to the URL without page (other keys kept)', async () => {
    state.total = 34;
    for (const page of ['1', '01', '0', '-1', '2.5', 'abc', '']) {
      await expect(render({ page, color: 'black' })).rejects.toMatchObject({
        digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/products\?color=black;308;/),
      });
    }
  });

  it('keeps the locale prefix of a legacy locale folder in the redirect', async () => {
    await expect(render({ page: '1', lang: 'ar' })).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/ar\/products;308;/),
    });
  });

  it('metadata: page N is its own canonical, without hreflang; page 1 unchanged', async () => {
    const first = await meta({});
    expect(String(first.alternates?.canonical)).not.toContain('page=');
    expect(Object.keys(first.alternates?.languages ?? {}).length).toBeGreaterThan(0);
    const second = await meta({ page: '2' });
    expect(String(second.alternates?.canonical)).toMatch(/\/products\?page=2$/);
    expect(second.alternates?.languages).toEqual({});
    expect(second.robots).toBeUndefined();
    expect(String(second.title)).toContain('product.pageN');
  });

  it('metadata: a refined page N keeps the clean canonical and stays noindex', async () => {
    const refined = await meta({ page: '2', color: 'black' });
    expect(refined.robots).toEqual({ index: false, follow: true });
    expect(String(refined.alternates?.canonical)).not.toContain('page=');
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
