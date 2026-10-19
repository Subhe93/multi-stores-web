import { marketHreflangCode } from './market-routing';

/** The slice of a market needed to build URLs for it (M1-DESIGN §4.3). */
export interface MarketUrlInput {
  key: string;
  is_default: boolean;
  countries: string[];
  default_locale: string;
  locales: string[];
  primary_hostname: string | null;
  status?: string;
}

/**
 * Build the canonical origin for a store's storefront. This is the URL search
 * engines (and customers) should see — NOT the internal `/store/{slug}/...`
 * path. The proxy rewrites subdomain → `/store/{slug}/...` for routing, so the
 * `/store/...` path is an implementation detail that should never appear in
 * sitemaps, canonical tags, robots files, or social meta.
 *
 * Priority: market.primary_hostname (markets app only) → store.custom_domain
 * → `{slug}.{platformHost}` derived from NEXT_PUBLIC_WEB_URL (with a sane
 * localhost fallback for dev). Stores without a market pass nothing for the
 * third argument and get exactly the previous result.
 */
export function buildStoreOrigin(
  storeSlug: string,
  customDomain?: string | null,
  market?: { primary_hostname?: string | null; preview?: boolean; key?: string } | null,
): string {
  if (market?.primary_hostname) {
    return `https://${market.primary_hostname}`;
  }
  // A market previewed before any hostname is configured has no public URL
  // but its own preview host; the default market's hosts below would be
  // the wrong origin for its pages.
  if (market?.preview && market.key) {
    return previewOrigin(storeSlug, market.key);
  }
  if (customDomain) {
    return `https://${customDomain}`;
  }
  const base = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
  try {
    const url = new URL(base);
    return `${url.protocol}//${storeSlug}.${url.host}`;
  } catch {
    return `http://${storeSlug}.localhost:3003`;
  }
}

/**
 * Origin of the market-preview host: `<slug>--<key>` as ONE label under the
 * platform host of NEXT_PUBLIC_WEB_URL, so the wildcard record and the
 * certificate of `<slug>.<platform host>` cover it.
 */
export function previewOrigin(storeSlug: string, marketKey: string): string {
  const base = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
  try {
    const url = new URL(base);
    return `${url.protocol}//${storeSlug}--${marketKey}.${url.host}`;
  } catch {
    return `http://${storeSlug}--${marketKey}.localhost:3003`;
  }
}

/** Platform host from NEXT_PUBLIC_WEB_URL (lower-case, no port, no `www.`). */
function platformHost(): string | null {
  const base = process.env.NEXT_PUBLIC_WEB_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Make a stored link safe for the host it is rendered on. Builder content
 * sometimes carries an absolute platform URL (`https://iwings-digital.com/
 * products`, `https://<slug>.iwings-digital.com/cart`): on a custom domain
 * that sends the visitor to another host and loses the cart cookie. A URL
 * whose host is the platform host, any `<slug>.` subdomain of it, or the
 * `www.` form of either, becomes a relative path (path + query + hash).
 * Everything else — external links, mailto/tel, relative paths — is returned
 * unchanged.
 */
export function storeHref(raw: string): string {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return raw;
  const platform = platformHost();
  if (!platform) return raw;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return raw;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== platform && !host.endsWith(`.${platform}`)) return raw;
  return `${url.pathname}${url.search}${url.hash}` || '/';
}

/**
 * Build a locale-prefixed URL for the store storefront. The primary locale has
 * NO prefix (e.g. `https://mystore.com/products/foo`); secondary locales use
 * `/{locale}/...` (e.g. `https://mystore.com/ar/products/foo`). This is what
 * the proxy expects for store subdomains, and is the form Google prefers for
 * hreflang alternates (path-prefix, not query strings).
 *
 * `path` must start with `/` or be the empty string for the storefront root.
 */
export function storeLocalePath(
  origin: string,
  locale: string,
  primaryLocale: string,
  path: string = '',
): string {
  const safePath = path === '/' ? '' : path;
  return locale === primaryLocale
    ? `${origin}${safePath}`
    : `${origin}/${locale}${safePath}`;
}

/**
 * The `alternates` block for a storefront page.
 *
 * The canonical is the URL of the page being rendered IN ITS OWN LOCALE. It
 * used to always point at the primary locale, which contradicted the hreflang
 * set emitted beside it: the page simultaneously claimed to be a duplicate of
 * the primary-locale page and to be an indexable alternate. Search engines
 * resolve that contradiction by dropping the secondary-locale pages, so every
 * translated page was effectively unindexable.
 *
 * `x-default` points at the primary locale, which is what an unmatched visitor
 * should land on.
 *
 * @param path Sub-path starting with `/`, or '' for the storefront root.
 */
