// Slug handling for storefront routes (WordPress 'query' context).
//
// Next 16 hands dynamic route params to pages still percent-ENCODED (each
// segment goes through encodeURIComponent before it reaches user code), so
// `/collections/kläder` arrives as `kl%C3%A4der`. Slugs are stored decoded and
// NFC, so every param is decoded + normalized before it is compared in JS or
// sent to the API, and every slug written into an absolute URL (canonical,
// hreflang, sitemap, JSON-LD) is percent-encoded per segment.
//
// Pure functions only: imported by client components, never `next/*`.

import {
  decodePercentOctets,
  encodeSlugForUrl,
  normalizeSlugForLookup,
  toWellFormed,
} from '@multi-stores/core/slug';

/** Lookup form of a route param: percent-decoded, lowercase, NFC. */
export function routeSlug(param: string | null | undefined): string {
  return normalizeSlugForLookup(param ?? '');
}

/** `routeSlug` for each segment of a catch-all param. */
export function routeSlugs(params: string[] | null | undefined): string[] {
  return (params ?? []).map(routeSlug);
}

/**
 * The characters the visitor actually requested: percent-decoded only (case
 * and Unicode form kept). Malformed escapes are left as they are.
 */
export function decodeRouteParam(param: string | null | undefined): string {
  return decodePercentOctets(toWellFormed(String(param ?? '')), 'keep');
}

/** True when two slugs are the same handle under lookup normalization. */
export function slugsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeSlugForLookup(a ?? '') === normalizeSlugForLookup(b ?? '');
}

/**
 * True when the requested param resolves to `stored` only through
 * normalization (different letter case or Unicode form), i.e. the request
 * should be redirected to the stored form. Percent-hex case is invisible
 * here (Next re-encodes params), so it never triggers a redirect.
 */
export function isNonCanonicalSlugForm(param: string, stored: string): boolean {
  // Never redirect towards a stored slug that itself holds decodable %xx
  // octets: the rebuilt URL would decode to the same param and loop.
  return (
    decodeRouteParam(stored) === stored &&
    decodeRouteParam(param) !== stored &&
    slugsEqual(param, stored)
  );
}

/**
 * A slug that can be used in a product URL: at least one letter or digit in
 * any script (Arabic, accented Latin, …). Empty or punctuation-only slugs
 * (a stray "-") would 404, so callers fall back to another translation.
 */
export function isUsableSlug(slug: string | null | undefined): slug is string {
  return !!slug && /[\p{L}\p{N}]/u.test(slug);
}

/**
 * Percent-encode every path segment of a URL path (lowercase hex, like WP
 * permalinks). Idempotent: a segment that is already encoded is decoded
 * first, so `/kl%C3%A4der` and `/kläder` both become `/kl%c3%a4der`. A query
 * string or fragment is kept as is.
 */
export function encodeUrlPath(path: string): string {
  if (!path) return path;
  const cut = path.search(/[?#]/);
  const pathname = cut >= 0 ? path.slice(0, cut) : path;
  const rest = cut >= 0 ? path.slice(cut) : '';
  const encoded = pathname
    .split('/')
    // An encoded `/` inside a segment (`%2F`) must stay encoded.
    .map((segment) =>
      encodeSlugForUrl(decodePercentOctets(toWellFormed(segment), 'keep')).split('/').join('%2f'),
    )
    .join('/');
  return `${encoded}${rest}`;
}

/**
 * Public URL of a canonical-form redirect from a storefront page: the locale
 * prefix the proxy turned into `?lang=` is restored, the path is encoded and
 * every other query parameter is kept.
 */
export function canonicalRedirectHref(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const lang = typeof searchParams.lang === 'string' ? searchParams.lang : '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'lang' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
  }
  const qs = query.toString();
  return `${lang ? `/${encodeURIComponent(lang)}` : ''}${encodeUrlPath(path)}${qs ? `?${qs}` : ''}`;
}
