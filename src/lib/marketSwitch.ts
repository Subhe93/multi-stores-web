// ── Cross-market navigation target (M1-DESIGN §4.4) ──────────────────────────
// Shared by the country switcher and the suggestion banner. Pure and
// client-safe (no next/headers).

import type { MarketRoute } from './market';
import { buildStoreOrigin, marketOrigin, storeLocalePath } from './storeUrl';
import { appendHandoffParam, CART_HANDOFF_DROPPED_PARAM, CART_HANDOFF_PARAM } from './cartHandoff';

/**
 * URL of the current page on `target`'s origin.
 *  - the current locale prefix (if any) is stripped;
 *  - the current locale is kept only when the target market serves it,
 *    otherwise the target's default locale (no prefix) is used;
 *  - `pathByLocale` (translated product slugs) overrides the path per locale;
 *  - `cartParam` (guest hand-off, `encodeGuestCart`) is appended when given.
 */
export function buildMarketSwitchUrl(opts: {
  storeSlug: string;
  current: Pick<MarketRoute, 'default_locale' | 'locales'>;
  target: Pick<MarketRoute, 'default_locale' | 'locales' | 'primary_hostname'>;
  /** Browser pathname (user-visible, may carry a locale prefix). */
  pathname: string;
  /** Browser query string (`window.location.search`), preserved on the target. */
  search?: string;
  /** Current locale being rendered. */
  locale: string;
  pathByLocale?: Record<string, string | undefined> | null;
  cartParam?: string | null;
  /** Lines `encodeGuestCart` had to drop; surfaced on the landing side. */
  cartDropped?: number;
}): string {
  const { storeSlug, current, target, pathname, search = '', locale, pathByLocale, cartParam, cartDropped = 0 } = opts;

  const currentLocales = [current.default_locale, ...current.locales];
  const prefix = currentLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`);
  const cleanPath = prefix ? pathname.slice(`/${prefix}`.length) || '/' : pathname;

  const targetLocales = [target.default_locale, ...target.locales];
  const targetLocale = targetLocales.includes(locale) ? locale : target.default_locale;
  const path = pathByLocale?.[targetLocale] ?? cleanPath;

  const origin = marketOrigin(target, buildStoreOrigin(storeSlug, null));
  const url = storeLocalePath(origin, targetLocale, target.default_locale, path === '/' ? '' : path);
  // Drop a stale hand-off param from the current URL before appending ours.
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(CART_HANDOFF_PARAM);
  params.delete(CART_HANDOFF_DROPPED_PARAM);
  const qs = params.toString();
  return appendHandoffParam(qs ? `${url}?${qs}` : url, cartParam ?? null, cartDropped);
}

/** Human-readable label of a market: name → primary hostname → KEY. */
export function marketLabel(market: Pick<MarketRoute, 'key' | 'name' | 'primary_hostname'>): string {
  return market.name || market.primary_hostname || market.key.toUpperCase();
}

/** Localised country name (falls back to the ISO code). */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}
