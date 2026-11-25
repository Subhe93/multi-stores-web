import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

// M171 on the product ROUTE, for its three render paths (focused,
// PRODUCT_TEMPLATE, built-in):
//  - app off: no reviews read, no `reviews` key on the client product, no
//    `#reviews` block and no aggregateRating in the HTML;
//  - app on: one read, the same value behind the client product, the
//    appended block and the JSON-LD; a failed read hides everything.
// The product components are stubbed (they have their own tests); what they
// receive is recorded.

const state = {
  store: {} as Record<string, unknown>,
  product: {} as Record<string, unknown>,
  template: null as unknown,
  focus: null as unknown,
  reviews: null as unknown,
  reviewsFail: false,
};

const getProductReviews = vi.fn(async (_slug: string, _productSlug: string, page: number) => {
  if (state.reviewsFail) throw new Error('503');
  const data = state.reviews as { pages?: Record<number, unknown> } | null;
  return data?.pages ? data.pages[page] : data;
});
const seen = { products: [] as Record<string, unknown>[], sectionProduct: null as Record<string, unknown> | null };

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT ${href}`);
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { has: () => true },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: async () => state.store,
    getProduct: async () => structuredClone(state.product),
    getPublishedProductTemplate: async () => state.template,
    getProductShippingRates: async () => null,
    getProductReviews: (...a: [string, string, number]) => getProductReviews(...a),
  },
  resolveMediaUrl: (u?: string | null) => (u ? (u.startsWith('http') ? u : `https://api.example.com${u}`) : ''),
  getProductPreviewToken: async () => null,
}));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => undefined,
  getRequestNoindex: async () => false,
  getRequestPathPrefix: async () => undefined,
  getRequestPathCountry: async () => null,
}));
vi.mock('@/lib/focusedStorefront.server', () => ({ requestFocusedStorefront: async () => state.focus }));
vi.mock('@/lib/productLinkCanonical.server', () => ({
  productLinkRewriter: async () => ({
    sections: async (s: unknown) => s,
    refs: async (s: unknown) => s,
    refSlug: () => null,
  }),
}));
vi.mock('@/lib/preloadSections', () => ({ preloadSectionData: async () => ({}) }));
vi.mock('@/themes/registry', () => ({ resolveTheme: () => ({ key: 'minimal' }) }));
vi.mock('@/themes/SectionRenderer', () => ({
  SectionRenderer: (p: { product: Record<string, unknown> }): ReactNode => {
    seen.sectionProduct = p.product;
    return <div data-testid="sections" />;
  },
}));
vi.mock('@/hooks/useMarket', () => ({ MarketPathsRegistrar: () => null }));
vi.mock('@/components/layout/ProductPreview', () => ({ ProductPreviewBanner: () => null }));
vi.mock('@/components/layout/FocusedBackCapture', () => ({ FocusedBackCapture: () => null }));
vi.mock('@/components/designer/DesignerSession', () => ({
  DesignerSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/product/state/ProductPageState', () => ({
  ProductPageStateProvider: ({ product, children }: { product: Record<string, unknown>; children: ReactNode }) => {
    seen.products.push(product);
    return <>{children}</>;
  },
}));
vi.mock('@/components/product/ProductDetailClient', () => ({
  ProductDetailClient: ({ product }: { product: Record<string, unknown> }) => {
    seen.products.push(product);
    return <div data-testid="pdc" />;
  },
}));
vi.mock('@/components/product/focused/FocusedProductLayout', () => ({
  FocusedProductLayout: () => <div data-testid="focused" />,
}));
vi.mock('@/themes/minimal/sections/product/blocks/ProductBlocksWarmup', () => ({ ProductBlocksWarmup: () => null }));
vi.mock('@/themes/minimal/sections/product/ProductPageMagicWarmup', () => ({ ProductPageMagicWarmup: () => null }));

import StoreProductDetailPage from './page';

const STORE = {
  name: 'Namez',
  currency: 'SEK',
  custom_domain: 'namez.se',
  language_config: { primary_locale: 'sv', secondary_locales: [] },
};
const APP_ON = { ...STORE, apps: { reviews: { enabled: true } } };

const PRODUCT = {
  id: '3f0c1c1e-0b7e-4a57-9a53-000000000001',
  status: 'PUBLISHED',
  base_price: 399,
  translations: [{ locale: 'sv', title: 'Namnhalsband', slug: 'namnhalsband', description: '<p>Fin</p>' }],
  images: [{ url: '/uploads/a.jpg' }],
  variants: [],
};

