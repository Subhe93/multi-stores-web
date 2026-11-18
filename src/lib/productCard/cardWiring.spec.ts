import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProducts = vi.fn();
const getProductsPage = vi.fn();
vi.mock('@/lib/api', () => ({
  storefront: {
    getProducts: (...a: unknown[]) => getProducts(...a),
    getProductsPage: (...a: unknown[]) => getProductsPage(...a),
    getProduct: vi.fn(),
  },
}));

import { loadListing } from '@/lib/listingLoad';
import { preloadSectionData } from '@/lib/preloadSections';
import type { SectionInstance } from '@/themes/types';
import { cardQuery, resolveProductCard } from './settings';

// The card flag through the listing loader and the section preload.

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
const paged = (items: unknown[], total: number, page = 1, limit = items.length) => ({
  items,
  total,
  page,
  limit,
  has_more: page * limit < total,
  legacy: false,
});
const SETTINGS = resolveProductCard({ style: 'editorial' });

beforeEach(() => {
  getProducts.mockReset();
  getProductsPage.mockReset();
});

describe('loadListing with card settings', () => {
  const query = { locale: 'sv', creator_category: 'kok', ...cardQuery(SETTINGS) };

  it('legacy mode sends the route request as is (card last); the probe only counts', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 9));
    getProducts.mockResolvedValueOnce(rows(9));
    await loadListing('demo', { queryParams: query }, 'se');
    expect(getProductsPage).toHaveBeenCalledWith('demo', { locale: 'sv', creator_category: 'kok', page: 1, limit: 1 }, 'se');
    expect(getProducts).toHaveBeenCalledWith('demo', { locale: 'sv', creator_category: 'kok', card: '1' }, 'se');
    expect(Object.keys(getProducts.mock.calls[0][1] as object).at(-1)).toBe('card');
  });

  it('server mode asks the first page with card and keeps it out of the shared request', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 200)).mockResolvedValueOnce(paged(rows(60), 200, 1, 60));
    const res = await loadListing('demo', { queryParams: query, sort: 'newest' }, undefined);
    expect(getProductsPage).toHaveBeenLastCalledWith(
      'demo',
      { locale: 'sv', creator_category: 'kok', sort: 'newest', page: 1, limit: 60, card: '1' },
      undefined,
    );
    expect(res.mode).toBe('server');
    if (res.mode === 'server') {
      expect(res.pagination.request).toEqual({ locale: 'sv', creator_category: 'kok', sort: 'newest' });
    }
  });

  it('server mode without settings asks the first page as before', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 200)).mockResolvedValueOnce(paged(rows(60), 200, 1, 60));
    await loadListing('demo', { queryParams: { locale: 'sv', ...cardQuery(null) } }, undefined);
    expect(getProductsPage).toHaveBeenLastCalledWith('demo', { locale: 'sv', page: 1, limit: 60 }, undefined);
  });
});

describe('preloadSectionData with card settings', () => {
  const sections = [
    { id: 's1', section_key: 'featured-products', settings: { limit: 4 }, is_hidden: false, sort_order: 0, translations: [] },
  ] as unknown as SectionInstance[];

  it('adds card=1 last to the section request', async () => {
    getProducts.mockResolvedValueOnce(rows(4));
    await preloadSectionData('demo', sections, { locale: 'sv', card: SETTINGS });
    expect(getProducts).toHaveBeenCalledWith('demo', { locale: 'sv', limit: '4', card: '1' }, undefined);
    expect(Object.keys(getProducts.mock.calls[0][1] as object).at(-1)).toBe('card');
  });

  it('sends the request of before without settings', async () => {
    getProducts.mockResolvedValue(rows(4));
    await preloadSectionData('demo', sections, { locale: 'sv' });
    await preloadSectionData('demo', sections, { locale: 'sv', card: null });
    expect(getProducts.mock.calls[0][1]).toEqual({ locale: 'sv', limit: '4' });
    expect(getProducts.mock.calls[1][1]).toEqual({ locale: 'sv', limit: '4' });
  });
});
