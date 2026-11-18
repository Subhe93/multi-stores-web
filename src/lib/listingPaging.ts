// Opt-in server pagination of the product listings (/products, collection
// pages and the builder `product-listing` section). Pure: no `next/*`
// imports, shared by the server routes and the browser "load more" hook.
//
// A listing switches to server mode only when its catalogue is larger than
// LISTING_SERVER_THRESHOLD; at or below it the routes render exactly as
// before (full list, sorted on the Next server).

/**
 * Catalogue size above which a listing is paginated by the API. Above every
 * live catalogue today (largest is 52), divisible by 1 to 6 grid columns and
 * below the API's page-size cap of 100 (a cross-repo invariant).
 */
export const LISTING_SERVER_THRESHOLD = 60;

/** Products per server page (first page rendered on the server, then "load more"). */
export const LISTING_PAGE_SIZE = LISTING_SERVER_THRESHOLD;

/** The `sort` values the API understands that the storefront offers. */
export type ListingApiSort = 'newest' | 'price_asc' | 'price_desc';

const API_SORTS: readonly ListingApiSort[] = ['newest', 'price_asc', 'price_desc'];

/**
 * The URL `?sort=` value as an API sort. Anything else (the default order,
 * unknown values, arrays) is undefined, so cache keys only ever vary by these
 * three values.
 */
export function listingApiSort(urlSort: unknown): ListingApiSort | undefined {
  return typeof urlSort === 'string' && (API_SORTS as readonly string[]).includes(urlSort)
    ? (urlSort as ListingApiSort)
    : undefined;
}

/** Server-mode state handed from the route to the listing UI. */
export interface ListingPagination {
  /** True number of products matching the listing's filter. */
  total: number;
  /** Products per page (the first page is what the server rendered). */
  pageSize: number;
  hasMore: boolean;
  /** Filters of the first-page request, reused for the next pages. */
  request: {
    locale: string;
    creator_category?: string;
    search?: string;
    sort?: ListingApiSort;
  };
}
