import { describe, expect, it } from 'vitest';
import { LISTING_PAGE_SIZE, LISTING_SERVER_THRESHOLD, listingApiSort } from './listingPaging';

describe('listing paging constants', () => {
  it('threshold is 60 and the page size equals it', () => {
    expect(LISTING_SERVER_THRESHOLD).toBe(60);
    expect(LISTING_PAGE_SIZE).toBe(LISTING_SERVER_THRESHOLD);
  });

  it('a page fills whole rows for 1 to 6 columns', () => {
    for (let cols = 1; cols <= 6; cols++) expect(LISTING_PAGE_SIZE % cols).toBe(0);
  });

  it('the page size stays below the API cap of 100', () => {
    expect(LISTING_PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});

describe('listingApiSort', () => {
  it('maps the three storefront sorts to themselves', () => {
    expect(listingApiSort('price_asc')).toBe('price_asc');
    expect(listingApiSort('price_desc')).toBe('price_desc');
    expect(listingApiSort('newest')).toBe('newest');
  });

  it('anything else is the default order', () => {
    for (const v of [undefined, null, '', 'name', 'popular', 'PRICE_ASC', ['newest'], 1]) {
      expect(listingApiSort(v)).toBeUndefined();
    }
  });
});
