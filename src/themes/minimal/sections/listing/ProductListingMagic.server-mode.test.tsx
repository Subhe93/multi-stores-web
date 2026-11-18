import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ListingContext, ListingProduct } from '../../../types';

// product-listing section in server mode (listing.pagination set): counts
// come from `total`, the status line is in the server HTML, and the
// load-more block uses logical classes only.

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));

import { productListingMagicSection, PRODUCT_LISTING_DEFAULT_SETTINGS } from './ProductListingMagic';
import { physicalClasses } from '../_shared/testHelpers';

const ProductListingMagic = productListingMagicSection.Component;

const card = (i: number): ListingProduct => ({
  id: `p${i}`,
  base_price: 10 + i,
  translations: [{ locale: 'ar', title: `منتج ${i}`, slug: `p-${i}` }],
  images: [],
});

function listing(kind: 'catalog' | 'collection', pagination?: ListingContext['pagination']): ListingContext {
  return {
    kind,
    products: [1, 2, 3].map(card),
    collections: [],
    collection: kind === 'collection' ? { id: 'c1', slug: 'kok', translations: [{ locale: 'ar', name: 'مطبخ' }] } : undefined,
    query: { sort: 'price_asc' },
    hero: { enabled: true, show_count: true },
    basePath: kind === 'collection' ? '/collections/kok' : '/products',
    isFiltered: false,
    ...(pagination ? { pagination } : {}),
  };
}

const PAGINATION = { total: 130, pageSize: 60, hasMore: true, request: { locale: 'ar', sort: 'price_asc' as const } };

const html = (l: ListingContext) =>
  renderToStaticMarkup(
    <ProductListingMagic
      settings={{ ...PRODUCT_LISTING_DEFAULT_SETTINGS }}
      content={{}}
      locale="ar"
      primaryLocale="sv"
      storeSlug="namez-se"
      currency="SEK"
      listing={l}
    />,
  );

/** The load-more block: from the status line to the end of the grid container. */
const loadMoreBlock = (out: string) => out.slice(out.indexOf('<div class="mt-10'), out.indexOf('</button>') + 9);

describe('product-listing section in server mode', () => {
  for (const kind of ['catalog', 'collection'] as const) {
    it(`${kind}: count from total, status line and button in the server HTML`, () => {
      const out = html(listing(kind, PAGINATION));
      expect(out).toContain('130 store.productsCount');
      expect(out).not.toContain('>3 store.productsCount');
      expect(out).toContain('<p role="status" aria-live="polite" class="text-sm text-gray-500">product.shownOfTotal[shown=3,total=130]</p>');
      expect(out).toMatch(/<button type="button" class="[^"]*min-h-11[^"]*"[^>]*>product\.loadMore<\/button>/);
    });
  }

  it('the ar load-more block has no physical classes', () => {
    const block = loadMoreBlock(html(listing('catalog', PAGINATION)));
    expect(block).toContain('role="status"');
    expect(block).toContain('<button');
    expect(physicalClasses(block)).toEqual([]);
  });

  it('no button on the last page, the status line stays', () => {
    const out = html(listing('catalog', { ...PAGINATION, total: 3, hasMore: false }));
    expect(out).toContain('product.shownOfTotal[shown=3,total=3]');
    expect(out).not.toContain('<button');
  });

  it('without pagination there is no load-more block', () => {
    const out = html(listing('catalog'));
    expect(out).not.toContain('role="status"');
    expect(out).not.toContain('<button');
    expect(out).toContain('3 store.productsCount');
  });
});
