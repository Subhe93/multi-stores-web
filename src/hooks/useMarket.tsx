'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MarketRoute } from '@/lib/market';
import { isServableMarket } from '@/lib/storeUrl';

// ── Market context ────────────────────────────────────────────────────────────
// The market the current request is served in (`market` of
// `storefront.getStore(slug, market)`) and the store's other LIVE markets
// (`markets`), made available to client components (country switcher,
// suggestion banner, checkout bodies). Provided by StoreProviders; null / []
// outside a provider tree or for a store without the markets app.
//
// `pathByLocale` is a small registry a page can fill (product pages register
// their translated slugs) so the switcher/banner in the header can target the
// translated URL of the same page on another market.

type PathByLocale = Record<string, string | undefined>;

interface MarketContextValue {
  market: MarketRoute | null;
  markets: MarketRoute[];
  pathByLocale: PathByLocale | null;
  setPathByLocale: (paths: PathByLocale | null) => void;
}

const noop = () => {};
const EMPTY: MarketContextValue = { market: null, markets: [], pathByLocale: null, setPathByLocale: noop };

const MarketContext = createContext<MarketContextValue>(EMPTY);

export function MarketProvider({
  market,
  markets,
  children,
}: {
  market?: MarketRoute | null;
  markets?: MarketRoute[] | null;
  children: ReactNode;
}) {
  const [pathByLocale, setPathByLocale] = useState<PathByLocale | null>(null);
  const value = useMemo<MarketContextValue>(() => {
    if (!market) return EMPTY;
    // A non-default market without its own hostname is unreachable (the
    // platform subdomain serves the default market) — never offer it (L5).
    const servable = (markets ?? []).filter(isServableMarket);
    return { market, markets: servable, pathByLocale, setPathByLocale };
  }, [market, markets, pathByLocale]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

/** The request's market, or null for a store without the markets app. */
export function useMarket(): MarketRoute | null {
  return useContext(MarketContext).market;
}

/** Every reachable LIVE market of the store (including the current one); `[]` without the app. */
export function useMarkets(): MarketRoute[] {
  return useContext(MarketContext).markets;
}

/** Translated sub-paths of the current page per locale (registered by the page), or null. */
export function useMarketPathByLocale(): PathByLocale | null {
  return useContext(MarketContext).pathByLocale;
}

/**
 * Register the current page's translated paths for the market switcher.
 * Rendered by pages whose URL differs per locale (product detail); clears on
 * unmount so the next page starts from "same path".
 */
export function MarketPathsRegistrar({ pathByLocale }: { pathByLocale: PathByLocale }) {
  const { setPathByLocale } = useContext(MarketContext);
  const key = JSON.stringify(pathByLocale);
  useEffect(() => {
    setPathByLocale(JSON.parse(key) as PathByLocale);
    return () => setPathByLocale(null);
  }, [key, setPathByLocale]);
  return null;
}
