import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingPagination } from '@/lib/listingPaging';
import type { ListingProduct } from '@/themes/types';

// "Load more" of a server-paginated listing: useListingPages + ListingLoadMore
// through the built-in grid.

const getProductsPage = vi.fn();
const market = { current: null as { key: string; preview?: boolean } | null };

vi.mock('@/lib/api', () => ({
  storefront: { getProductsPage: (...a: unknown[]) => getProductsPage(...a) },
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => market.current }));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));

import { ListingPagedGrid } from './ListingPagedGrid';
import { useListingPages } from '@/hooks/useListingPages';

const row = (i: number) => ({
  id: `p${i}`,
  base_price: String(10 + i),
  tax_rate_bp: 2500,
  translations: [{ locale: 'sv', title: `Produkt ${i}`, slug: `produkt-${i}`, description: '<p>x</p>' }],
  images: [{ url: `/uploads/${i}.jpg` }, { url: '/uploads/second.jpg' }],
});
const card = (i: number): ListingProduct => ({
  id: `p${i}`,
  base_price: 10 + i,
  tax_rate_bp: 2500,
  translations: [{ locale: 'sv', title: `Produkt ${i}`, slug: `produkt-${i}` }],
  images: [{ url: `/uploads/${i}.jpg` }],
});
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => from + k);

const PAGINATION: ListingPagination = {
  total: 7,
  pageSize: 3,
  hasMore: true,
  request: { locale: 'sv', creator_category: 'kok', sort: 'price_asc' },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const page = (ids: number[], total: number, pageNo: number, hasMore: boolean) => ({
  items: ids.map(row),
  total,
  page: pageNo,
  limit: 3,
  has_more: hasMore,
  legacy: false,
});

function renderGrid(pagination: ListingPagination = PAGINATION, initial = range(0, 3).map(card)) {
  return render(
    <ListingPagedGrid
      storeSlug="namez-se"
      initial={initial}
      pagination={pagination}
      locale="sv"
      lp=""
      currency="SEK"
      gridClassName="grid grid-cols-2"
      variant="catalog"
    />,
  );
}

const cardLinks = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));
const status = () => screen.getByRole('status').textContent;
const button = () => screen.queryByRole('button');

beforeEach(() => {
  getProductsPage.mockReset();
  market.current = null;
});

