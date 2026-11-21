// ── Destination URL of a country/region + language choice (M155) ─────────────
// THE ONLY place the storefront's country/language URL scheme lives. The
// region picker and the suggestion banner call `buildRegionUrl` and nothing
// else, so the later "country + language in the URL" plan (`/de-de/`,
// `/nl-be/`) changes this function (plus the proxy and hreflang), not the UI.
// Pure and client-safe: the caller passes `window.location` values in.

import { buildMarketSwitchUrl } from './marketSwitch';
import { CART_HANDOFF_DROPPED_PARAM, CART_HANDOFF_PARAM } from './cartHandoff';
import { encodeUrlPath } from './slugRoute';
import { marketForCountry, REGION_PARAM, type RegionMarket } from './region';

export interface RegionUrlContext {
  storeSlug: string;
  /** null = store without the markets app. */
  current: RegionMarket | null;
  markets: readonly RegionMarket[];
  storeCustomDomain: string | null;
  /** Current market / store default locale (served without a prefix). */
  primaryLocale: string;
  /** Every locale served here (prefix detection), including the current one. */
  locales: readonly string[];
  currentLocale: string;
  /** `window.location.pathname` (user visible, may carry a locale prefix). */
  pathname: string;
  /** `window.location.search`. */
  search: string;
  pathByLocale?: Record<string, string | undefined> | null;
  /** Guest cart hand-off (encodeGuestCart). Used only when the origin changes. */
  cart?: { param: string | null; dropped: number } | null;
}

export interface RegionChoice {
  /** ISO2 country, or null for "Other countries" (the default market). */
  country: string | null;
  locale: string;
}

const STALE_PARAMS = [CART_HANDOFF_PARAM, CART_HANDOFF_DROPPED_PARAM, REGION_PARAM];

/** The query without stale hand-off params; untouched (byte-identical) when none is present. */
function cleanSearch(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return '';
  const params = new URLSearchParams(raw);
  if (!STALE_PARAMS.some((k) => params.has(k))) return `?${raw}`;
  for (const k of STALE_PARAMS) params.delete(k);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function stripPrefix(pathname: string, locales: readonly string[]): string {
  const prefix = locales.find((l) => l && (pathname.startsWith(`/${l}/`) || pathname === `/${l}`));
  return prefix ? pathname.slice(`/${prefix}`.length) || '/' : pathname;
}

/**
 * Destination for a picker / banner choice, or null when nothing changes
 * (same market, same locale; only the stored country differs).
 *  - target market = marketForCountry(choice.country)
 *  - other market -> buildMarketSwitchUrl (targetLocale = choice.locale, guest
 *    cart) with `rg=<ISO2>` when a country is chosen, so the landing origin
 *    stores it in its own cookie
 *  - same market (or no markets app) -> relative `[/locale]<path>?<search>`:
 *    the prefix is stripped, the default locale has no prefix,
 *    `pathByLocale[locale]` is used when present, the query is kept and stale
 *    c / cd / rg are dropped
 */
export function buildRegionUrl(choice: RegionChoice, ctx: RegionUrlContext): string | null {
  const { current } = ctx;
  const target = current ? marketForCountry(choice.country, current, ctx.markets) : null;

  if (current && target && target.key !== current.key) {
    const params = new URLSearchParams(cleanSearch(ctx.search).slice(1));
    const country = choice.country?.trim().toUpperCase();
    if (country) params.set(REGION_PARAM, country);
    const qs = params.toString();
    return buildMarketSwitchUrl({
      storeSlug: ctx.storeSlug,
      current,
      target,
      storeCustomDomain: ctx.storeCustomDomain,
      pathname: ctx.pathname,
      search: qs ? `?${qs}` : '',
      locale: ctx.currentLocale,
      targetLocale: choice.locale,
      pathByLocale: ctx.pathByLocale,
      cartParam: ctx.cart?.param ?? null,
      cartDropped: ctx.cart?.dropped ?? 0,
    });
  }

  // Same origin: only the language can change the URL.
  if (choice.locale === ctx.currentLocale) return null;
  const primary = current ? current.default_locale : ctx.primaryLocale;
  const prefixes = Array.from(new Set([...ctx.locales, ctx.currentLocale, primary]));
  // A registered slug is stored decoded (Arabic, ä); the browser path is
  // already encoded and is kept exactly as it is.
  const translated = ctx.pathByLocale?.[choice.locale];
  const path = translated ? encodeUrlPath(translated) : stripPrefix(ctx.pathname, prefixes);
  const dest = choice.locale === primary ? path : `/${choice.locale}${path === '/' ? '' : path}`;
  return `${dest}${cleanSearch(ctx.search)}`;
}
