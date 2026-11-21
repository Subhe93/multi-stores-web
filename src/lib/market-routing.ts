// ── Pure market routing helpers (plans/namez-store-apps/M1-DESIGN.md §4.1) ──
// Everything in this module is side-effect free and runs in the proxy (edge),
// in server components and in vitest. It must not import `next/headers`.

// Every storefront locale (platform list + store-only ones such as 'ku'): a
// prefix a market does not serve is a 404 either way.
import { storeLocales as globalLocales } from '@/i18n/config';
import type { MarketRoute } from './market';
import {
  COUNTRY_PATH_SEGMENT_RE,
  isRemappedLocale,
  matchLocalePath,
  primaryLocalePath,
  usesLocalePaths,
  type PathMarket,
} from './localePaths';

/** Internal route that renders a 404 for a locale the market does not serve. */
export const MARKET_404_SEGMENT = 'market-not-found';

export type StoreRouteDecision =
  | {
      kind: 'rewrite';
      /** Internal `/store/{slug}/...` path (locale prefix stripped). */
      storePath: string;
      /** Locale prefix found in the URL, or null when unprefixed. */
      urlLocale: string | null;
      /** Locale the page renders in (`urlLocale` or the market default). */
      locale: string;
      /** Value for the `x-store-locale` cookie: `''` without a market (legacy). */
      cookieLocale: string;
      /**
       * M156, locale-path markets ONLY (absent otherwise): the URL prefix the
       * request came in on: '' (root), '/de-at', '/ar' or '/de' (bare folder
       * of a locale without rows). Becomes `x-store-path-prefix`.
       */
      pathPrefix?: string;
      /** M156: country of the visited language-country path (`/de-at` -> AT), else null. */
      pathCountry?: string | null;
    }
  | {
      kind: 'redirect';
      /** Path + query to 301 to (the unprefixed default-locale URL). */
      location: string;
      status: 301;
    }
  | {
      kind: 'notfound';
      /** Internal path of the 404 route. */
      storePath: string;
      status: 404;
    };

/**
 * Decide how a store request is routed given the market resolved from the
 * host. Mirrors the legacy block of `proxy.ts` when `market` is null (the
 * proxy keeps executing its own lines in that case — this branch exists so
 * the two can be compared in tests).
 *
 * With a market (steps 1-4 of §4.1):
 *  - the locale prefix is matched against the market's locales only;
 *  - a prefix equal to the market default → 301 to the unprefixed URL;
 *  - a prefix that is a global locale but not served here → 404 route;
 *  - the cookie carries the effective locale so layouts need no store fetch.
 */
export function decideStoreRoute(opts: {
  storeSlug: string;
  pathname: string;
  /** Query string including the leading `?` (or ''). */
  search?: string;
  market: (Pick<MarketRoute, 'default_locale' | 'locales'> & Pick<PathMarket, 'countries' | 'locale_paths'>) | null;
  /** Override of the global locale list (tests). */
  allLocales?: readonly string[];
}): StoreRouteDecision {
  const { storeSlug, pathname, search = '', market } = opts;
  const all = opts.allLocales ?? globalLocales;

  const matchPrefix = (list: readonly string[]) =>
    list.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? null;

  const stripPrefix = (locale: string) => pathname.slice(`/${locale}`.length) || '/';

  if (!market) {
    const urlLocale = matchPrefix(all);
    const storePath = urlLocale
      ? `/store/${storeSlug}${stripPrefix(urlLocale)}`
      : `/store/${storeSlug}${pathname === '/' ? '' : pathname}`;
    return {
      kind: 'rewrite',
      storePath,
      urlLocale,
      locale: urlLocale ?? '',
      cookieLocale: urlLocale || '',
    };
  }

  if (usesLocalePaths(market)) {
    return decideLocalePathRoute({ storeSlug, pathname, search, market, all });
  }

  const allowed = [market.default_locale, ...market.locales];
  const globalPrefix = matchPrefix(all);

  if (globalPrefix === market.default_locale) {
    const clean = stripPrefix(globalPrefix);
    return { kind: 'redirect', location: `${clean}${search}`, status: 301 };
  }

  if (globalPrefix && !allowed.includes(globalPrefix)) {
    return {
      kind: 'notfound',
      storePath: `/store/${storeSlug}/${MARKET_404_SEGMENT}`,
      status: 404,
    };
  }

  const urlLocale = globalPrefix;
  const storePath = urlLocale
    ? `/store/${storeSlug}${stripPrefix(urlLocale)}`
    : `/store/${storeSlug}${pathname === '/' ? '' : pathname}`;
  const locale = urlLocale ?? market.default_locale;
  return { kind: 'rewrite', storePath, urlLocale, locale, cookieLocale: locale };
}

