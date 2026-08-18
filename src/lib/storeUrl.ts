/**
 * Build the canonical origin for a store's storefront. This is the URL search
 * engines (and customers) should see — NOT the internal `/store/{slug}/...`
 * path. The proxy rewrites subdomain → `/store/{slug}/...` for routing, so the
 * `/store/...` path is an implementation detail that should never appear in
 * sitemaps, canonical tags, robots files, or social meta.
 *
 * Priority: store.custom_domain → `{slug}.{platformHost}` derived from
 * NEXT_PUBLIC_WEB_URL (with a sane localhost fallback for dev).
 */
export function buildStoreOrigin(
  storeSlug: string,
  customDomain?: string | null,
): string {
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
}): { canonical: string; languages: Record<string, string> } {
  const { origin, locale, primaryLocale, secondaryLocales = [], path = '' } = opts;
  const allLocales = Array.from(new Set([primaryLocale, ...secondaryLocales]));

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
