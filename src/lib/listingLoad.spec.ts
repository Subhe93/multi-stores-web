import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProducts = vi.fn();
const getProductsPage = vi.fn();
vi.mock('./api', () => ({
  storefront: {
    getProducts: (...a: unknown[]) => getProducts(...a),
    getProductsPage: (...a: unknown[]) => getProductsPage(...a),
  },
}));

import { loadListing } from './listingLoad';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
const paged = (items: unknown[], total: number, page = 1, limit = items.length) => ({
  items,
  total,
  page,
  limit,
  has_more: page * limit < total,
  legacy: false,
});

const QUERY = { locale: 'sv', search: 'mugg', category: 'dead', creator_category: 'kok' };

beforeEach(() => {
  getProducts.mockReset();
  getProductsPage.mockReset();
});

describe('loadListing', () => {
  it('probes with page 1 and one item (no sort, no dead category)', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 3));
    getProducts.mockResolvedValueOnce(rows(3));
    await loadListing('namez-se', { queryParams: QUERY, sort: 'price_asc' }, 'se');
    expect(getProductsPage).toHaveBeenCalledTimes(1);
    expect(getProductsPage).toHaveBeenCalledWith(
      'namez-se',
      { locale: 'sv', creator_category: 'kok', search: 'mugg', page: 1, limit: 1 },
      'se',
    );
  });

  it('a failed probe falls back to today\'s request', async () => {
    getProductsPage.mockRejectedValueOnce(new Error('down'));
    getProducts.mockResolvedValueOnce(rows(5));
    const res = await loadListing('namez-se', { queryParams: QUERY }, undefined);
    expect(res).toEqual({ mode: 'legacy', products: rows(5) });
    expect(getProducts).toHaveBeenCalledWith('namez-se', QUERY, undefined);
  });

  it('an array probe (older API) is the full list: no second request', async () => {
    getProductsPage.mockResolvedValueOnce({ items: rows(80), total: 80, page: 1, limit: 80, has_more: false, legacy: true });
    const res = await loadListing('namez-se', { queryParams: QUERY, sort: 'newest' }, undefined);
    expect(res).toEqual({ mode: 'legacy', products: rows(80) });
    expect(getProductsPage).toHaveBeenCalledTimes(1);
    expect(getProducts).not.toHaveBeenCalled();
  });

  it('a total of 60 stays legacy with today\'s exact request', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 60));
    getProducts.mockResolvedValueOnce(rows(60));
    const res = await loadListing('namez-se', { queryParams: QUERY, sort: 'price_desc' }, 'se');
    expect(res).toEqual({ mode: 'legacy', products: rows(60) });
    expect(getProductsPage).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith('namez-se', QUERY, 'se');
  });

  it('a total of 61 loads the first page of 60 with the sort, nothing else', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 61));
    getProductsPage.mockResolvedValueOnce(paged(rows(60), 61, 1, 60));
    const res = await loadListing('namez-se', { queryParams: QUERY, sort: 'price_desc' }, 'se');
    expect(getProductsPage).toHaveBeenCalledTimes(2);
    expect(getProductsPage).toHaveBeenLastCalledWith(
      'namez-se',
      { locale: 'sv', creator_category: 'kok', search: 'mugg', sort: 'price_desc', page: 1, limit: 60 },
      'se',
    );
    expect(getProducts).not.toHaveBeenCalled();
    expect(res).toEqual({
      mode: 'server',
      products: rows(60),
      pagination: {
        total: 61,
        pageSize: 60,
        hasMore: true,
        request: { locale: 'sv', creator_category: 'kok', search: 'mugg', sort: 'price_desc' },
      },
    });
  });

  it('an unknown sort is the default order (not sent)', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 100));
    getProductsPage.mockResolvedValueOnce(paged(rows(60), 100, 1, 60));
    const res = await loadListing('s', { queryParams: { locale: 'ar' }, sort: 'popular' }, undefined);
    expect(getProductsPage).toHaveBeenLastCalledWith('s', { locale: 'ar', page: 1, limit: 60 }, undefined);
    expect(res.mode === 'server' && res.pagination.request).toEqual({ locale: 'ar' });
  });

  it('a first page answered as an array falls back to legacy with it', async () => {
    getProductsPage.mockResolvedValueOnce(paged(rows(1), 100));
    getProductsPage.mockResolvedValueOnce({ items: rows(100), total: 100, page: 1, limit: 100, has_more: false, legacy: true });
    const res = await loadListing('s', { queryParams: { locale: 'sv' } }, undefined);
    expect(res).toEqual({ mode: 'legacy', products: rows(100) });
  });
});
