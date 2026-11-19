import { describe, expect, it } from 'vitest';
import { readListingSettings, resolveListingSettings, LISTING_FILTER_KEYS } from './settings';
import {
  activeFilterCount,
  clearFilters,
  facetKey,
  isRefinedView,
  parseFilterState,
  toApiFilters,
  toPageQuery,
  toggleValue,
} from './query';
import { explorerPageParams } from './explorer';
import { toListingFacets } from './types';
import { localPage, type LocalSource } from './local';

describe('listing settings', () => {
  it('is null unless the store opted in with an object', () => {
    expect(readListingSettings(null)).toBeNull();
    expect(readListingSettings({})).toBeNull();
    expect(readListingSettings({ listing: true })).toBeNull();
    expect(readListingSettings({ listing: [] })).toBeNull();
  });

  it('applies the defaults to an empty object', () => {
    expect(readListingSettings({ listing: {} })).toEqual({
      filters: [...LISTING_FILTER_KEYS],
      density: 4,
      mobileDensity: 2,
      style: 'bar',
      densitySwitch: true,
    });
  });

  it('keeps known filters in the stored order, drops junk and repeats', () => {
    expect(resolveListingSettings({ filters: ['size', 'nope', 'price', 'size'], density: 3, mobile_density: 1, style: 'rail', density_switch: false })).toEqual({
      filters: ['size', 'price'],
      density: 3,
      mobileDensity: 1,
      style: 'rail',
      densitySwitch: false,
    });
    expect(resolveListingSettings({ density: 5, style: 'grid' })).toMatchObject({ density: 4, style: 'bar' });
  });
});

describe('filter state', () => {
  it('parses lists, prices and flags; folds keys like the API', () => {
    const s = parseFilterState(
      new URLSearchParams('color=Black,Navy%20Blue&color=black&size=M&price_min=300&price_max=100&in_stock=1&sort=name&search=%20hoodie%20'),
    );
    expect(s).toEqual({
      search: 'hoodie',
      collection: [],
      type: [],
      color: ['black', 'navy blue'],
      size: ['m'],
      price_min: 100,
      price_max: 300,
      in_stock: true,
      sort: 'name',
    });
    expect(facetKey(' A,B ')).toBe('a b');
  });

  it('ignores unknown sorts, bad prices and in_stock other than 1', () => {
    const s = parseFilterState({ sort: 'cheapest', price_min: '-3', in_stock: 'true' });
    expect(s.sort).toBeUndefined();
    expect(s.price_min).toBeUndefined();
    expect(s.in_stock).toBe(false);
  });

  it('folds the legacy creator_category link of /products only when asked', () => {
    expect(parseFilterState({ creator_category: 'kok' }).collection).toEqual([]);
    expect(parseFilterState({ creator_category: 'kok', collection: 'sale' }, { legacyCollection: true }).collection).toEqual(['sale', 'kok']);
  });

  it('round-trips through the page query in a fixed key order', () => {
    const s = parseFilterState({ sort: 'price_asc', size: 's,m', collection: 'new', in_stock: '1', search: 'x y' });
    const q = toPageQuery(s, { lang: 'ar' });
    expect(q).toBe('search=x+y&collection=new&size=s%2Cm&in_stock=1&sort=price_asc&lang=ar');
    expect(parseFilterState(new URLSearchParams(q))).toEqual(s);
    expect(toPageQuery(parseFilterState({}))).toBe('');
  });

  it('counts, toggles and clears', () => {
    let s = parseFilterState({ color: 'black', price_max: '50', in_stock: '1', search: 'tee', sort: 'newest' });
    expect(activeFilterCount(s)).toBe(3);
    s = toggleValue(s, 'color', 'white');
    expect(s.color).toEqual(['black', 'white']);
    s = toggleValue(s, 'color', 'black');
    expect(s.color).toEqual(['white']);
    const cleared = clearFilters(s);
    expect(activeFilterCount(cleared)).toBe(0);
    expect(cleared.search).toBe('tee');
    expect(cleared.sort).toBe('newest');
    expect(isRefinedView(cleared)).toBe(true);
    expect(isRefinedView(parseFilterState({}))).toBe(false);
  });

  it('builds the API request (filters after card, facets last)', () => {
    const state = parseFilterState({ color: 'black,white', price_min: '10', sort: 'name' });
    expect(toApiFilters(state)).toEqual({ color: 'black,white', price_min: '10' });
    expect(explorerPageParams({ locale: 'sv', baseCollection: 'kok', state, card: true, page: 2, limit: 24 })).toEqual({
      locale: 'sv',
      creator_category: 'kok',
      sort: 'name',
      page: 2,
      limit: 24,
      card: '1',
      filters: { color: 'black,white', price_min: '10' },
      facets: '1',
    });
  });
});

describe('facet answer', () => {
  it('normalises an unknown value and keeps a valid one', () => {
    expect(toListingFacets(null)).toBeNull();
    expect(toListingFacets({ color: 'x', price: { min: 1 } })).toEqual({
      collection: [],
      type: [],
      color: [],
      size: [],
      price: null,
      in_stock: { count: 0 },
    });
  });
});

describe('local (demo) listing', () => {
  const v = (Colour: string, Size: string, stock: number) => ({ options: { Colour, Size }, stock, is_active: true });
  const source: LocalSource = {
    collections: [
      { slug: 'tops', label: 'Tops' },
      { slug: 'tees', label: 'Tees', parent: 'tops' },
    ],
    rows: [
      { id: 'a', base_price: 50, translations: [{ locale: 'en', title: 'Beta tee' }], variants: [v('Black', 'M', 2), v('White', 'L', 0)], _collections: ['tops', 'tees'] },
      { id: 'b', base_price: 20, translations: [{ locale: 'en', title: 'Alpha cap' }], variants: [], track_inventory: true, stock_quantity: 0 },
      { id: 'c', base_price: 90, translations: [{ locale: 'en', title: 'Gamma coat' }], variants: [v('Black', 'L', 5)], _collections: ['tops'] },
    ],
  };
  const run = (q: Record<string, string>, page = 1, limit = 24) =>
    localPage(source, parseFilterState(q), { locale: 'en', page, limit });

  it('filters, counts and pages like the API', () => {
    const all = run({});
    expect(all.total).toBe(3);
    expect(all.facets.collection).toEqual([
      { value: 'tops', label: 'Tops', count: 2, parent: null },
      { value: 'tees', label: 'Tees', count: 1, parent: 'tops' },
    ]);
    expect(run({ color: 'white', in_stock: '1' }).total).toBe(0);
    expect(run({ size: 'l' }).items.map((r) => r.id)).toEqual(['a', 'c']);
    expect(run({ sort: 'name' }).items.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(run({ sort: 'price_desc' }, 1, 2)).toMatchObject({ total: 3, has_more: true });
    expect(run({ search: 'coat' }).items.map((r) => r.id)).toEqual(['c']);
  });
});
