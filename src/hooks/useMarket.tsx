'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MarketRoute } from '@/lib/market';
import { isServableMarket } from '@/lib/storeUrl';
import { parseRegionCookie, regionCookieString, regionCountries, REGION_PARAM } from '@/lib/region';

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
//
// `preferredCountry` (M155) is the country the visitor chose in the region
// picker (cookie `ms-region`, read on the server so SSR and the client
// agree). It is stored even inside one market (BE on the `eu` market) and is
// the preferred checkout country. A cross-origin switch carries it as `?rg=`;
// the landing side writes its own cookie and strips the param.

type PathByLocale = Record<string, string | undefined>;

interface MarketContextValue {
  market: MarketRoute | null;
  markets: MarketRoute[];
  /** Legacy `Store.custom_domain` (M6.1): the default market's public host
   *  when it has no StoreDomain row; used for switch URLs. */
  storeCustomDomain: string | null;
  pathByLocale: PathByLocale | null;
  setPathByLocale: (paths: PathByLocale | null) => void;
  /** Region picker country (ISO2) when one of the servable markets sells there. */
  preferredCountry: string | null;
  /** Store the chosen country (cookie + state); null deletes it. */
  setPreferredCountry: (country: string | null) => void;
}

const noop = () => {};
const EMPTY: MarketContextValue = {
  market: null, markets: [], storeCustomDomain: null, pathByLocale: null, setPathByLocale: noop,
  preferredCountry: null, setPreferredCountry: noop,
};

function writeRegionCookie(country: string | null) {
  try {
    document.cookie = regionCookieString(country, window.location.protocol === 'https:');
  } catch {
    // Cookies blocked: the choice still applies to this page view.
  }
}

const MarketContext = createContext<MarketContextValue>(EMPTY);

export function MarketProvider({
  market,
  markets,
  storeCustomDomain,
  preferredCountry: initialCountry,
  children,
}: {
  market?: MarketRoute | null;
  markets?: MarketRoute[] | null;
  storeCustomDomain?: string | null;
  /** `ms-region` cookie read on the server (M155). */
  preferredCountry?: string | null;
  children: ReactNode;
}) {
  const [pathByLocale, setPathByLocale] = useState<PathByLocale | null>(null);
  // A non-default market without its own hostname is unreachable (the
  // platform subdomain serves the default market) — never offer it (L5).
  const servable = useMemo(() => (markets ?? []).filter(isServableMarket), [markets]);
  const known = useMemo(() => regionCountries(servable), [servable]);
  const validCountry = useCallback(
    (raw: string | null | undefined) => {
      const c = parseRegionCookie(raw);
      return c && known.has(c) ? c : null;
    },
    [known],
  );
  const [preferred, setPreferred] = useState<string | null>(() => validCountry(initialCountry));
  const setPreferredCountry = useCallback(
    (country: string | null) => {
      const c = validCountry(country);
      writeRegionCookie(c);
      setPreferred(c);
    },
    [validCountry],
  );

  // Cross-origin hand-off landing: `?rg=BE` from the other market's picker
  // or banner. Only `rg` is touched (the cart's `?c=` effect removes its own
  // params from a fresh URL, so the order of the two effects does not matter).
  const hasMarket = Boolean(market);
  useEffect(() => {
    if (!hasMarket) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(REGION_PARAM)) return;
    const c = validCountry(url.searchParams.get(REGION_PARAM));
    if (c) {
      writeRegionCookie(c);
      // The URL is an external system read once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferred(c);
    }
    url.searchParams.delete(REGION_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [hasMarket, validCountry]);

  const value = useMemo<MarketContextValue>(() => {
    if (!market) return EMPTY;
    return {
      market, markets: servable, storeCustomDomain: storeCustomDomain ?? null, pathByLocale, setPathByLocale,
      preferredCountry: preferred, setPreferredCountry,
    };
  }, [market, servable, storeCustomDomain, pathByLocale, preferred, setPreferredCountry]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

/** The request's market, or null for a store without the markets app. */
export function useMarket(): MarketRoute | null {
  return useContext(MarketContext).market;
}

/**
 * True on a market-preview host (`<slug>--<key>.<platform host>`): the
 * market may be DRAFT and the checkout is view-only (orders, Kustom and
 * Stripe stay LIVE-only on the API).
 */
export function useMarketPreview(): boolean {
  return Boolean(useContext(MarketContext).market?.preview);
}

/** Every reachable LIVE market of the store (including the current one); `[]` without the app. */
export function useMarkets(): MarketRoute[] {
  return useContext(MarketContext).markets;
}

/** Legacy `Store.custom_domain` for `buildMarketSwitchUrl`; null without one or outside a provider. */
export function useStoreCustomDomain(): string | null {
  return useContext(MarketContext).storeCustomDomain;
}

/** The visitor's chosen country (region picker, ISO2), or null. Always null without the markets app. */
export function usePreferredCountry(): string | null {
  return useContext(MarketContext).preferredCountry;
}

/** Setter for the chosen country (writes the `ms-region` cookie); a noop without the markets app. */
export function useSetPreferredCountry(): (country: string | null) => void {
  return useContext(MarketContext).setPreferredCountry;
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
