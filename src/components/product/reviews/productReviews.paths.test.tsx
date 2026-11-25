import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductReviewsData } from '@/lib/reviews';
import { withReviews } from '@/lib/reviews';
import type { ProductContext, SectionRenderProps } from '@/themes/types';

// M171 on the product render paths: the four title components show the stars
// line and the product components show the reviews block, only from
// `product.reviews`. Without that key every component renders exactly the
// HTML of a product that never heard of reviews (regression guard).

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/mug',
  useParams: () => ({ storeSlug: 'demo' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { rich: (k: string) => k, markup: (k: string) => k, raw: (k: string) => k, has: () => true },
  );
  return { useLocale: () => 'en', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock('@/lib/storeMedia', () => ({
  responsiveImgProps: (src: string) => ({ src }),
  isSvgSrc: (src: string) => src.endsWith('.svg'),
  optimizedImageUrl: (src: string) => src,
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { FocusedProductLayout } from '@/components/product/focused/FocusedProductLayout';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductTitleBlock } from '@/themes/minimal/sections/product/blocks/ProductTitleBlock.client';
import { ProductDetailsMagic } from '@/themes/minimal/sections/product/ProductDetailsMagic.client';

const product: ProductData = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Long</p>', short_description: '<p>Short</p>' }],
  images: [{ id: 'i1', url: 'https://cdn.test/a.jpg' }],
  vendor: { company_name: 'Acme' },
  variants: [],
};

const reviews = (over: Partial<ProductReviewsData> = {}): ProductReviewsData => ({
  summary: { average: 4.6, count: 12, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 8 } },
  items: [
    {
      id: 'r1',
      rating: 5,
      title: null,
      body: 'Lovely mug.',
      display_name: 'Anna S.',
      locale: 'en',
      verified: true,
      published_at: '2026-11-20T10:12:00.000Z',
      reply: null,
    },
  ],
  page: 1,
  total_pages: 1,
  slot: 'inline',
  base_path: '/products/mug',
  base_query: '',
  ...over,
});

const NO_APPROVED = reviews({
  summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  items: [],
  total_pages: 0,
});

function sectionProps(p: ProductData): SectionRenderProps {
  return {
    settings: {},
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: p as unknown as ProductContext,
    currency: 'SEK',
  };
}

function inState(p: ProductData, node: ReactNode) {
  return (
    <ProductPageStateProvider product={p} locale="en" primaryLocale="en" currency="SEK">
      {node}
    </ProductPageStateProvider>
  );
}

// One renderer per path; each takes the product it is given.
const PATHS: Record<string, (p: ProductData) => string> = {
  'built-in / monolith (ProductDetailClient)': (p) =>
    renderToString(<ProductDetailClient product={p} locale="en" primaryLocale="en" currency="SEK" />),
  'focused (FocusedProductLayout)': (p) => renderToString(inState(p, <FocusedProductLayout storeSlug="demo" />)),
  'template block (ProductTitleBlock)': (p) => renderToString(inState(p, <ProductTitleBlock {...sectionProps(p)} />)),
  'template section (ProductDetailsMagic)': (p) => renderToString(inState(p, <ProductDetailsMagic {...sectionProps(p)} />)),
};

const RATING_LINE = 'data-product-rating-line';
const BLOCK = 'data-product-reviews';

describe('product render paths without reviews', () => {
  for (const [name, renderPath] of Object.entries(PATHS)) {
    it(`${name}: no stars line, no block, same HTML as before`, () => {
      const html = renderPath(product);
      expect(html).not.toContain(RATING_LINE);
      expect(html).not.toContain(BLOCK);
      expect(html).not.toContain('id="reviews"');
      expect(html).not.toContain('data-star-rating');
      // `withReviews` without data hands back the same product: same HTML.
      expect(renderPath(withReviews(product, null))).toBe(html);
      expect(renderPath({ ...product, reviews: undefined })).toBe(html);
    });
  }
});

describe('product render paths with approved reviews', () => {
  for (const [name, renderPath] of Object.entries(PATHS)) {
    it(`${name}: the stars line sits right after the <h1>`, () => {
      const html = renderPath(withReviews(product, reviews()));
      expect(html.match(new RegExp(RATING_LINE, 'g')) ?? []).toHaveLength(1);
      const afterTitle = html.slice(html.indexOf('</h1>') + '</h1>'.length);
      expect(afterTitle.startsWith('<a href="#reviews"')).toBe(true);
      expect(html).toContain('ratingLine:{&quot;value&quot;:&quot;4.6&quot;,&quot;count&quot;:12}');
    });
  }

  it('the product components render the block exactly once (slot inline)', () => {
    for (const name of ['built-in / monolith (ProductDetailClient)', 'focused (FocusedProductLayout)']) {
      const html = PATHS[name]!(withReviews(product, reviews()));
      expect(html.match(new RegExp(BLOCK, 'g')) ?? [], name).toHaveLength(1);
      expect(html, name).toContain('id="reviews"');
      expect(html, name).toContain('Lovely mug.');
    }
  });

  it('slot append: the product component leaves the block to the route (never twice)', () => {
    for (const name of ['built-in / monolith (ProductDetailClient)', 'focused (FocusedProductLayout)']) {
      const html = PATHS[name]!(withReviews(product, reviews({ slot: 'append' })));
      expect(html, name).not.toContain(BLOCK);
      // The stars line still links to the appended block.
      expect(html, name).toContain(RATING_LINE);
    }
  });

  it('title blocks never render the block themselves', () => {
    for (const name of ['template block (ProductTitleBlock)', 'template section (ProductDetailsMagic)']) {
      expect(PATHS[name]!(withReviews(product, reviews())), name).not.toContain(BLOCK);
    }
  });
});

describe('app on, zero approved reviews', () => {
  it('no stars line anywhere; the product components show only the empty block', () => {
    for (const [name, renderPath] of Object.entries(PATHS)) {
      const html = renderPath(withReviews(product, NO_APPROVED));
      expect(html, name).not.toContain(RATING_LINE);
      expect(html, name).not.toContain('data-star-rating');
    }
    const html = PATHS['built-in / monolith (ProductDetailClient)']!(withReviews(product, NO_APPROVED));
    expect(html).toContain('data-reviews-empty');
    expect(html).not.toContain('data-reviews-summary');
  });
});