const REVIEW = {
  id: 'r1',
  rating: 5,
  title: 'Perfekt present',
  body: 'Snabb leverans och fin gravyr.',
  display_name: 'Anna S.',
  locale: 'sv',
  verified: true,
  published_at: '2026-11-20T10:12:00.000Z',
  reply: null,
  // Must never travel further than the route.
  customer_id: 'c-secret',
  order_id: 'o-secret',
};
const REVIEWS = {
  summary: { average: 4.6, count: 12, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 8 } },
  items: [REVIEW],
  page: 1,
  total: 12,
  total_pages: 2,
};
const NO_REVIEWS = {
  summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  items: [],
  page: 1,
  total: 0,
  total_pages: 0,
};

const BLOCK_TEMPLATE = { snapshot: { sections: [{ id: 's1', section_key: 'product-title' }, { id: 's2', section_key: 'product-buy' }] } };
const MONOLITH_TEMPLATE = { snapshot: { sections: [{ id: 's1', section_key: 'product-page' }] } };

type Path = 'focused' | 'template' | 'built-in';
const PATHS: Path[] = ['focused', 'template', 'built-in'];

function setPath(path: Path) {
  state.focus = path === 'focused' ? { siteUrl: 'https://site.example/', siteHost: 'site.example' } : null;
  state.template = path === 'template' ? BLOCK_TEMPLATE : null;
}

