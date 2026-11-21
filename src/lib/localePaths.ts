// ── Language-country URL paths per market (M156) ─────────────────────────────
// plans/namez-store-apps/M156-LANG-COUNTRY-URLS-DESIGN.md §4.1.
//
// A market can OPTIONALLY replace its bare locale folders (`/de/`) with
// language-country paths (`/de-de/`, `/de-at/`) and language-only paths
// (`/ar/`). Everything that turns a market + locale into a URL prefix lives
// here: the proxy, the pages, the link builders, hreflang, the sitemap and
// the region picker all ask this module.
//
// Regression rule: a market without ACTIVE rows (field absent, [], or only
// inactive rows) "does not use locale paths", and every caller then takes
// its old code path, byte for byte.
//
// Pure and edge-safe: no `next/*`, no window. Imported by the proxy, server
// and client components and vitest.

import { storeLocales } from '@/i18n/config';
import type { MarketLocalePath, MarketRoute } from './market';

/** The slice of a market this module reads. `countries`/`locale_paths` may be absent. */
export type PathMarket = Pick<MarketRoute, 'default_locale' | 'locales'> & {
  countries?: readonly string[] | null;
  locale_paths?: readonly MarketLocalePath[] | null;
};

export const LOCALE_PATH_SEGMENT_RE = /^[a-z]{2}(?:-[a-z]{2})?$/;
/** First segment shaped like a language-country path (`nl-be`). */
export const COUNTRY_PATH_SEGMENT_RE = /^[a-z]{2}-[a-z]{2}$/;

const LOCALE_RE = /^[a-z]{2}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const HREFLANG_RE = /^([a-z]{2})(?:-([A-Z]{2}))?$/;

/**
 * hreflang code for a market/locale pair (D9): `lang-COUNTRY` when the market
 * serves exactly one country, plain `lang` otherwise.
 */
export function marketHreflangCode(
  market: { countries?: readonly string[] | null },
  locale: string,
): string {
  const countries = market.countries ?? [];
  return countries.length === 1 ? `${locale}-${countries[0]!.toUpperCase()}` : locale;
}

/** `ll` / `ll-CC` in canonical case, or null. */
function normHreflang(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const [lang, region, ...extra] = raw.trim().split('-');
  if (extra.length || !lang) return null;
  const code = region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
  return HREFLANG_RE.test(code) ? code : null;
}

// Results per market object: the payload objects are never mutated, and the
// proxy, the alternates and the link builders ask many times per request.
const cache = new WeakMap<object, MarketLocalePath[]>();

/**
 * The market's ACTIVE rows, sanitised (the activity rule of §3.3 re-applied
 * defensively; the API already sends active rows only):
 *  - shape: path/locale/country/hreflang valid, path = its row (`de-at` for
 *    de + AT, `ar` for a language-only ar row);
 *  - the locale is a storefront locale, served by the market (in `locales`),
 *    and not the default locale;
 *  - the country is null or one of the market's countries;
 *  - paths and (locale, country) pairs unique, every hreflang code used once
 *    (first row wins); hreflang codes must match the row's language/country.
 * [] = the market does not use locale paths.
 */
