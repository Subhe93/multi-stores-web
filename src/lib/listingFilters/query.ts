// Filter state of the filtered product listing: what the shopper chose, as
// it lives in the page URL (shareable, back button) and as it is sent to the
// API. Pure module, shared by the routes and the browser.
//
// Page URL (every key optional, values are facet keys, lists comma joined):
//   search, collection, type, color, size, price_min, price_max, in_stock=1, sort
// The API takes the same names (GET /storefront/:slug/products, see the
// API's product-list-facets.ts), plus `facets=1`.

/** Sort values the filtered listing offers ('' = the store's own order). */
export const EXPLORER_SORTS = ['newest', 'price_asc', 'price_desc', 'name'] as const;
export type ExplorerSort = (typeof EXPLORER_SORTS)[number];

export interface FilterState {
  search?: string;
  collection: string[];
  type: string[];
  color: string[];
  size: string[];
  price_min?: number;
  price_max?: number;
  in_stock: boolean;
  sort?: ExplorerSort;
}

export type ListFacetKey = 'collection' | 'type' | 'color' | 'size';
export const LIST_FACET_KEYS: readonly ListFacetKey[] = ['collection', 'type', 'color', 'size'];

const MAX_VALUES = 30;

/** Match key of a facet value: the API's `facetKey`, kept identical. */
export function facetKey(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function all(params: RawParams, key: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(key);
  const v = params[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function first(params: RawParams, key: string): string | undefined {
  return all(params, key)[0];
}

function list(params: RawParams, key: string): string[] {
  const out: string[] = [];
  for (const raw of all(params, key)) {
    for (const part of raw.split(',')) {
      const k = facetKey(part);
      if (k && k.length <= 80 && !out.includes(k)) out.push(k);
    }
  }
  return out.slice(0, MAX_VALUES);
}

function price(params: RawParams, key: string): number | undefined {
  const v = first(params, key)?.trim();
  return v && /^\d{1,9}(\.\d{1,2})?$/.test(v) ? Number(v) : undefined;
}

/**
 * The state of a page URL. `legacyCollection` folds the older single
 * `creator_category` link of /products into the collection filter.
 */
export function parseFilterState(params: RawParams, opts: { legacyCollection?: boolean } = {}): FilterState {
  const collection = list(params, 'collection');
  if (opts.legacyCollection) {
    for (const k of list(params, 'creator_category')) if (!collection.includes(k)) collection.push(k);
  }
  let price_min = price(params, 'price_min');
  let price_max = price(params, 'price_max');
  if (price_min !== undefined && price_max !== undefined && price_min > price_max) {
    [price_min, price_max] = [price_max, price_min];
  }
  const search = first(params, 'search')?.trim().slice(0, 120) || undefined;
  const sortRaw = first(params, 'sort');
  const sort = (EXPLORER_SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as ExplorerSort) : undefined;
  return {
    ...(search ? { search } : {}),
    collection,
    type: list(params, 'type'),
    color: list(params, 'color'),
    size: list(params, 'size'),
    ...(price_min !== undefined ? { price_min } : {}),
    ...(price_max !== undefined ? { price_max } : {}),
    in_stock: first(params, 'in_stock') === '1',
    ...(sort ? { sort } : {}),
  };
}

export const EMPTY_FILTERS: FilterState = { collection: [], type: [], color: [], size: [], in_stock: false };

/** Number of active filters (each value counts; the price range counts once). */
export function activeFilterCount(s: FilterState): number {
  return (
    s.collection.length +
    s.type.length +
    s.color.length +
    s.size.length +
    (s.price_min !== undefined || s.price_max !== undefined ? 1 : 0) +
    (s.in_stock ? 1 : 0)
  );
}

/** Any filter, search or sort: the view is not the plain listing (noindex). */
export function isRefinedView(s: FilterState): boolean {
  return activeFilterCount(s) > 0 || !!s.search || !!s.sort;
}

/** The filters cleared; search and sort are kept. */
export function clearFilters(s: FilterState): FilterState {
  return { ...EMPTY_FILTERS, ...(s.search ? { search: s.search } : {}), ...(s.sort ? { sort: s.sort } : {}) };
}

export function toggleValue(s: FilterState, key: ListFacetKey, value: string): FilterState {
  const cur = s[key];
  return { ...s, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
}

/** Query string of the page URL in a fixed key order ('' when plain). */
export function toPageQuery(s: FilterState, extra: { lang?: string } = {}): string {
  const p = new URLSearchParams();
  if (s.search) p.set('search', s.search);
  for (const k of LIST_FACET_KEYS) if (s[k].length) p.set(k, s[k].join(','));
  if (s.price_min !== undefined) p.set('price_min', String(s.price_min));
  if (s.price_max !== undefined) p.set('price_max', String(s.price_max));
  if (s.in_stock) p.set('in_stock', '1');
  if (s.sort) p.set('sort', s.sort);
  if (extra.lang) p.set('lang', extra.lang);
  return p.toString();
}

/** The filter part of an API request (same names; absent = not sent). */
export interface ApiFilterParams {
  collection?: string;
  type?: string;
  color?: string;
  size?: string;
  price_min?: string;
  price_max?: string;
  in_stock?: '1';
}

export function toApiFilters(s: FilterState): ApiFilterParams {
  const out: ApiFilterParams = {};
  for (const k of LIST_FACET_KEYS) if (s[k].length) out[k] = s[k].join(',');
  if (s.price_min !== undefined) out.price_min = String(s.price_min);
  if (s.price_max !== undefined) out.price_max = String(s.price_max);
  if (s.in_stock) out.in_stock = '1';
  return out;
}

/** Stable identity of a state (request keys, effects). */
export function stateKey(s: FilterState): string {
  return toPageQuery(s);
}