async function renderPage(query: Record<string, string | string[]> = {}) {
  seen.products = [];
  seen.sectionProduct = null;
  const element = await StoreProductDetailPage({
    params: Promise.resolve({ storeSlug: 'namez', slug: 'namnhalsband' }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element);
}

/** The Product JSON-LD object of the page. */
function productLd(html: string): Record<string, unknown> {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
  return scripts.find((s) => s['@type'] === 'Product' || s['@type'] === 'ProductGroup');
}

beforeEach(() => {
  getProductReviews.mockClear();
  state.store = STORE;
  state.product = PRODUCT;
  state.reviews = REVIEWS;
  state.reviewsFail = false;
  setPath('built-in');
});

describe('app off', () => {
  for (const path of PATHS) {
    it(`${path}: no read, no client key, no block, no aggregateRating`, async () => {
      setPath(path);
      const html = await renderPage({ reviews_page: '2' });
      expect(getProductReviews).not.toHaveBeenCalled();
      expect(seen.products.length).toBeGreaterThan(0);
      for (const p of seen.products) expect(p).not.toHaveProperty('reviews');
      if (path === 'template') expect(seen.sectionProduct).not.toHaveProperty('reviews');
      expect(html).not.toContain('id="reviews"');
      expect(html).not.toContain('data-product-reviews');
      expect(html).not.toMatch(/aggregateRating|"review"|reviews_page/);
      expect(productLd(html)).not.toHaveProperty('aggregateRating');
    });
  }

  it('the HTML does not depend on the reviews the API would answer', async () => {
    for (const path of PATHS) {
      setPath(path);
      state.reviews = REVIEWS;
      const a = await renderPage();
      state.reviews = NO_REVIEWS;
      const b = await renderPage();
      // An `apps` block without the key is the same as no block at all.
      state.store = { ...STORE, apps: { invoices: { enabled: true } } };
      const c = await renderPage();
      state.store = STORE;
      expect(b, path).toBe(a);
      expect(c, path).toBe(a);
    }
  });
});

describe('app on, read fails', () => {
  for (const path of PATHS) {
    it(`${path}: the page renders exactly as with the app off`, async () => {
      setPath(path);
      const off = await renderPage();
      state.store = APP_ON;
      state.reviewsFail = true;
      const html = await renderPage();
      expect(getProductReviews).toHaveBeenCalledTimes(1);
      expect(html).toBe(off);
      for (const p of seen.products) expect(p).not.toHaveProperty('reviews');
    });
  }
});

describe('app on, approved reviews', () => {
  beforeEach(() => {
    state.store = APP_ON;
  });

  for (const path of PATHS) {
    it(`${path}: one read; client product and JSON-LD carry the same reviews`, async () => {
      setPath(path);
      const html = await renderPage();
      expect(getProductReviews).toHaveBeenCalledTimes(1);
      expect(getProductReviews).toHaveBeenCalledWith('namez', 'namnhalsband', 1);

      const client = seen.products.at(-1) as { reviews: Record<string, unknown> & { items: Record<string, unknown>[] } };
      expect(client.reviews.slot).toBe(path === 'template' ? 'append' : 'inline');
      expect(client.reviews.summary).toEqual(REVIEWS.summary);
      expect(client.reviews.items.map((r) => r.id)).toEqual(['r1']);
      expect(client.reviews.base_path).toBe('/products/namnhalsband');
      expect(client.reviews.write_href).toBe(`/reviews/write?product=${PRODUCT.id}`);
      expect(client.reviews.store_name).toBe('Namez');
      // Only the public fields reach the client payload.
      expect(JSON.stringify(client.reviews)).not.toMatch(/secret|customer_id|order_id/);

      const ld = productLd(html) as { aggregateRating: unknown; review: { reviewBody: string }[] };
      expect(ld.aggregateRating).toEqual({
        '@type': 'AggregateRating',
        ratingValue: 4.6,
        reviewCount: 12,
        bestRating: 5,
        worstRating: 1,
      });
      expect(ld.review.map((r) => r.reviewBody)).toEqual(client.reviews.items.map((r) => r.body));
      expect(JSON.stringify(ld)).not.toMatch(/secret/);
    });
  }

  it('template without the monolith: the route appends the block once, inside the page', async () => {
    setPath('template');
    const html = await renderPage();
    expect(html.match(/data-product-reviews/g) ?? []).toHaveLength(1);
    expect(html.indexOf('data-product-reviews')).toBeGreaterThan(html.indexOf('data-testid="sections"'));
    expect(html).toContain('Snabb leverans och fin gravyr.');
    expect(html).toContain('href="/products/namnhalsband?reviews_page=2#reviews"');
    expect((seen.sectionProduct as { reviews?: { slot: string } }).reviews?.slot).toBe('append');
  });

  it('template with the monolith: inline, nothing appended', async () => {
    setPath('template');
    state.template = MONOLITH_TEMPLATE;
    const html = await renderPage();
    expect(html).not.toContain('data-product-reviews');
    expect((seen.sectionProduct as { reviews?: { slot: string } }).reviews?.slot).toBe('inline');
    expect(productLd(html)).toHaveProperty('aggregateRating');
  });

  it('?reviews_page=2 reads and marks up page 2; other parameters stay in the links', async () => {
    const second = { ...REVIEWS, page: 2, items: [{ ...REVIEW, id: 'r11', body: 'Sida två.' }] };
    state.reviews = { pages: { 1: REVIEWS, 2: second } };
    const html = await renderPage({ reviews_page: '2', variant: 'abc', lang: 'sv' });
    expect(getProductReviews).toHaveBeenCalledWith('namez', 'namnhalsband', 2);
    const client = seen.products.at(-1) as { reviews: { page: number; base_query: string; base_path: string } };
    expect(client.reviews.page).toBe(2);
    expect(client.reviews.base_query).toBe('variant=abc');
    // The locale prefix is part of the path (`lang` is the proxy's form of it).
    expect(client.reviews.base_path).toBe('/sv/products/namnhalsband');
    expect((productLd(html) as { review: { reviewBody: string }[] }).review.map((r) => r.reviewBody)).toEqual(['Sida två.']);
  });

  it('junk page values read page 1 (no extra cache entries)', async () => {
    for (const value of ['0', '-1', 'abc', '99999', ['2', '3']]) {
      getProductReviews.mockClear();
      await renderPage({ reviews_page: value });
      expect(getProductReviews).toHaveBeenCalledTimes(1);
      expect(getProductReviews.mock.calls[0]![2]).toBe(1);
    }
  });

  it('a page past the end renders page 1', async () => {
    state.reviews = { pages: { 1: REVIEWS, 9: { ...REVIEWS, page: 9, items: [] } } };
    const html = await renderPage({ reviews_page: '9' });
    expect(getProductReviews.mock.calls.map((c) => c[2])).toEqual([9, 1]);
    const client = seen.products.at(-1) as { reviews: { page: number; items: unknown[] } };
    expect(client.reviews.page).toBe(1);
    expect(client.reviews.items).toHaveLength(1);
    expect(productLd(html)).toHaveProperty('aggregateRating');
  });

  it('a store without customer accounts gets no write link', async () => {
    state.store = { ...APP_ON, checkout: { no_customer_accounts: true } };
    await renderPage();
    const client = seen.products.at(-1) as { reviews: Record<string, unknown> };
    expect(client.reviews).not.toHaveProperty('write_href');
  });
});

describe('app on, zero approved reviews', () => {
  for (const path of PATHS) {
    it(`${path}: the empty block data, and JSON-LD identical to the app being off`, async () => {
      setPath(path);
      const off = productLd(await renderPage());
      state.store = APP_ON;
      state.reviews = NO_REVIEWS;
      const html = await renderPage();
      const client = seen.products.at(-1) as { reviews: { summary: { count: number }; items: unknown[] } };
      expect(client.reviews.summary.count).toBe(0);
      expect(client.reviews.items).toEqual([]);
      expect(JSON.stringify(productLd(html))).toBe(JSON.stringify(off));
      expect(html).not.toMatch(/aggregateRating/);
    });
  }
});
