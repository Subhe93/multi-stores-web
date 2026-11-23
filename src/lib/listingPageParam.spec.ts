import { describe, expect, it } from 'vitest';
import {
  buildListingPager,
  isListingPageOutOfRange,
  listingBaseQuery,
  listingPageCanonical,
  listingPageHref,
  listingTotalPages,
  parseListingPage,
} from './listingPageParam';

describe('parseListingPage', () => {
  it('absent = page 1; canonical N > 1 = that page', () => {
    expect(parseListingPage(undefined)).toEqual({ page: 1 });
    expect(parseListingPage(null)).toEqual({ page: 1 });
    expect(parseListingPage('2')).toEqual({ page: 2 });
    expect(parseListingPage('9999')).toEqual({ page: 9999 });
  });

  it('every other value asks for the clean URL', () => {
    for (const v of ['1', '01', '0', '-1', '2.5', 'abc', '', ' 2', '10000', '1e3']) {
      expect(parseListingPage(v)).toEqual({ redirect: true });
    }
    expect(parseListingPage(['2', '3'])).toEqual({ redirect: true });
  });
});

describe('listingTotalPages / isListingPageOutOfRange', () => {
  it('counts pages, at least one', () => {
    expect(listingTotalPages(34, 24)).toBe(2);
    expect(listingTotalPages(24, 24)).toBe(1);
    expect(listingTotalPages(0, 24)).toBe(1);
    expect(listingTotalPages(61, 60)).toBe(2);
  });

  it('page beyond the last is out of range', () => {
    expect(isListingPageOutOfRange(2, 34, 24)).toBe(false);
    expect(isListingPageOutOfRange(3, 34, 24)).toBe(true);
    expect(isListingPageOutOfRange(2, 0, 24)).toBe(true);
  });
});

describe('listingPageHref', () => {
  it('sets page last and drops it for page 1', () => {
    const base = { path: '/products', query: 'sort=price_asc' };
    expect(listingPageHref(base, 2)).toBe('/products?sort=price_asc&page=2');
    expect(listingPageHref(base, 1)).toBe('/products?sort=price_asc');
    expect(listingPageHref({ path: '/products', query: '' }, 1)).toBe('/products');
  });

  it('keeps the market / locale prefix and drops page and lang from the query', () => {
    expect(listingPageHref({ path: '/de-de/products', query: 'page=7&lang=de' }, 3)).toBe('/de-de/products?page=3');
    expect(listingPageHref({ path: '/ar/collections/kok', query: '' }, 2)).toBe('/ar/collections/kok?page=2');
  });

  it('keeps filter lists readable', () => {
    expect(listingPageHref({ path: '/products', query: 'color=black%2Cnavy&in_stock=1' }, 2)).toBe(
      '/products?color=black,navy&in_stock=1&page=2',
    );
  });
});

describe('listingBaseQuery', () => {
  it('only the given keys, in their order, without page and lang', () => {
    expect(
      listingBaseQuery({ sort: 'newest', lang: 'ar', search: 'mugg', page: '2', utm: 'x' }, ['search', 'sort', 'page', 'lang']),
    ).toBe('search=mugg&sort=newest');
    expect(listingBaseQuery({ search: '' }, ['search'])).toBe('');
  });
});

describe('buildListingPager', () => {
  const base = { path: '/products', query: '' };

  it('page 1 of 2: next only', () => {
    const p = buildListingPager(base, 1, 1, 2);
    expect(p.prevHref).toBeUndefined();
    expect(p.nextHref).toBe('/products?page=2');
    expect(p.items).toEqual([
      { page: 1, href: '/products', current: true },
      { page: 2, href: '/products?page=2', current: false },
    ]);
  });

  it('page 2 of 2: prev only', () => {
    const p = buildListingPager(base, 2, 2, 2);
    expect(p.prevHref).toBe('/products');
    expect(p.nextHref).toBeUndefined();
  });

  it('load more extends the shown range; gaps in a long list', () => {
    const p = buildListingPager(base, 5, 6, 20);
    expect(p.prevHref).toBe('/products?page=4');
    expect(p.nextHref).toBe('/products?page=7');
    expect(p.items.map((i) => (i ? i.page : null))).toEqual([1, null, 4, 5, 6, 7, null, 20]);
    expect(p.items.filter((i) => i?.current).map((i) => i!.page)).toEqual([5, 6]);
  });
});

describe('listingPageCanonical', () => {
  it('page N > 1 is the page itself', () => {
    expect(listingPageCanonical('https://namez.se/products', 2)).toBe('https://namez.se/products?page=2');
    expect(listingPageCanonical('https://namez.se/products', 1)).toBe('https://namez.se/products');
  });
});
