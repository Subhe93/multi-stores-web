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

/** One LIVE market as emitted by the API (`MarketRoute`, M1-DESIGN §3.2). */
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
  status: 'LIVE';
}

/** Request header names set by `src/proxy.ts` for market stores. */
export const MARKET_HEADER = 'x-market';
export const MARKET_LOCALE_HEADER = 'x-market-locale';
export const MARKET_SUGGEST_HEADER = 'x-market-suggest';
/** Visitor country (ISO2) the suggestion was derived from. */
export const MARKET_GEO_HEADER = 'x-market-geo';
/** Cookie set by the banner's dismiss button (365 days). */
export const MARKET_SUGGEST_DISMISS_COOKIE = 'ms-market-suggest-dismissed';

export { marketHreflangCode, isBotUserAgent } from './market-routing';
