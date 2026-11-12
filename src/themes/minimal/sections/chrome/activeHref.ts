// Pure "is this nav link the current page?" rule, shared by ActiveLink and the
// mega-style desktop nav. Kept out of the client module so it can be unit
// tested in the node project.

import { decodeRouteParam } from '@/lib/slugRoute';

/** Read access to the current query string (URLSearchParams-compatible). */
export interface QueryReader {
  get(name: string): string | null;
}

/**
 * Whether `href` points at the current page.
 *
 * - A link WITHOUT a query string compares on the pathname only: an exact
 *   match, or (unless `exact`) a prefix match so `/products/123` keeps
 *   "Products" active. The current query is ignored, so `/products` stays
 *   active on `/products?sort=newest`.
 * - A link WITH a query string is one filtered view of a page: the pathname
 *   must be equal and every parameter of the link must be present with the
 *   same value. Several `/products?…` items therefore never light up together.
 */
export function isActiveHref(
  href: string | undefined,
  pathname: string,
  query: QueryReader | null | undefined,
  exact?: boolean,
): boolean {
  const noHash = (href || '').split('#')[0];
  const q = noHash.indexOf('?');
  // Both sides percent-decoded: menu hrefs carry raw slugs (`/collections/kläder`,
  // Arabic) while the pathname may be encoded.
  const hrefPath = decodeRouteParam(q === -1 ? noHash : noHash.slice(0, q));
  const current = decodeRouteParam(pathname || '');
  if (!hrefPath) return false;

  const wanted = q === -1 ? [] : Array.from(new URLSearchParams(noHash.slice(q + 1)));
  if (wanted.length > 0) {
    if (current !== hrefPath) return false;
    return wanted.every(([key, value]) => query?.get(key) === value);
  }

  return exact ? current === hrefPath : current === hrefPath || current.startsWith(hrefPath + '/');
}