export function activeLocalePaths(m: PathMarket | null | undefined): MarketLocalePath[] {
  if (!m || !Array.isArray(m.locale_paths) || m.locale_paths.length === 0) return [];
  const hit = cache.get(m);
  if (hit) return hit;

  const served = new Set(m.locales ?? []);
  const countries = new Set((m.countries ?? []).map((c) => String(c).toUpperCase()));
  const supported = storeLocales as readonly string[];
  const paths = new Set<string>();
  const pairs = new Set<string>();
  const codes = new Set<string>();
  const out: MarketLocalePath[] = [];

  for (const raw of m.locale_paths) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<MarketLocalePath>;
    const locale = typeof r.locale === 'string' ? r.locale.trim().toLowerCase() : '';
    const country = r.country === null || r.country === undefined ? null : typeof r.country === 'string' ? r.country.trim().toUpperCase() : '';
    const path = typeof r.path === 'string' ? r.path.trim() : '';
    if (!LOCALE_RE.test(locale) || (country !== null && !COUNTRY_RE.test(country))) continue;
    if (!LOCALE_PATH_SEGMENT_RE.test(path)) continue;
    if (path !== (country ? `${locale}-${country.toLowerCase()}` : locale)) continue;
    // Activity rule.
    if (!supported.includes(locale) || locale === m.default_locale || !served.has(locale)) continue;
    if (country !== null && !countries.has(country)) continue;
    const pair = `${locale}|${country ?? ''}`;
    if (paths.has(path) || pairs.has(pair)) continue;

    const hreflang: string[] = [];
    for (const c of Array.isArray(r.hreflang) ? r.hreflang : []) {
      const code = normHreflang(c);
      if (!code || codes.has(code) || hreflang.includes(code)) continue;
      const [lang, region] = code.split('-');
      if (lang !== locale || (region && region !== country)) continue;
      hreflang.push(code);
    }
    if (hreflang.length === 0) {
      const fallback = country ? `${locale}-${country}` : locale;
      if (codes.has(fallback)) continue;
      hreflang.push(fallback);
    }
    paths.add(path);
    pairs.add(pair);
    for (const c of hreflang) codes.add(c);
    out.push({ path, locale, country, hreflang });
  }
  cache.set(m, out);
  return out;
}

/** True when the market has at least one active row (otherwise: legacy behaviour). */
export function usesLocalePaths(m: PathMarket | null | undefined): boolean {
  return activeLocalePaths(m).length > 0;
}

/**
 * Primary path of a locale (target of the `/de/` 301): the language-only
 * row, else the row whose hreflang has the plain code, else the first row.
 */
export function primaryLocalePath(m: PathMarket, locale: string): MarketLocalePath | null {
  const rows = activeLocalePaths(m).filter((r) => r.locale === locale);
  return rows.find((r) => r.country === null) ?? rows.find((r) => r.hreflang.includes(locale)) ?? rows[0] ?? null;
}

/** A locale whose bare folder is replaced: it has an active row whose path is not the locale itself. */
export function isRemappedLocale(m: PathMarket, locale: string): boolean {
  return activeLocalePaths(m).some((r) => r.locale === locale && r.path !== locale);
}

/** First-segment match on an active row: `/de-at`, `/de-at/…` -> { entry, rest: '/…' | '/' }. Exact lower case only. */
export function matchLocalePath(
  m: PathMarket | null | undefined,
  pathname: string,
): { entry: MarketLocalePath; rest: string } | null {
  const rows = activeLocalePaths(m);
  if (rows.length === 0 || !pathname.startsWith('/')) return null;
  const end = pathname.indexOf('/', 1);
  const seg = end < 0 ? pathname.slice(1) : pathname.slice(1, end);
  const entry = rows.find((r) => r.path === seg);
  if (!entry) return null;
  return { entry, rest: end < 0 ? '/' : pathname.slice(end) || '/' };
}

/** One public URL root of a market: what hreflang, the sitemap and canonicals iterate. */
export interface UrlSlot {
  /** '' (root) | '/de-at' | '/ar' | '/de' (bare folder of a locale without rows). */
  prefix: string;
  locale: string;
  /** Country of a country row; null for the root, language-only rows and bare folders. */
  country: string | null;
  /** hreflang codes, first = primary. Root and bare folders: [marketHreflangCode(m, locale)]. */
  hreflang: string[];
}

/**
 * Legacy market: [root, ...bare folders of m.locales] (today's set, same order).
 * Locale-path market: root, then the active rows in stored order, then bare
 * folders for served locales that have no active row at all.
 */