describe('server-paginated grid', () => {
  it('renders the first page with the status line and the button', () => {
    renderGrid();
    expect(cardLinks()).toEqual(['/products/produkt-0', '/products/produkt-1', '/products/produkt-2']);
    expect(status()).toBe('product.shownOfTotal[shown=3,total=7]');
    expect(button()?.textContent).toBe('product.loadMore');
    expect(button()).not.toHaveAttribute('aria-busy');
    expect(button()).not.toHaveAttribute('disabled');
  });

  it('appends the next page with the same filters, page size and market', async () => {
    market.current = { key: 'se', preview: true };
    getProductsPage.mockResolvedValueOnce(page([3, 4, 5], 7, 2, true));
    renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(6));
    expect(getProductsPage).toHaveBeenCalledWith(
      'namez-se',
      { locale: 'sv', creator_category: 'kok', sort: 'price_asc', page: 2, limit: 3 },
      { key: 'se', preview: true },
    );
    expect(status()).toBe('product.shownOfTotal[shown=6,total=7]');
    // Focus moves to the first new card.
    expect(document.activeElement?.getAttribute('href')).toBe('/products/produkt-3');
  });

  it('busy while loading (never disabled), extra clicks ignored', async () => {
    const d = deferred<unknown>();
    getProductsPage.mockReturnValueOnce(d.promise);
    renderGrid();
    fireEvent.click(button()!);
    expect(button()).toHaveAttribute('aria-busy', 'true');
    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(button()).not.toHaveAttribute('disabled');
    expect(button()?.textContent).toBe('product.loadingMore');
    fireEvent.click(button()!);
    fireEvent.click(button()!);
    expect(getProductsPage).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve(page([3, 4, 5], 7, 2, true)));
    expect(button()).not.toHaveAttribute('aria-busy');
    expect(button()?.textContent).toBe('product.loadMore');
  });

  it('de-duplicates by id and takes the new total', async () => {
    // A product was added meanwhile: page 2 repeats p2.
    getProductsPage.mockResolvedValueOnce(page([2, 3, 4], 8, 2, true));
    renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(5));
    expect(cardLinks()).toEqual(range(0, 5).map((i) => `/products/produkt-${i}`));
    expect(status()).toBe('product.shownOfTotal[shown=5,total=8]');
  });

  it('the button disappears on the last page', async () => {
    getProductsPage.mockResolvedValueOnce(page([3, 4, 5], 7, 2, true));
    getProductsPage.mockResolvedValueOnce(page([6], 7, 3, false));
    renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(6));
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(7));
    expect(getProductsPage).toHaveBeenLastCalledWith('namez-se', expect.objectContaining({ page: 3 }), undefined);
    expect(button()).toBeNull();
    expect(status()).toBe('product.shownOfTotal[shown=7,total=7]');
    expect(document.activeElement?.getAttribute('href')).toBe('/products/produkt-6');
  });

  it('an error shows an alert and the button retries the same page', async () => {
    getProductsPage.mockRejectedValueOnce(new Error('down'));
    getProductsPage.mockResolvedValueOnce(page([3, 4, 5], 7, 2, true));
    renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('product.loadMoreError'));
    expect(cardLinks()).toHaveLength(3);
    expect(button()).not.toHaveAttribute('aria-busy');
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(6));
    expect(getProductsPage).toHaveBeenNthCalledWith(2, 'namez-se', expect.objectContaining({ page: 2 }), undefined);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a legacy (array) answer replaces the list with every item and ends paging', async () => {
    getProductsPage.mockResolvedValueOnce({ items: range(0, 7).map(row), total: 7, page: 1, limit: 7, has_more: false, legacy: true });
    renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(7));
    expect(button()).toBeNull();
    expect(status()).toBe('product.shownOfTotal[shown=7,total=7]');
  });

  it('a new sort resets the appended pages', async () => {
    getProductsPage.mockResolvedValueOnce(page([3, 4, 5], 7, 2, true));
    const view = renderGrid();
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(6));
    const sorted = { ...PAGINATION, request: { ...PAGINATION.request, sort: 'price_desc' as const } };
    view.rerender(
      <ListingPagedGrid
        storeSlug="namez-se"
        initial={[6, 5, 4].map(card)}
        pagination={sorted}
        locale="sv"
        lp=""
        currency="SEK"
        gridClassName="grid grid-cols-2"
        variant="catalog"
      />,
    );
    expect(cardLinks()).toEqual(['/products/produkt-6', '/products/produkt-5', '/products/produkt-4']);
    expect(status()).toBe('product.shownOfTotal[shown=3,total=7]');
    getProductsPage.mockResolvedValueOnce(page([3, 2, 1], 7, 2, true));
    fireEvent.click(button()!);
    await waitFor(() => expect(cardLinks()).toHaveLength(6));
    expect(getProductsPage).toHaveBeenLastCalledWith(
      'namez-se',
      { locale: 'sv', creator_category: 'kok', sort: 'price_desc', page: 2, limit: 3 },
      undefined,
    );
  });

  it('an answer for a previous sort is ignored', async () => {
    const d = deferred<unknown>();
    getProductsPage.mockReturnValueOnce(d.promise);
    const view = renderGrid();
    fireEvent.click(button()!);
    const sorted = { ...PAGINATION, request: { ...PAGINATION.request, sort: 'newest' as const } };
    view.rerender(
      <ListingPagedGrid
        storeSlug="namez-se"
        initial={[9, 8, 7].map(card)}
        pagination={sorted}
        locale="sv"
        lp=""
        currency="SEK"
        gridClassName="grid grid-cols-2"
        variant="catalog"
      />,
    );
    await act(async () => d.resolve(page([3, 4, 5], 7, 2, true)));
    expect(cardLinks()).toEqual(['/products/produkt-9', '/products/produkt-8', '/products/produkt-7']);
    expect(button()).not.toHaveAttribute('aria-busy');
  });

  it('collection variant keeps the sizes / priority / eager rules', () => {
    const { container } = render(
      <ListingPagedGrid
        storeSlug="namez-se"
        initial={range(0, 5).map(card)}
        pagination={{ ...PAGINATION, total: 70 }}
        locale="sv"
        lp="/ar"
        currency="SEK"
        gridClassName="grid"
        variant="collection"
        priorityFirst
      />,
    );
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs[0]).toHaveAttribute('sizes', '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw');
    // Priority cards are preloaded (no loading attribute), the next two eager.
    expect(imgs.map((i) => i.getAttribute('loading'))).toEqual([null, null, 'eager', 'eager', 'lazy']);
    expect(imgs.map((i) => i.getAttribute('fetchpriority'))).toEqual(['high', 'high', null, null, null]);
    expect(cardLinks()[0]).toBe('/ar/products/produkt-0');
  });
});

describe('useListingPages without pagination', () => {
  it('returns the initial list by reference and never fetches', () => {
    const initial = range(0, 3).map(card);
    const { result } = renderHook(() => useListingPages({ storeSlug: 'namez-se', initial }));
    expect(result.current.products).toBe(initial);
    expect(result.current.total).toBe(3);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(getProductsPage).not.toHaveBeenCalled();
    expect(result.current.products).toBe(initial);
  });
});
