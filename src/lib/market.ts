// ── Markets app (plans/namez-store-apps/M1-DESIGN.md §4.2) ───────────────────
// A store with the `markets` app enabled serves one storefront per market
// (country group), each on its own hostname with its own locales + currency.
// The proxy resolves the market from the request host and forwards it as the
// `x-market` request header; server components read it through
// `src/lib/market.server.ts` and pass it to the storefront API as an explicit
// `?market=` key (D1). Stores without the app never carry the header, so
// every helper yields null/undefined and callers fall through to today's
// behaviour.
//
// This module holds types and constants ONLY — it is imported by client
// components, the proxy and vitest, so it must never import `next/*`.

/**
 * One LIVE market as emitted by the API (`MarketRoute`, M1-DESIGN §3.2).
 * On a market-preview host (`<slug>--<key>.<platform host>`) the current
 * market may still be DRAFT and carries `preview: true`.
 */
export interface MarketRoute {
  key: string;
  /** Display name — additive on the API side; falls back to the hostname/key. */
  name?: string;
  default_locale: string;
  /** Secondary locales served with a `/xx/` prefix; never contains `default_locale`. */
  locales: string[];
  /** ISO 3166-1 alpha-2, upper-case. */
  countries: string[];
  currency: string;
  is_default: boolean;
  /** Canonical host of the market; null = platform subdomain. */
  primary_hostname: string | null;
  status: 'LIVE' | 'DRAFT';
  /** Market preview (DRAFT allowed, checkout view-only). Absent otherwise. */
  preview?: true;
  /**
   * Search-engine indexing switched off for this market (M6 §1): pages get
   * `noindex, nofollow`, the sitemap is empty and the market is left out of
   * other markets' hreflang lists. Optional so older API payloads still parse.
   */
  noindex?: boolean;
}

/**
 * What every API helper accepts as "the market of this request": the bare
 * key (today's callers) or `{ key, preview }` — the server reads it from the
 * proxy headers (`getRequestMarket`), client code passes the `MarketRoute`
 * from `useMarket()`. Nullish = no market (store without the app).
 */
export type MarketRef = string | { key: string; preview?: boolean } | null | undefined;

export function marketKeyOf(ref: MarketRef): string | undefined {
  if (!ref) return undefined;
  return typeof ref === 'string' ? ref : ref.key || undefined;
}

export function isMarketPreview(ref: MarketRef): boolean {
  return Boolean(ref && typeof ref !== 'string' && ref.preview);
}

/**
 * `?market=<key>` (+ `&preview=1` on a preview host) for a storefront READ
 * URL — the ONE place the preview flag is turned into a request. Without a
 * key the result is '' so the URL stays byte-identical for other stores.
 */
export function marketQuery(ref: MarketRef, hasQuery: boolean): string {
  const key = marketKeyOf(ref);
  if (!key) return '';
  const base = `${hasQuery ? '&' : '?'}market=${encodeURIComponent(key)}`;
  return isMarketPreview(ref) ? `${base}&preview=1` : base;
}

/**
 * Body fields of a market-aware POST read (quote, shipping estimate):
 * `{ market_key }` plus `preview: true` on a preview host. `{}` without a
 * market. Order creation / checkout sessions must NOT use this: those
 * paths are LIVE-only and never carry the preview flag.
 */
export function marketBody(ref: MarketRef): { market_key?: string; preview?: true } {
  const key = marketKeyOf(ref);
  if (!key) return {};
  return isMarketPreview(ref) ? { market_key: key, preview: true } : { market_key: key };
}

/** Request header names set by `src/proxy.ts` for market stores. */
export const MARKET_HEADER = 'x-market';
/** `1` on a market-preview host (`<slug>--<key>.<platform host>`). */
export const MARKET_PREVIEW_HEADER = 'x-market-preview';

/** `MarketRef` of a route handler's request headers (see `getRequestMarket`). */
export function requestMarketRef(h: Headers): { key: string; preview?: true } | undefined {
  const key = h.get(MARKET_HEADER);
  if (!key) return undefined;
  return h.get(MARKET_PREVIEW_HEADER) === '1' ? { key, preview: true } : { key };
}
export const MARKET_LOCALE_HEADER = 'x-market-locale';
export const MARKET_SUGGEST_HEADER = 'x-market-suggest';
/** Visitor country (ISO2) the suggestion was derived from. */
export const MARKET_GEO_HEADER = 'x-market-geo';
/** Cookie set by the banner's dismiss button (365 days). */
export const MARKET_SUGGEST_DISMISS_COOKIE = 'ms-market-suggest-dismissed';

export { marketHreflangCode, isBotUserAgent } from './market-routing';
