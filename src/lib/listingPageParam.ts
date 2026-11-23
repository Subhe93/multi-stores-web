// Crawlable pagination of the product listings (/products and collection
// pages, M166 A). Pure module: no `next/*` imports, shared by the server
// routes and the client listing components.
//
// URL contract:
//   - page 1 is the clean URL (no `page` key);
//   - page N > 1 is `?page=N` (canonical form `^[1-9]\d{0,3}$`);
//   - any other `page` value (1, 01, 0, -1, 2.5, abc, repeated keys) is not
//     canonical: the route answers one 308 to the URL without `page`;
//   - a page beyond the last one is a 404 (a missing page must not answer
//     with other content, and the last page moves as the catalogue shrinks).

/** Upper bound of the canonical form (4 digits). */
export const MAX_LISTING_PAGE = 9999;

export type ListingPageParam = { page: number } | { redirect: true };

/**
 * The `page` query value of a listing URL. Absent = page 1; canonical
 * N > 1 = that page; anything else asks for a redirect to the clean URL.
 */
export function parseListingPage(value: string | string[] | undefined | null): ListingPageParam {
  if (value === undefined || value === null) return { page: 1 };
  if (typeof value !== 'string') return { redirect: true };
  if (!/^[1-9]\d{0,3}$/.test(value)) return { redirect: true };
  const page = Number(value);
  // `?page=1` duplicates the clean URL.
  if (page === 1) return { redirect: true };
  return { page };
}

/** Number of pages of a listing (at least 1, so an empty listing has page 1). */
export function listingTotalPages(total: number, pageSize: number): number {
  if (!(pageSize > 0) || !(total > 0)) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** True when `page` lies beyond the last page of the listing. */
export function isListingPageOutOfRange(page: number, total: number, pageSize: number): boolean {
  return page > listingTotalPages(total, pageSize);
}

/** Where the links of a listing point: path (with locale/market prefix) and query. */
export interface ListingLinkBase {
  /** Path with the request's link prefix (`/de-de/products`, `/ar/collections/x`). */
  path: string;
  /** Query string without `page` ('' when plain); fixed key order. `lang`
   *  is dropped: the locale lives in the path prefix (the proxy turns
   *  `/<locale>/...` into `?lang=` internally). */
  query: string;
}

/**
 * Href of page `page` of a listing: the query of the base with `page` set
 * last (dropped for page 1). Key order is fixed so every link to a page is
 * the same string (one cache entry, one URL for crawlers).
 */
export function listingPageHref(base: ListingLinkBase, page: number): string {
  const params = new URLSearchParams(base.query);
  params.delete('page');
  params.delete('lang');
  if (page > 1) params.set('page', String(page));
  // Readable lists (`color=black,navy`), like the explorer's own URLs.
  const qs = params.toString().replace(/%2C/gi, ',');
  return `${base.path}${qs ? `?${qs}` : ''}`;
}

/**
 * The query of a listing URL without `page` and `lang`, in a fixed order of
 * the given keys (the routes' own filter keys). Repeated values are kept.
 */
export function listingBaseQuery(
  query: Record<string, string | string[] | undefined>,
  keys: readonly string[],
): string {
  const params = new URLSearchParams();
  for (const key of keys) {
    if (key === 'page' || key === 'lang') continue;
    const value = query[key];
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v !== '') params.append(key, v);
  }
  return params.toString();
}

/** Server-rendered pager of a listing (prev / numbered pages / next). */
export interface ListingPagerModel {
  page: number;
  /** Last page shown (load more extends the view; equals `page` on the server). */
  lastShown: number;
  totalPages: number;
  prevHref?: string;
  nextHref?: string;
  /** Numbered links: `null` stands for a gap ("..."). */
  items: Array<{ page: number; href: string; current: boolean } | null>;
}

/**
 * Pager of pages `first..lastShown` of `totalPages`: prev = first - 1,
 * next = lastShown + 1, numbered links in a compact window (first, last and
 * the neighbours of the shown range).
 */
export function buildListingPager(
  base: ListingLinkBase,
  first: number,
  lastShown: number,
  totalPages: number,
): ListingPagerModel {
  const last = Math.max(first, Math.min(lastShown, totalPages));
  const wanted = new Set<number>([1, totalPages]);
  for (let p = first - 1; p <= last + 1; p++) if (p >= 1 && p <= totalPages) wanted.add(p);
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: ListingPagerModel['items'] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push(null);
    items.push({ page: p, href: listingPageHref(base, p), current: p >= first && p <= last });
    prev = p;
  }
  return {
    page: first,
    lastShown: last,
    totalPages,
    ...(first > 1 ? { prevHref: listingPageHref(base, first - 1) } : {}),
    ...(last < totalPages ? { nextHref: listingPageHref(base, last + 1) } : {}),
    items,
  };
}

/** `canonical` of page N (> 1): the page itself. Page 1 is unchanged. */
export function listingPageCanonical(canonical: string, page: number): string {
  if (page <= 1) return canonical;
  return `${canonical}${canonical.includes('?') ? '&' : '?'}page=${page}`;
}