export function marketUrlSlots(m: PathMarket): UrlSlot[] {
  const def = m.default_locale;
  const root: UrlSlot = { prefix: '', locale: def, country: null, hreflang: [marketHreflangCode(m, def)] };
  const secondary = Array.from(new Set(m.locales ?? [])).filter((l) => l && l !== def);
  const bare = (l: string): UrlSlot => ({ prefix: `/${l}`, locale: l, country: null, hreflang: [marketHreflangCode(m, l)] });
  const rows = activeLocalePaths(m);
  if (rows.length === 0) return [root, ...secondary.map(bare)];
  const withRows = new Set(rows.map((r) => r.locale));
  return [
    root,
    ...rows.map((r) => ({ prefix: `/${r.path}`, locale: r.locale, country: r.country, hreflang: [...r.hreflang] })),
    ...secondary.filter((l) => !withRows.has(l)).map(bare),
  ];
}

/**
 * URL prefix for (locale, country) on market m (picker, language switchers):
 *  - the default locale -> '' (root);
 *  - an active row (locale, country) -> its path;
 *  - else the language-only row of the locale;
 *  - else a locale that is not remapped -> its bare folder (legacy form);
 *  - else the primary path of the locale.
 */
export function localePathPrefix(m: PathMarket, locale: string, country: string | null): string {
  if (locale === m.default_locale) return '';
  const rows = activeLocalePaths(m);
  const c = country ? country.toUpperCase() : null;
  const own = c ? rows.find((r) => r.locale === locale && r.country === c) : undefined;
  if (own) return `/${own.path}`;
  const langOnly = rows.find((r) => r.locale === locale && r.country === null);
  if (langOnly) return `/${langOnly.path}`;
  if (!isRemappedLocale(m, locale)) return `/${locale}`;
  return `/${primaryLocalePath(m, locale)!.path}`;
}

/**
 * True when the language switch to `locale` keeps the visitor's `country`
 * (M155: the chosen country is what stays stored). False when the only way
 * to show `locale` is another country's path: `localePathPrefix` would fall
 * back to the primary path (/de-de for a FI visitor) and the proxy would
 * rewrite `ms-region` to that path's country. No country chosen, or one the
 * market does not sell to: true (nothing to keep).
 */
export function localeKeepsCountry(m: PathMarket, locale: string, country: string | null): boolean {
  if (!country || locale === m.default_locale) return true;
  const c = country.toUpperCase();
  if (!(m.countries ?? []).some((x) => String(x).toUpperCase() === c)) return true;
  const rows = activeLocalePaths(m).filter((r) => r.locale === locale);
  if (rows.some((r) => r.country === c || r.country === null)) return true;
  return !isRemappedLocale(m, locale);
}

/**
 * Languages the header switchers offer on market `m` for `country`: on a
 * locale-path market only those that keep the country (the same rule as
 * the region picker's `regionLocales`), plus the current one; every other
 * market gets `locales` unchanged.
 */
export function switchableLocales(
  m: PathMarket | null | undefined,
  locales: readonly string[],
  country: string | null,
  current: string,
): string[] {
  if (!m || !usesLocalePaths(m)) return [...locales];
  return locales.filter((l) => l === current || localeKeepsCountry(m, l, country));
}

/**
 * Split a visible pathname into its store prefix and the rest: an active
 * locale path of `m` first, else any of `allLocales` as a bare folder.
 * `rest` is '/' when the path is the prefix alone.
 */
export function stripStorePrefix(
  pathname: string,
  m: PathMarket | null | undefined,
  allLocales: readonly string[],
): { prefix: string; rest: string } {
  const hit = matchLocalePath(m, pathname);
  if (hit) return { prefix: `/${hit.entry.path}`, rest: hit.rest };
  const l = allLocales.find((x) => x && (pathname.startsWith(`/${x}/`) || pathname === `/${x}`));
  if (l) return { prefix: `/${l}`, rest: pathname.slice(l.length + 1) || '/' };
  return { prefix: '', rest: pathname };
}

