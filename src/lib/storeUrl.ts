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
