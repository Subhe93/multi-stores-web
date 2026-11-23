// Loads the products of a listing route (/products, a collection page) and
// decides between the legacy full list and the opt-in server pagination.
//
// The size is learnt cheaply: a probe asks for page 1 with one item and
// reads `total` (one count-sized request, cached under the store tag). At or
// below LISTING_SERVER_THRESHOLD the route makes today's exact request, so
// its output is unchanged; above it, only the first page (or the `?page=N`
// page, M166 A) is loaded. There is never a second full fetch.

import { storefront } from './api';
import type { MarketRef } from './market';
import {
  LISTING_PAGE_SIZE,
  LISTING_SERVER_THRESHOLD,
  listingApiSort,
  type ListingPagination,
} from './listingPaging';

export type ListingLoadResult<T> =
  | { mode: 'legacy'; products: T[] }
  | { mode: 'server'; products: T[]; pagination: ListingPagination };

export async function loadListing<T>(
  slug: string,
  input: {
    /**
     * Today's request of the route (legacy mode sends exactly this). A route
     * of a store with card settings adds `card: '1'` last (`cardQuery`); the
     * first page then asks for it too. The probe never does: it only counts.
     */
    queryParams: Record<string, string>;
    /** The URL `?sort=` value. */
    sort?: string;
    /**
     * M166 A: page to load in server mode (`?page=N`, default 1). Legacy
     * mode renders the full list, so a page above 1 does not exist there
     * (the route answers 404).
     */
    page?: number;
  },
  market?: MarketRef,
): Promise<ListingLoadResult<T>> {
  const { queryParams, sort } = input;
  const page = input.page && input.page > 1 ? input.page : 1;
  const legacy = async (): Promise<ListingLoadResult<T>> => ({
    mode: 'legacy',
    products: (await storefront.getProducts(slug, queryParams, market)) as T[],
  });

  const request: ListingPagination['request'] = { locale: queryParams.locale };
  if (queryParams.creator_category) request.creator_category = queryParams.creator_category;
  if (queryParams.search) request.search = queryParams.search;

  let probe;
  try {
    probe = await storefront.getProductsPage(slug, { ...request, page: 1, limit: 1 }, market);
  } catch {
    return legacy();
  }
  // An older API ignored `page` and answered the full list: use it as is.
  if (probe.legacy) return { mode: 'legacy', products: probe.items as T[] };
  if (probe.total <= LISTING_SERVER_THRESHOLD) return legacy();

  const apiSort = listingApiSort(sort);
  if (apiSort) request.sort = apiSort;
  const first = await storefront.getProductsPage(
    slug,
    { ...request, page, limit: LISTING_PAGE_SIZE, ...(queryParams.card === '1' ? { card: '1' as const } : {}) },
    market,
  );
  if (first.legacy) return { mode: 'legacy', products: first.items as T[] };
  return {
    mode: 'server',
    products: first.items as T[],
    pagination: {
      total: first.total,
      pageSize: LISTING_PAGE_SIZE,
      hasMore: first.has_more,
      ...(page > 1 ? { page } : {}),
      request,
    },
  };
}