/** Split `to` into path and the `?…`/`#…` tail. */
function splitTail(to: string): [string, string] {
  const cut = to.search(/[?#]/);
  return cut < 0 ? [to, ''] : [to.slice(0, cut), to.slice(cut)];
}

/**
 * `/de/…` or `/de` -> `/de-de/…` for a remapped locale (one hop for old
 * redirect targets); anything else is returned unchanged (query/hash kept).
 */
export function remapLegacyLocaleTarget(to: string, m: PathMarket): string {
  if (!usesLocalePaths(m) || !to.startsWith('/')) return to;
  const [path, tail] = splitTail(to);
  const end = path.indexOf('/', 1);
  const seg = end < 0 ? path.slice(1) : path.slice(1, end);
  if (!LOCALE_RE.test(seg) || !isRemappedLocale(m, seg)) return to;
  const primary = primaryLocalePath(m, seg)!;
  return `/${primary.path}${end < 0 ? '' : path.slice(end)}${tail}`;
}

/**
 * Re-base a redirect target found through `legacyRedirectAlias` onto the
 * visited path: `/de/x` -> `/de-at/x` when the visitor came in on
 * `/de-at/…`; any other target goes through `remapLegacyLocaleTarget`.
 */
export function rebaseAliasTarget(to: string, entry: MarketLocalePath, m: PathMarket): string {
  const own = `/${entry.locale}`;
  if (to === own || (to.startsWith(own) && ['/', '?', '#'].includes(to.charAt(own.length)))) {
    return `/${entry.path}${to.slice(own.length)}`;
  }
  return remapLegacyLocaleTarget(to, m);
}

/**
 * `/de-at/products/x` -> `/de/products/x`, the form the redirect tables keep
 * (slug moves stay on bare `/<locale>/` rows). Null when the path has no
 * remapped prefix (root, `/ar/…`, legacy markets).
 */
export function legacyRedirectAlias(
  pathname: string,
  m: PathMarket,
): { alias: string; entry: MarketLocalePath } | null {
  const hit = matchLocalePath(m, pathname);
  if (!hit || hit.entry.path === hit.entry.locale) return null;
  return { alias: `/${hit.entry.locale}${hit.rest === '/' ? '' : hit.rest}`, entry: hit.entry };
}

/** What every link builder needs (§5). `pathPrefix` undefined = today's formula. */
export interface LinkScope {
  locale: string;
  primaryLocale: string;
  /** The proxy's prefix of this request ('' = root); set only on locale-path markets. */
  pathPrefix?: string;
}

/** THE link prefix: the request's path prefix when known, else `/<locale>` for a secondary locale. */
export function linkPrefix(s: LinkScope): string {
  if (s.pathPrefix !== undefined) return s.pathPrefix;
  return s.locale && s.locale !== s.primaryLocale ? `/${s.locale}` : '';
}

/**
 * Language-switch target on a locale-path market: the visited prefix is
 * stripped and the target locale's prefix for `country` is put in front.
 * Null when the market does not use locale paths (callers keep their
 * legacy `/<locale>` code).
 */
export function localePathSwitchTarget(
  m: PathMarket | null | undefined,
  pathname: string,
  locale: string,
  country: string | null,
  allLocales: readonly string[],
): string | null {
  if (!m || !usesLocalePaths(m)) return null;
  const { rest } = stripStorePrefix(pathname, m, allLocales);
  const prefix = localePathPrefix(m, locale, country);
  return prefix ? `${prefix}${rest === '/' ? '' : rest}` : rest;
}

/**
 * `lp` of a server page: the proxy's prefix when it sent one (locale-path
 * market), else `/<urlLocale>` when the URL carried a locale prefix, else ''
 * (the pages' previous `lang ? '/' + lang : ''`, unchanged).
 */
export function pageLinkPrefix(pathPrefix: string | undefined, urlLocale: string | null | undefined): string {
  if (pathPrefix !== undefined) return pathPrefix;
  return urlLocale ? `/${urlLocale}` : '';
}
