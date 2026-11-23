// Data of the filtered product listing ("explorer"): what a route hands the
// client component, and the first-page load shared by the routes. The
// browser loads the next pages and the filter changes itself (same request).

import { storefront } from '../api';
import type { MarketRef } from '../market';
import type { ListingProduct } from '@/themes/types';
import type { ListingSettings } from './settings';
import { toApiFilters, type FilterState } from './query';
import type { ListingFacets } from './types';
import type { LocalSource } from './local';

/** Products per page: divisible by 1, 2, 3 and 4 columns. */
export const EXPLORER_PAGE_SIZE = 24;

export interface ExplorerInit {
  storeSlug: string;
  locale: string;
  /** Secondary-locale path prefix ('' for the primary locale). */
  lp: string;
  /** Locale a product link falls back to without its own slug
   *  (`productLinkFallbackLocale`: market default, else primary; M163). */
  fallbackLocale: string;
  /** Secondary locale sent as `?lang=` on page URLs (undefined = primary). */
  lang?: string;
  /** '/products' or the collection path (no locale prefix). */
  basePath: string;
  kind: 'catalog' | 'collection';
  /** Collection page: the collection slug every request is scoped to. */
  baseCollection?: string;
  currency?: string;
  settings: ListingSettings;
  /** Filters of the request URL (server-rendered first page). */
  state: FilterState;
  products: ListingProduct[];
  total: number;
  hasMore: boolean;
  facets: ListingFacets | null;
  /** The store has enhanced card settings (requests send `card=1`). */
  card: boolean;
  /** Collection page: the first cards are the LCP (no banner image). */
  priorityFirst?: boolean;
  /** Dev demo only: rows filtered in the browser instead of the API. */
  local?: LocalSource;
}

export interface ExplorerRequest {
  locale: string;
  baseCollection?: string;
  state: FilterState;
  card: boolean;
  page: number;
  limit: number;
}

/** The paged request of one explorer state (server and browser alike). */
export function explorerPageParams(r: ExplorerRequest) {
  return {
    locale: r.locale,
    ...(r.baseCollection ? { creator_category: r.baseCollection } : {}),
    ...(r.state.search ? { search: r.state.search } : {}),
    ...(r.state.sort ? { sort: r.state.sort } : {}),
    page: r.page,
    limit: r.limit,
    ...(r.card ? { card: '1' as const } : {}),
    filters: toApiFilters(r.state),
    facets: '1' as const,
  };
}

/**
 * First page of a route, or null when the API cannot answer it (the route
 * then renders its listing as before).
 */
export async function loadExplorerPage<T>(
  slug: string,
  r: Omit<ExplorerRequest, 'page' | 'limit'>,
  market?: MarketRef,
): Promise<{ items: T[]; total: number; hasMore: boolean; facets: ListingFacets | null } | null> {
  try {
    const res = await storefront.getProductsPage(
      slug,
      explorerPageParams({ ...r, page: 1, limit: EXPLORER_PAGE_SIZE }),
      market,
    );
    if (res.legacy) return null;
    return { items: res.items as T[], total: res.total, hasMore: res.has_more, facets: res.facets ?? null };
  } catch {
    return null;
  }
}