/**
 * M156 branch of `decideStoreRoute` for a market with active locale paths
 * (§4.2). Markets without them never get here, so their decisions (and the
 * objects returned) stay exactly as before.
 *  - active path (`/de-at/…`, `/ar/…`) -> rewrite in its locale + country;
 *  - default locale prefix (`/en/…`) -> 301 unprefixed (as before);
 *  - remapped locale's bare folder (`/de/…`) -> 301 to its primary path;
 *  - other served locale (`/ar` without a row) -> bare folder rewrite;
 *  - global locale not served -> 404 (as before);
 *  - an `xx-yy` first segment of a known language or a market country
 *    (inactive `/nl-be/`, `/de-ch/`) -> 404; other `xx-yy` slugs are pages;
 *  - else the root in the default locale.
 */
function decideLocalePathRoute(opts: {
  storeSlug: string;
  pathname: string;
  search: string;
  market: Pick<MarketRoute, 'default_locale' | 'locales'> & Pick<PathMarket, 'countries' | 'locale_paths'>;
  all: readonly string[];
}): StoreRouteDecision {
  const { storeSlug, pathname, search, market, all } = opts;
  const storeRoot = `/store/${storeSlug}`;
  const notfound: StoreRouteDecision = { kind: 'notfound', storePath: `${storeRoot}/${MARKET_404_SEGMENT}`, status: 404 };

  const hit = matchLocalePath(market, pathname);
  if (hit) {
    const locale = hit.entry.locale;
    return {
      kind: 'rewrite',
      storePath: `${storeRoot}${hit.rest}`,
      urlLocale: locale,
      locale,
      cookieLocale: locale,
      pathPrefix: `/${hit.entry.path}`,
      pathCountry: hit.entry.country,
    };
  }

  const g = all.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? null;
  const rest = g ? pathname.slice(g.length + 1) || '/' : pathname;
  if (g && g === market.default_locale) {
    return { kind: 'redirect', location: `${rest}${search}`, status: 301 };
  }
  if (g) {
    if (!market.locales.includes(g)) return notfound;
    if (isRemappedLocale(market, g)) {
      const primary = primaryLocalePath(market, g)!;
      return { kind: 'redirect', location: `/${primary.path}${rest === '/' ? '' : rest}${search}`, status: 301 };
    }
    return {
      kind: 'rewrite',
      storePath: `${storeRoot}${rest}`,
      urlLocale: g,
      locale: g,
      cookieLocale: g,
      pathPrefix: `/${g}`,
      pathCountry: null,
    };
  }

  const end = pathname.indexOf('/', 1);
  const seg = end < 0 ? pathname.slice(1) : pathname.slice(1, end);
  // Only segments that read as a language-country path of THIS market are
  // 404 (inactive `/nl-be/`, `/de-ch/`): the language is a storefront locale
  // or the country is one the market sells to. Any other `xx-yy` slug
  // (`/om-os`, `/my-id`) stays a root page and reaches the page lookup.
  if (COUNTRY_PATH_SEGMENT_RE.test(seg)) {
    const [lang, cc] = seg.split('-') as [string, string];
    const countries = (market.countries ?? []).map((c) => String(c).toUpperCase());
    if (all.includes(lang) || countries.includes(cc.toUpperCase())) return notfound;
  }

  const locale = market.default_locale;
  return {
    kind: 'rewrite',
    storePath: `${storeRoot}${pathname === '/' ? '' : pathname}`,
    urlLocale: null,
    locale,
    cookieLocale: locale,
    pathPrefix: '',
    pathCountry: null,
  };
}

// The hreflang code helper lives with the locale-path slots (one formula).
export { marketHreflangCode } from './localePaths';

const BOT_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|lighthouse/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !!ua && BOT_UA_RE.test(ua);
}

/**
 * Visitor country for the suggestion banner (L7): the CDN geo header first,
 * then the region subtag of the first `Accept-Language` entry that has one.
 */
export function detectVisitorCountry(h: {
  cfCountry?: string | null;
  vercelCountry?: string | null;
  acceptLanguage?: string | null;
}): string | null {
  const geo = (h.cfCountry || h.vercelCountry || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(geo) && geo !== 'XX' && geo !== 'T1') return geo;
  const accept = h.acceptLanguage || '';
  for (const part of accept.split(',')) {
    const tag = part.split(';')[0]!.trim();
    const m = tag.match(/^[a-z]{2,3}-([a-z]{2})$/i);
    if (m) return m[1]!.toUpperCase();
  }
  return null;
}

/**
 * The market to suggest for `country`, or null when the current market already
 * covers it / no other LIVE market does. Never redirects — the caller only
 * sets a header the banner reads.
 */
export function pickSuggestedMarket(
  country: string | null,
  current: Pick<MarketRoute, 'key' | 'countries'>,
  markets: Pick<MarketRoute, 'key' | 'countries'>[],
): string | null {
  if (!country) return null;
  if (current.countries.includes(country)) return null;
  const match = markets.find((m) => m.key !== current.key && m.countries.includes(country));
  return match ? match.key : null;
}
