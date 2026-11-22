'use client';

// "Load more" state of a server-paginated product listing (see
// lib/listingPaging.ts). The route renders the first page on the server and
// hands it over as `initial` with its `pagination`; this hook appends the
// next pages fetched from the browser.
//
// Without `pagination` (a legacy listing) it returns `initial` by reference
// and never fetches, so the legacy render is untouched.

import { useEffect, useRef, useState } from 'react';
import { storefront } from '@/lib/api';
import { toListingCard, type StorefrontProductRow } from '@/lib/listing';
import type { ListingPagination } from '@/lib/listingPaging';
import { useMarket } from '@/hooks/useMarket';
import { useProductCardSettings } from '@/hooks/useProductCard';
import { withCardExtras, type CardSourceRow } from '@/lib/productCard/model';
import { cardQuery } from '@/lib/productCard/settings';
import type { ListingProduct } from '@/themes/types';

interface PagesState {
  key: string;
  /** Cards appended after `initial` (de-duplicated by id). */
  extra: ListingProduct[];
  /** The full list when an older API answered the plain array. */
  replaced: ListingProduct[] | null;
  pagesLoaded: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
}

export interface ListingPages {
  products: ListingProduct[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  loadMore: () => void;
}

export function useListingPages({
  storeSlug,
  initial,
  pagination,
  locale,
}: {
  storeSlug: string;
  initial: ListingProduct[];
  pagination?: ListingPagination;
  /** M159: page locale, for the swatch / size names of the card model. */
  locale?: string;
}): ListingPages {
  // Markets app: the next pages are priced like the first one (same market,
  // preview flag on a preview host), built exactly as the sections do.
  const market = useMarket();
  const marketKey = market?.key;
  const marketPreview = market?.preview === true;
  // Enhanced card: the next pages carry the card fields like the first one.
  const cardSettings = useProductCardSettings();

  // A new request (sort, search, collection, locale) or a new first page
  // yields a new key, which drops the appended pages without an effect.
  const key = pagination
    ? JSON.stringify([pagination.request, pagination.total, initial[0]?.id, initial.length])
    : '';
  const [state, setState] = useState<PagesState | null>(null);
  const fresh = (k: string): PagesState => ({
    key: k,
    extra: [],
    replaced: null,
    pagesLoaded: 1,
    total: pagination?.total ?? initial.length,
    hasMore: pagination?.hasMore ?? false,
    loading: false,
    error: false,
  });
  const current = state && state.key === key ? state : fresh(key);

  // Latest key, read by responses to drop answers for an older request.
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  // Key of the request in flight: a second click while loading is ignored.
  const inFlight = useRef<string | null>(null);

  const loadMore = () => {
    if (!pagination || !current.hasMore || current.loading || inFlight.current === key) return;
    const requestKey = key;
    const page = current.pagesLoaded + 1;
    const base = current;
    inFlight.current = requestKey;
    setState({ ...base, loading: true, error: false });
    const marketRef = marketKey ? (marketPreview ? { key: marketKey, preview: true as const } : { key: marketKey }) : undefined;
    storefront
      .getProductsPage(storeSlug, { ...pagination.request, page, limit: pagination.pageSize, ...cardQuery(cardSettings) }, marketRef)
      .then((res) => {
        if (keyRef.current !== requestKey) return;
        const cards = (res.items as StorefrontProductRow[]).map((row) =>
          cardSettings ? withCardExtras(toListingCard(row), row as unknown as CardSourceRow, locale) : toListingCard(row),
        );
        setState((prev) => {
          const from = prev && prev.key === requestKey ? prev : base;
          if (res.legacy) {
            return { ...from, replaced: cards, total: cards.length, hasMore: false, loading: false, error: false };
          }
          const seen = new Set([...initial, ...from.extra].map((p) => p.id));
          const added = cards.filter((c) => !seen.has(c.id) && (seen.add(c.id), true));
          return {
            ...from,
            extra: [...from.extra, ...added],
            pagesLoaded: page,
            total: res.total,
            hasMore: res.has_more,
            loading: false,
            error: false,
          };
        });
      })
      .catch(() => {
        if (keyRef.current !== requestKey) return;
        setState((prev) => ({ ...(prev && prev.key === requestKey ? prev : base), loading: false, error: true }));
      })
      .finally(() => {
        if (inFlight.current === requestKey) inFlight.current = null;
      });
  };

  if (!pagination) {
    return { products: initial, total: initial.length, hasMore: false, loading: false, error: false, loadMore };
  }
  const products = current.replaced ?? (current.extra.length ? [...initial, ...current.extra] : initial);
  return {
    products,
    total: current.total,
    hasMore: current.hasMore,
    loading: current.loading,
    error: current.error,
    loadMore,
  };
}
