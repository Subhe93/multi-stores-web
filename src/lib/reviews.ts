// Product reviews (M171, store app `reviews`). Pure helpers shared by the
// product route, the JSON-LD builder, the reviews block and the write form:
// no fetching, no React, no `next/*` import.
//
// Everything here is inert for a store without the app: the route reads no
// reviews, attaches nothing to the client product and adds no JSON-LD key.

import { formatLocale } from './storeLocales';

/** Highest page the public read accepts (the API clamps the same way). */
export const REVIEWS_MAX_PAGE = 200;

/** Query parameter of the reviews pagination on a product URL. */
export const REVIEWS_PAGE_PARAM = 'reviews_page';

/** Id of the reviews block (target of the stars line and the page links). */
export const REVIEWS_ANCHOR = 'reviews';

export type RatingKey = '1' | '2' | '3' | '4' | '5';
const RATING_KEYS: readonly RatingKey[] = ['1', '2', '3', '4', '5'];

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  /** Locale the review was written in (shown as written, with `lang`). */
  locale: string;
  verified: boolean;
  published_at: string | null;
  reply: { body: string; replied_at: string | null } | null;
}

export interface ReviewsSummary {
  /** One decimal, rounded by the API; 0 without reviews. */
  average: number;
  count: number;
  distribution: Record<RatingKey, number>;
}

/** `GET /storefront/:slug/products/:productSlug/reviews`. */
export interface ProductReviewsPage {
  summary: ReviewsSummary;
  items: PublicReview[];
  page: number;
  total: number;
  total_pages: number;
}

/**
 * Where the block renders: `inline` inside the product component (focused
 * layout, built-in page, monolith `product-page` section), `append` after
 * the sections of a template without the monolith (the route renders it).
 */
export type ReviewsSlot = 'inline' | 'append';

/** The `reviews` key of the client product (only present with the app on). */
export interface ProductReviewsData {
  summary: ReviewsSummary;
  items: PublicReview[];
  page: number;
  total_pages: number;
  slot: ReviewsSlot;
  /** Public path of the product page (locale / market prefix included). */
  base_path: string;
  /** Query string the page links keep (no `?`, no `reviews_page`). */
  base_query: string;
  /** Link to the write page; absent on a store without customer accounts. */
  write_href?: string;
  /** Store name of the "Reply from …" line. */
  store_name?: string;
}

/**
 * The page a `?reviews_page=` value names: an integer 1..200, anything else
 * (junk, 0, negative, too large, a repeated parameter) is page 1, so odd
 * values never create extra cache entries of the reviews read.
 */
export function reviewsPageFromQuery(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^[0-9]{1,3}$/.test(value)) return 1;
  const n = Number(value);
  return n >= 1 && n <= REVIEWS_MAX_PAGE ? n : 1;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);

function toPublicReview(raw: unknown): PublicReview | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const body = str(raw.body);
  const displayName = str(raw.display_name);
  const rating = raw.rating;
  if (!id || !body || !displayName) return null;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const reply = isObj(raw.reply) && str(raw.reply.body) ? { body: raw.reply.body as string, replied_at: str(raw.reply.replied_at) } : null;
  return {
    id,
    rating,
    title: str(raw.title) || null,
    body,
    display_name: displayName,
    locale: str(raw.locale) ?? '',
    verified: raw.verified === true,
    published_at: str(raw.published_at),
    reply,
  };
}

/**
 * The answer of the public read, copied key by key (never a spread), so a
 * field the API might add later can not reach the page or the client payload
 * by accident. Null for an answer that is not a reviews page.
 */
export function normalizeReviewsPage(raw: unknown): ProductReviewsPage | null {
  if (!isObj(raw) || !isObj(raw.summary) || !Array.isArray(raw.items)) return null;
  const dist = isObj(raw.summary.distribution) ? raw.summary.distribution : {};
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as Record<RatingKey, number>;
  for (const key of RATING_KEYS) distribution[key] = count(dist[key]);
  const average = typeof raw.summary.average === 'number' && Number.isFinite(raw.summary.average) ? raw.summary.average : 0;
  const items: PublicReview[] = [];
  for (const row of raw.items) {
    const item = toPublicReview(row);
    if (item) items.push(item);
  }
  return {
    summary: { average, count: count(raw.summary.count), distribution },
    items,
    page: count(raw.page) || 1,
    total: count(raw.total),
    // Never past the highest page the read accepts: a link to a higher
    // page would render page 1 again under another URL.
    total_pages: Math.min(count(raw.total_pages), REVIEWS_MAX_PAGE),
  };
}

