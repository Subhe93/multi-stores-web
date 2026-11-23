import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerInit } from '@/lib/listingFilters/explorer';
import { resolveListingSettings } from '@/lib/listingFilters/settings';
import { parseFilterState } from '@/lib/listingFilters/query';
import type { ListingFacets } from '@/lib/listingFilters/types';

// Filtered product listing: server first page, browser requests on change,
// URL state, back button, chips, empty state and the phone sheet.

const getProductsPage = vi.fn();
vi.mock('@/lib/api', () => ({
  storefront: { getProductsPage: (...a: unknown[]) => getProductsPage(...a) },
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => ({ key: 'eu' }) }));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));

import { ListingExplorer } from './ListingExplorer.client';

const FACETS: ListingFacets = {
  collection: [
    { value: 'tops', label: 'Tops', count: 2, parent: null },
    { value: 'bags', label: 'Bags', count: 1, parent: null },
  ],
  type: [],
  color: [
    { value: 'black', label: 'Black', count: 2 },
    { value: 'sand', label: 'Sand', count: 0, swatch: '#d8c6a5' },
  ],
  size: [
    { value: 's', label: 'S', count: 1 },
    { value: 'm', label: 'M', count: 2 },
  ],
  price: { min: 10, max: 90 },
  in_stock: { count: 3 },
};

const row = (i: number) => ({
  id: `p${i}`,
  base_price: 10 * i,
  translations: [{ locale: 'en', title: `Product ${i}`, slug: `product-${i}` }],
  images: [{ url: `/u/${i}.jpg` }],
});

function init(over: Partial<ExplorerInit> = {}): ExplorerInit {
  return {
    storeSlug: 'shop',
    locale: 'en',
    lp: '',
    fallbackLocale: 'en',
    basePath: '/products',
    kind: 'catalog',
    currency: 'SEK',
    settings: resolveListingSettings({})!,
    state: parseFilterState({}),
    products: [1, 2, 3].map((i) => ({ ...row(i), base_price: 10 * i })),
    total: 3,
    hasMore: false,
    facets: FACETS,
    card: false,
    ...over,
  };
}

const page = (ids: number[], total: number, facets: ListingFacets = FACETS) => ({
  items: ids.map(row),
  total,
  page: 1,
  limit: 24,
  has_more: false,
  legacy: false,
  facets,
});

beforeEach(() => {
  getProductsPage.mockReset();
  window.history.replaceState(null, '', '/products?lang=sv');
  vi.useRealTimers();
});