export function buildStoreAlternates(opts: {
  origin: string;
  /** The locale actually being rendered. */
  locale: string;
  primaryLocale: string;
  secondaryLocales?: string[];
  path?: string;
  /**
   * Markets app only (M1-DESIGN §4.3 / D9): every LIVE market of the store.
   * When given, hreflang covers each market × locale on that market's origin
   * (`lang-COUNTRY` for single-country markets), collisions keep the default
   * market and `x-default` is the default market's default locale. Omitted or
   * empty → today's single-origin output, untouched.
   */
  markets?: MarketUrlInput[] | null;
  /** Needed with `markets` to build the platform origin of a market without
   *  its own hostname. Falls back to `origin`. */
  storeSlug?: string;
  /** Per-locale sub-path (translated product slugs); `path` is the fallback. */
  pathByLocale?: Record<string, string | undefined> | null;
  /**
   * The request market. On a market PREVIEW (`preview: true`) the page is
   * noindex: the canonical points at the market's real hostname (origin,
   * i.e. its configured primary, else the preview host itself) and no
   * hreflang is advertised at all. Null/undefined/LIVE: no effect.
   */
  market?: { preview?: boolean } | null;
}): { canonical: string; languages: Record<string, string> } {
  const { origin, locale, primaryLocale, secondaryLocales = [], path = '' } = opts;
  const allLocales = Array.from(new Set([primaryLocale, ...secondaryLocales]));

  if (opts.market?.preview) {
    const selfLocale = allLocales.includes(locale) ? locale : primaryLocale;
    const selfPath = opts.pathByLocale?.[selfLocale] ?? path;
    return { canonical: storeLocalePath(origin, selfLocale, primaryLocale, selfPath), languages: {} };
  }

  // Only LIVE markets, and a non-default market needs its own hostname: the
  // platform subdomain always serves the default market, so a hostless
  // secondary market has no URL to advertise (L5).
  const liveMarkets = (opts.markets ?? []).filter(isServableMarket);
  if (liveMarkets.length > 0) {
    return buildMarketAlternates({
      origin,
      locale,
      primaryLocale,
      allLocales,
      path,
      markets: liveMarkets,
      platformOrigin: opts.storeSlug ? buildStoreOrigin(opts.storeSlug, null) : origin,
      pathByLocale: opts.pathByLocale ?? {},
    });
  }

  const languages: Record<string, string> = {};
  for (const l of allLocales) {
    languages[l] = storeLocalePath(origin, l, primaryLocale, path);
  }
  languages['x-default'] = storeLocalePath(origin, primaryLocale, primaryLocale, path);

  // Only advertise a locale we actually serve — an unknown `?lang=` must not
  // mint a canonical for a page that does not exist.
  const selfLocale = allLocales.includes(locale) ? locale : primaryLocale;
  return {
    canonical: storeLocalePath(origin, selfLocale, primaryLocale, path),
    languages,
  };
}

/** LIVE and reachable: the default market always is; others need a hostname. */
export function isServableMarket(m: Pick<MarketUrlInput, 'is_default' | 'primary_hostname' | 'status'>): boolean {
  if (m.status && m.status !== 'LIVE') return false;
  return m.is_default || Boolean(m.primary_hostname);
}

/** Origin a market is served on: its own hostname, else the platform subdomain. */
export function marketOrigin(market: Pick<MarketUrlInput, 'primary_hostname'>, platformOrigin: string): string {
  return market.primary_hostname ? `https://${market.primary_hostname}` : platformOrigin;
}

// Markets branch of buildStoreAlternates (kept apart so the legacy body above
// stays byte-for-byte the same for stores without the app).
function buildMarketAlternates(opts: {
  origin: string;
  locale: string;
  primaryLocale: string;
  allLocales: string[];
  path: string;
  markets: MarketUrlInput[];
  platformOrigin: string;
  pathByLocale: Record<string, string | undefined>;
}): { canonical: string; languages: Record<string, string> } {
  const { origin, locale, primaryLocale, allLocales, path, markets, platformOrigin, pathByLocale } = opts;
  const defaultMarket = markets.find((m) => m.is_default) ?? markets[0]!;

  const languages: Record<string, string> = {};
  // Owner market of each emitted code, so a later collision from a
  // non-default market never overwrites the default market's URL.
  const owner: Record<string, MarketUrlInput> = {};
  for (const m of markets) {
    const mOrigin = marketOrigin(m, platformOrigin);
    for (const l of Array.from(new Set([m.default_locale, ...m.locales]))) {
      const code = marketHreflangCode(m, l);
      const existing = owner[code];
      if (existing && (existing.is_default || !m.is_default)) continue;
      languages[code] = storeLocalePath(mOrigin, l, m.default_locale, pathByLocale[l] ?? path);
      owner[code] = m;
    }
  }
  languages['x-default'] = storeLocalePath(
    marketOrigin(defaultMarket, platformOrigin),
    defaultMarket.default_locale,
    defaultMarket.default_locale,
    pathByLocale[defaultMarket.default_locale] ?? path,
  );

  // Canonical = this page on the CURRENT market's origin, in its own locale.
  const selfLocale = allLocales.includes(locale) ? locale : primaryLocale;
  return {
    canonical: storeLocalePath(origin, selfLocale, primaryLocale, pathByLocale[selfLocale] ?? path),
    languages,
  };
}