/**
 * The reviews the page shows. `read(page)` is the public read; a failure
 * hides the block (null), never breaks the page. A page past the end (there
 * are reviews, but none on this page) falls back to page 1, so rating markup
 * is never rendered next to an empty list.
 */
export async function loadProductReviews(
  read: (page: number) => Promise<unknown>,
  page: number,
): Promise<ProductReviewsPage | null> {
  const get = (p: number) =>
    read(p)
      .then(normalizeReviewsPage)
      .catch(() => null);
  let result = await get(page);
  if (result && result.summary.count > 0 && result.items.length === 0) {
    result = page > 1 ? await get(1) : null;
    if (result && result.summary.count > 0 && result.items.length === 0) result = null;
  }
  return result;
}

/**
 * The query string the reviews page links keep: every parameter of the
 * request except `lang` (the proxy's form of the locale prefix, already in
 * the path) and `reviews_page` itself. `variant` (M170) stays.
 */
export function reviewsBaseQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'lang' || key === REVIEWS_PAGE_PARAM || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
  }
  return query.toString();
}

/** Link to one page of the reviews; page 1 carries no `reviews_page`. */
export function reviewsPageHref(basePath: string, baseQuery: string, page: number): string {
  const query = page > 1 ? `${baseQuery ? `${baseQuery}&` : ''}${REVIEWS_PAGE_PARAM}=${page}` : baseQuery;
  return `${basePath}${query ? `?${query}` : ''}#${REVIEWS_ANCHOR}`;
}

/**
 * Page numbers of the pagination: first, last and a window around the
 * current page; `null` marks a gap.
 */
export function reviewsPageWindow(page: number, totalPages: number): (number | null)[] {
  const out: (number | null)[] = [];
  let previous = 0;
  for (let p = 1; p <= totalPages; p += 1) {
    if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) continue;
    if (p - previous > 1) out.push(null);
    out.push(p);
    previous = p;
  }
  return out;
}

export interface ReviewsDataOptions {
  slot: ReviewsSlot;
  basePath: string;
  baseQuery: string;
  writeHref?: string | null;
  storeName?: string | null;
}

/** The client form of a reviews page (exactly the public fields). */
export function toReviewsData(page: ProductReviewsPage, options: ReviewsDataOptions): ProductReviewsData {
  return {
    summary: {
      average: page.summary.average,
      count: page.summary.count,
      distribution: { ...page.summary.distribution },
    },
    items: page.items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      display_name: r.display_name,
      locale: r.locale,
      verified: r.verified,
      published_at: r.published_at,
      reply: r.reply ? { body: r.reply.body, replied_at: r.reply.replied_at } : null,
    })),
    page: page.page,
    total_pages: page.total_pages,
    slot: options.slot,
    base_path: options.basePath,
    base_query: options.baseQuery,
    ...(options.writeHref ? { write_href: options.writeHref } : {}),
    ...(options.storeName ? { store_name: options.storeName } : {}),
  };
}

/**
 * The client product with its reviews. Without reviews (app off, failed
 * read) the SAME object is returned: no `reviews` key, so the serialized
 * product is byte-identical to a store without the app.
 */
export function withReviews<T extends object>(product: T, reviews: ProductReviewsData | null | undefined): T {
  if (!reviews) return product;
  return { ...product, reviews };
}

/** `YYYY-MM-DD` of an ISO timestamp, or undefined. */
function isoDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export interface ReviewMarkup {
  aggregateRating: Record<string, unknown>;
  review: Record<string, unknown>[];
}

/**
 * `aggregateRating` + `review` of the Product / ProductGroup JSON-LD, or
 * null: only with at least one approved review AND reviews on the rendered
 * page (Google: marked-up reviews must be visible). `review` lists exactly
 * the reviews of the rendered page. The owner reply, the verified flag and
 * owner-written customer stories are never marked up.
 */
export function reviewsLd(
  reviews: Pick<ProductReviewsPage, 'summary' | 'items'> | null | undefined,
): ReviewMarkup | null {
  if (!reviews) return null;
  const { summary, items } = reviews;
  if (!summary || !(summary.count >= 1) || !Array.isArray(items) || items.length === 0) return null;
  if (!(summary.average >= 1 && summary.average <= 5)) return null;
  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Math.round(summary.average * 10) / 10,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: items.map((r) => {
      const day = isoDay(r.published_at);
      return {
        '@type': 'Review',
        author: { '@type': 'Person', name: r.display_name },
        ...(day ? { datePublished: day } : {}),
        ...(r.title ? { name: r.title } : {}),
        reviewBody: r.body,
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      };
    }),
  };
}

/**
 * Average with exactly one decimal ("4.0"), for display. Plain digits and a
 * dot in every locale: the same text on the server and in the browser.
 */