describe('ListingExplorer', () => {
  it('renders the server page with its count, filters and sort, without a request', () => {
    render(<ListingExplorer init={init()} />);
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('status').textContent).toBe('listing.results[count=3]');
    // Desktop dropdown triggers in the store's order.
    const triggers = screen.getAllByRole('button', { expanded: false }).map((b) => b.textContent);
    expect(triggers).toEqual(['listing.collection', 'listing.price', 'listing.availability', 'listing.color', 'listing.size']);
    expect(screen.getByRole('combobox')).toHaveProperty('value', '');
    expect(getProductsPage).not.toHaveBeenCalled();
  });

  it('a filter change updates the URL and fetches the first page with facets', async () => {
    getProductsPage.mockResolvedValue(page([2], 1));
    render(<ListingExplorer init={init()} />);
    fireEvent.click(screen.getByRole('button', { name: 'listing.color' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'listing.optionWithCount[label=Black,count=2]' }));
    // Other query keys of the page (lang) are kept.
    expect(window.location.search).toBe('?lang=sv&color=black');
    await waitFor(() => expect(getProductsPage).toHaveBeenCalledTimes(1));
    expect(getProductsPage).toHaveBeenCalledWith(
      'shop',
      expect.objectContaining({ locale: 'en', page: 1, limit: 24, filters: { color: 'black' }, facets: '1' }),
      { key: 'eu' },
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('listing.results[count=1]'));
    expect(screen.getByRole('group', { name: 'listing.activeFilters' }).textContent).toContain('Black');
  });

  it('a value with no product is disabled; a chip removes its filter', async () => {
    getProductsPage.mockResolvedValue(page([1, 2, 3], 3));
    window.history.replaceState(null, '', '/products?lang=sv&size=m&in_stock=1');
    render(<ListingExplorer init={init({ state: parseFilterState({ size: 'm', in_stock: '1' }) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'listing.color' }));
    expect(screen.getByRole('checkbox', { name: 'listing.optionWithCount[label=Sand,count=0]' })).toHaveProperty('disabled', true);
    const chips = screen.getByRole('group', { name: 'listing.activeFilters' });
    fireEvent.click(within(chips).getByRole('button', { name: 'listing.removeFilter[label=M]' }));
    expect(window.location.search).toBe('?lang=sv&in_stock=1');
    await waitFor(() => expect(getProductsPage).toHaveBeenCalled());
  });

  it('the back button restores the previous filters', async () => {
    getProductsPage.mockResolvedValue(page([1], 1));
    render(<ListingExplorer init={init()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'price_desc' } });
    expect(window.location.search).toBe('?lang=sv&sort=price_desc');
    await waitFor(() => expect(getProductsPage).toHaveBeenCalledTimes(1));
    act(() => {
      window.history.replaceState(null, '', '/products?lang=sv');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(getProductsPage).toHaveBeenCalledTimes(2));
    expect(getProductsPage.mock.calls[1][1]).not.toHaveProperty('sort');
    expect(screen.getByRole('combobox')).toHaveProperty('value', '');
  });

  it('shows the empty state with a reset when nothing matches', async () => {
    getProductsPage.mockResolvedValue(page([], 0));
    window.history.replaceState(null, '', '/products?lang=sv&color=black&size=s');
    render(<ListingExplorer init={init({ products: [], total: 0, state: parseFilterState({ color: 'black', size: 's' }) })} />);
    expect(screen.getByText('listing.emptyTitle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'listing.resetFilters' }));
    expect(window.location.search).toBe('?lang=sv');
    await waitFor(() => expect(getProductsPage).toHaveBeenCalled());
  });

  it('the phone sheet edits a draft, previews its count and applies it', async () => {
    getProductsPage.mockResolvedValue(page([1], 1));
    render(<ListingExplorer init={init()} />);
    fireEvent.click(screen.getByRole('button', { name: /listing\.filters/ }));
    const dialog = screen.getByRole('dialog', { name: 'listing.filters' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('listing.close');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'listing.optionWithCount[label=Bags,count=1]' }));
    // The draft does not touch the URL or the grid…
    expect(window.location.search).toBe('?lang=sv');
    // …but previews its count with a one-product request.
    await waitFor(() => expect(within(dialog).getByText('listing.showResults[count=1]')).toBeTruthy());
    expect(getProductsPage.mock.calls[0][1]).toMatchObject({ limit: 1, filters: { collection: 'bags' } });
    fireEvent.click(within(dialog).getByText('listing.showResults[count=1]'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.search).toBe('?lang=sv&collection=bags');
    await waitFor(() => expect(getProductsPage).toHaveBeenCalledTimes(2));
  });

  it('Escape closes the sheet', () => {
    render(<ListingExplorer init={init()} />);
    fireEvent.click(screen.getByRole('button', { name: /listing\.filters/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('on mount the address bar wins over a restored first render', async () => {
    getProductsPage.mockResolvedValue(page([3], 1));
    window.history.replaceState(null, '', '/products?lang=sv&color=black');
    render(<ListingExplorer init={init()} />);
    await waitFor(() => expect(getProductsPage).toHaveBeenCalledTimes(1));
    expect(getProductsPage.mock.calls[0][1]).toMatchObject({ filters: { color: 'black' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('listing.results[count=1]'));
  });

  it('without facets (older API) it shows no filter controls', () => {
    render(<ListingExplorer init={init({ facets: null })} />);
    expect(screen.queryByRole('button', { name: /listing\.filters/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'listing.color' })).toBeNull();
  });
});