export function formatAverage(average: number): string {
  return (Number.isFinite(average) ? average : 0).toFixed(1);
}

/** Share (0..100, integer) of one rating in the distribution. */
export function ratingShare(summary: ReviewsSummary, rating: RatingKey): number {
  if (!(summary.count > 0)) return 0;
  return Math.round((summary.distribution[rating] / summary.count) * 100);
}

/**
 * Review date, identical on the server and in the browser: the page locale
 * and a fixed UTC zone (the runtime defaults differ and would break
 * hydration). Empty for an unparsable date.
 */
export function formatReviewDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(formatLocale(locale, 'date'), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// ── Write form ───────────────────────────────────────────────────────────────
// Mirror of the API limits (`reviews/review-text.ts`). The API stays the
// authority: these checks only save a round trip and name the field.

export const REVIEW_LIMITS = {
  titleMax: 120,
  bodyMin: 10,
  bodyMax: 2000,
  nameMin: 2,
  nameMax: 60,
} as const;

export interface ReviewFormValues {
  rating: number;
  title: string;
  body: string;
  display_name: string;
}

export type ReviewFormField = 'rating' | 'title' | 'body' | 'display_name';

/** Error codes of the form; each one is a key of the `errors` messages. */
export type ReviewFormErrorCode =
  | 'REVIEW_RATING_INVALID'
  | 'REVIEW_TITLE_TOO_LONG'
  | 'REVIEW_BODY_TOO_SHORT'
  | 'REVIEW_BODY_TOO_LONG'
  | 'REVIEW_DISPLAY_NAME_INVALID';

/** Length as the API counts it (trimmed, CRLF as one character). */
export function reviewTextLength(value: string): number {
  return value.replace(/\r\n/g, '\n').trim().length;
}

/** Field errors of the form values; empty when the form may be sent. */
export function validateReviewForm(values: ReviewFormValues): Partial<Record<ReviewFormField, ReviewFormErrorCode>> {
  const errors: Partial<Record<ReviewFormField, ReviewFormErrorCode>> = {};
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) errors.rating = 'REVIEW_RATING_INVALID';
  if (reviewTextLength(values.title) > REVIEW_LIMITS.titleMax) errors.title = 'REVIEW_TITLE_TOO_LONG';
  const bodyLength = reviewTextLength(values.body);
  if (bodyLength < REVIEW_LIMITS.bodyMin) errors.body = 'REVIEW_BODY_TOO_SHORT';
  else if (bodyLength > REVIEW_LIMITS.bodyMax) errors.body = 'REVIEW_BODY_TOO_LONG';
  const name = values.display_name.trim();
  const nameOk =
    name.length >= REVIEW_LIMITS.nameMin &&
    name.length <= REVIEW_LIMITS.nameMax &&
    /\p{L}/u.test(name) &&
    // Email / link / phone guard (the name is public).
    !/@|http|www\.|:\/\//i.test(name) &&
    (name.match(/[0-9]/g) ?? []).length < 6;
  if (!nameOk) errors.display_name = 'REVIEW_DISPLAY_NAME_INVALID';
  return errors;
}

/** The form field a coded API error belongs to, or null (a form-level error). */
export function reviewErrorField(code: string | null | undefined): ReviewFormField | null {
  switch (code) {
    case 'REVIEW_RATING_INVALID':
      return 'rating';
    case 'REVIEW_TITLE_TOO_LONG':
      return 'title';
    case 'REVIEW_BODY_TOO_SHORT':
    case 'REVIEW_BODY_TOO_LONG':
    case 'REVIEW_TEXT_INVALID':
      return 'body';
    case 'REVIEW_DISPLAY_NAME_INVALID':
      return 'display_name';
    default:
      return null;
  }
}

/** Codes that end the flow with a full-page state instead of a field error. */
export function reviewFatalState(code: string | null | undefined): 'link_invalid' | 'not_eligible' | 'unavailable' | null {
  if (code === 'REVIEW_LINK_INVALID') return 'link_invalid';
  if (code === 'REVIEW_ORDER_NOT_ELIGIBLE') return 'not_eligible';
  if (code === 'STORE_APP_NOT_ENABLED' || code === 'REVIEW_PRODUCT_NOT_FOUND') return 'unavailable';
  return null;
}

/** The locale a review is stored with: `xx` or `xx-YY` (API rule), else 'en'. */
export function reviewLocale(locale: string | null | undefined): string {
  const m = /^([a-zA-Z]{2})(?:[-_]([a-zA-Z]{2}))?$/.exec((locale ?? '').trim());
  if (!m) return 'en';
  return m[2] ? `${m[1]!.toLowerCase()}-${m[2].toUpperCase()}` : m[1]!.toLowerCase();
}
