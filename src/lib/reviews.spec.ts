import { describe, expect, it, vi } from 'vitest';
import {
  REVIEWS_MAX_PAGE,
  formatAverage,
  formatReviewDate,
  loadProductReviews,
  normalizeReviewsPage,
  ratingShare,
  reviewErrorField,
  reviewFatalState,
  reviewLocale,
  reviewsBaseQuery,
  reviewsLd,
  reviewsPageFromQuery,
  reviewsPageHref,
  reviewsPageWindow,
  toReviewsData,
  validateReviewForm,
  withReviews,
  type ProductReviewsPage,
  type PublicReview,
} from './reviews';

const review = (over: Partial<PublicReview> = {}): PublicReview => ({
  id: 'r1',
  rating: 5,
  title: 'Perfect gift',
  body: 'Fast delivery and the engraving looks great.',
  display_name: 'Anna S.',
  locale: 'sv',
  verified: true,
  published_at: '2026-11-20T10:12:00.000Z',
  reply: null,
  ...over,
});

const page = (over: Partial<ProductReviewsPage> = {}): ProductReviewsPage => ({
  summary: { average: 4.6, count: 12, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 8 } },
  items: [review()],
  page: 1,
  total: 12,
  total_pages: 2,
  ...over,
});

describe('reviewsPageFromQuery', () => {
  it('accepts an integer 1..200', () => {
    expect(reviewsPageFromQuery('1')).toBe(1);
    expect(reviewsPageFromQuery('2')).toBe(2);
    expect(reviewsPageFromQuery(String(REVIEWS_MAX_PAGE))).toBe(200);
  });

  it('junk, 0, negative, too large and arrays are page 1', () => {
    for (const value of ['', 'abc', '0', '-3', '201', '9999', '2.5', '1e2', ' 2', '2 ', '02x', '٢']) {
      expect(reviewsPageFromQuery(value)).toBe(1);
    }
    expect(reviewsPageFromQuery(undefined)).toBe(1);
    expect(reviewsPageFromQuery(['2', '3'])).toBe(1);
    expect(reviewsPageFromQuery(['2'])).toBe(1);
  });
});

describe('normalizeReviewsPage', () => {
  it('copies exactly the documented keys', () => {
    const raw = {
      ...page({ items: [review({ reply: { body: 'Thank you!', replied_at: '2026-11-21T08:00:00.000Z' } })] }),
      secret: 'x',
    };
    (raw.items[0] as unknown as Record<string, unknown>).customer_id = 'c1';
    (raw.items[0] as unknown as Record<string, unknown>).order_id = 'o1';
    (raw.items[0] as unknown as Record<string, unknown>).email = 'a@b.se';
    (raw.summary as unknown as Record<string, unknown>).store_id = 's1';
    const out = normalizeReviewsPage(raw)!;
    expect(Object.keys(out).sort()).toEqual(['items', 'page', 'summary', 'total', 'total_pages']);
    expect(Object.keys(out.summary).sort()).toEqual(['average', 'count', 'distribution']);
    expect(Object.keys(out.items[0]!).sort()).toEqual(
      ['body', 'display_name', 'id', 'locale', 'published_at', 'rating', 'reply', 'title', 'verified'],
    );
    expect(JSON.stringify(out)).not.toMatch(/customer_id|order_id|a@b\.se|store_id|secret/);
    expect(out.items[0]!.reply).toEqual({ body: 'Thank you!', replied_at: '2026-11-21T08:00:00.000Z' });
  });

  it('null for an answer that is not a reviews page', () => {
    for (const raw of [null, undefined, 'x', [], {}, { summary: {} }, { items: [] }]) {
      expect(normalizeReviewsPage(raw)).toBeNull();
    }
  });

  it('drops malformed rows and repairs counters', () => {
    const out = normalizeReviewsPage({
      summary: { average: 'x', count: -2, distribution: { '5': 2, '9': 4, '1': 'a' } },
      items: [review(), { id: 'bad' }, review({ id: 'r2', rating: 7 }), null],
      page: 0,
    })!;
    expect(out.items.map((r) => r.id)).toEqual(['r1']);
    expect(out.summary).toEqual({ average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 2 } });
    expect(out.page).toBe(1);
    expect(out.total_pages).toBe(0);
  });

  it('never reports more pages than the read accepts (no link to a page that renders page 1 again)', () => {
    const out = normalizeReviewsPage(page({ total: 2500, total_pages: 250 }))!;
    expect(out.total_pages).toBe(REVIEWS_MAX_PAGE);
    expect(out.total).toBe(2500);
    expect(reviewsPageFromQuery(String(out.total_pages))).toBe(REVIEWS_MAX_PAGE);
    expect(normalizeReviewsPage(page({ total_pages: 2 }))!.total_pages).toBe(2);
  });
});

describe('loadProductReviews', () => {
  it('returns the requested page', async () => {
    const read = vi.fn(async () => page({ page: 2 }));
    expect((await loadProductReviews(read, 2))?.page).toBe(2);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(2);
  });

  it('a failed read hides the block', async () => {
    expect(await loadProductReviews(async () => Promise.reject(new Error('503')), 1)).toBeNull();
    expect(await loadProductReviews(async () => ({ nonsense: true }), 1)).toBeNull();
  });

  it('a page past the end renders page 1', async () => {
    const read = vi.fn(async (p: number) => (p === 1 ? page() : page({ items: [], page: p })));
    const out = await loadProductReviews(read, 9);
    expect(read.mock.calls.map((c) => c[0])).toEqual([9, 1]);
    expect(out?.page).toBe(1);
    expect(out?.items).toHaveLength(1);
  });

  it('never rating markup next to an empty list', async () => {
    expect(await loadProductReviews(async () => page({ items: [] }), 1)).toBeNull();
    expect(await loadProductReviews(async () => page({ items: [] }), 3)).toBeNull();
  });

  it('zero approved reviews is a valid (empty) answer', async () => {
    const empty = page({ summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }, items: [], total: 0, total_pages: 0 });
    const read = vi.fn(async () => empty);
    expect(await loadProductReviews(read, 4)).toEqual(empty);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('page links', () => {
  it('page 1 carries no parameter, later pages do', () => {
    expect(reviewsPageHref('/products/mug', '', 1)).toBe('/products/mug#reviews');
    expect(reviewsPageHref('/products/mug', '', 3)).toBe('/products/mug?reviews_page=3#reviews');
  });

  it('other query parameters are kept', () => {
    expect(reviewsPageHref('/de-de/products/kette', 'variant=abc', 1)).toBe('/de-de/products/kette?variant=abc#reviews');
    expect(reviewsPageHref('/de-de/products/kette', 'variant=abc', 2)).toBe(
      '/de-de/products/kette?variant=abc&reviews_page=2#reviews',
    );
  });

  it('reviewsBaseQuery drops lang and reviews_page, keeps the rest encoded', () => {
    expect(reviewsBaseQuery({ lang: 'de', reviews_page: '4', variant: 'v1', utm: ['a b', 'c'], none: undefined })).toBe(
      'variant=v1&utm=a+b&utm=c',
    );
    expect(reviewsBaseQuery({ lang: 'de' })).toBe('');
    expect(reviewsBaseQuery({ x: '"><script>' })).toBe('x=%22%3E%3Cscript%3E');
  });

  it('page window: first, last and the neighbours', () => {
    expect(reviewsPageWindow(1, 1)).toEqual([1]);
    expect(reviewsPageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(reviewsPageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(reviewsPageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(reviewsPageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});

describe('toReviewsData / withReviews', () => {
  const options = { slot: 'inline' as const, basePath: '/products/mug', baseQuery: '' };

  it('exactly the public fields plus the page context', () => {
    const data = toReviewsData(page(), { ...options, writeHref: '/reviews/write?product=p1', storeName: 'Namez' });
    expect(Object.keys(data).sort()).toEqual(
      ['base_path', 'base_query', 'items', 'page', 'slot', 'store_name', 'summary', 'total_pages', 'write_href'],
    );
    expect(Object.keys(data.items[0]!).sort()).toEqual(
      ['body', 'display_name', 'id', 'locale', 'published_at', 'rating', 'reply', 'title', 'verified'],
    );
  });

  it('optional keys are absent, not null', () => {
    const data = toReviewsData(page(), { ...options, writeHref: null, storeName: '' });
    expect(data).not.toHaveProperty('write_href');
    expect(data).not.toHaveProperty('store_name');
  });

  it('without reviews the product is the same object (no extra key)', () => {
    const product = { id: 'p1', base_price: 10 };
    expect(withReviews(product, null)).toBe(product);
    expect(withReviews(product, undefined)).toBe(product);
    expect(JSON.stringify(withReviews(product, null))).toBe('{"id":"p1","base_price":10}');
  });

  it('with reviews the key is added to a copy', () => {
    const product = { id: 'p1' };
    const data = toReviewsData(page(), options);
    const out = withReviews(product, data);
    expect(out).not.toBe(product);
    expect(product).not.toHaveProperty('reviews');
    expect((out as { reviews?: unknown }).reviews).toBe(data);
  });
});

describe('reviewsLd', () => {
  it('null without reviews, at count 0 and without rendered items', () => {
    expect(reviewsLd(null)).toBeNull();
    expect(reviewsLd(undefined)).toBeNull();
    expect(reviewsLd(page({ summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }, items: [] }))).toBeNull();
    expect(reviewsLd(page({ items: [] }))).toBeNull();
  });

  it('aggregateRating: one decimal number, count, best and worst rating', () => {
    const ld = reviewsLd(page())!;
    expect(ld.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.6,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
    expect(JSON.stringify(ld.aggregateRating)).toContain('"ratingValue":4.6');
    expect(reviewsLd(page({ summary: { ...page().summary, average: 4.6499999 } }))!.aggregateRating.ratingValue).toBe(4.6);
    expect(reviewsLd(page({ summary: { ...page().summary, average: 5 } }))!.aggregateRating.ratingValue).toBe(5);
  });

  it('review: Person author, date as YYYY-MM-DD, body and rating', () => {
    const ld = reviewsLd(page())!;
    expect(ld.review).toEqual([
      {
        '@type': 'Review',
        author: { '@type': 'Person', name: 'Anna S.' },
        datePublished: '2026-11-20',
        name: 'Perfect gift',
        reviewBody: 'Fast delivery and the engraving looks great.',
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
      },
    ]);
  });

  it('name only with a title, datePublished only with a valid date', () => {
    const ld = reviewsLd(page({ items: [review({ title: null, published_at: null }), review({ id: 'r2', title: '', published_at: 'nope' })] }))!;
    for (const r of ld.review) {
      expect(r).not.toHaveProperty('name');
      expect(r).not.toHaveProperty('datePublished');
    }
  });

  it('lists exactly the rendered reviews; reply and verified flag are not marked up', () => {
    const items = [review({ reply: { body: 'Thanks', replied_at: null } }), review({ id: 'r2', rating: 3 })];
    const ld = reviewsLd(page({ items }))!;
    expect(ld.review).toHaveLength(2);
    expect(JSON.stringify(ld)).not.toMatch(/Thanks|verified|itemReviewed|"id"/);
  });

  it('an average outside 1..5 emits nothing', () => {
    expect(reviewsLd(page({ summary: { ...page().summary, average: 0 } }))).toBeNull();
    expect(reviewsLd(page({ summary: { ...page().summary, average: 5.4 } }))).toBeNull();
  });
});

describe('display helpers', () => {
  it('formatAverage: always one decimal with a dot', () => {
    expect(formatAverage(4)).toBe('4.0');
    expect(formatAverage(4.6)).toBe('4.6');
    expect(formatAverage(Number.NaN)).toBe('0.0');
  });

  it('ratingShare', () => {
    const { summary } = page();
    expect(ratingShare(summary, '5')).toBe(67);
    expect(ratingShare(summary, '1')).toBe(0);
    expect(ratingShare({ average: 0, count: 0, distribution: summary.distribution }, '5')).toBe(0);
  });

  it('formatReviewDate: page locale, fixed UTC zone', () => {
    expect(formatReviewDate('2026-11-20T23:30:00.000Z', 'en')).toBe('November 20, 2026');
    expect(formatReviewDate('2026-11-20T00:10:00.000Z', 'sv')).toBe('20 november 2026');
    expect(formatReviewDate(null, 'en')).toBe('');
    expect(formatReviewDate('nope', 'en')).toBe('');
  });
});

describe('write form', () => {
  const ok = { rating: 4, title: '', body: 'A very nice mug.', display_name: 'Anna S.' };

  it('valid values have no errors', () => {
    expect(validateReviewForm(ok)).toEqual({});
  });

  it('rating must be an integer 1..5', () => {
    for (const rating of [0, 6, 2.5, Number.NaN]) {
      expect(validateReviewForm({ ...ok, rating }).rating).toBe('REVIEW_RATING_INVALID');
    }
  });

  it('text limits (trimmed)', () => {
    expect(validateReviewForm({ ...ok, body: '   short   ' }).body).toBe('REVIEW_BODY_TOO_SHORT');
    expect(validateReviewForm({ ...ok, body: 'x'.repeat(2001) }).body).toBe('REVIEW_BODY_TOO_LONG');
    expect(validateReviewForm({ ...ok, body: 'x'.repeat(2000) }).body).toBeUndefined();
    expect(validateReviewForm({ ...ok, title: 'x'.repeat(121) }).title).toBe('REVIEW_TITLE_TOO_LONG');
    expect(validateReviewForm({ ...ok, title: 'x'.repeat(120) }).title).toBeUndefined();
  });

  it('display name guard: length, a letter, no email / link / phone', () => {
    for (const display_name of ['', 'A', 'x'.repeat(61), '12345', 'anna@example.se', 'http anna', 'www.anna.se', 'a://b', 'Anna 0701234567']) {
      expect(validateReviewForm({ ...ok, display_name }).display_name).toBe('REVIEW_DISPLAY_NAME_INVALID');
    }
    for (const display_name of ['Anna S.', 'علاء', 'Åsa', 'Anna 12345']) {
      expect(validateReviewForm({ ...ok, display_name }).display_name).toBeUndefined();
    }
  });

  it('coded errors map to their field', () => {
    expect(reviewErrorField('REVIEW_RATING_INVALID')).toBe('rating');
    expect(reviewErrorField('REVIEW_TITLE_TOO_LONG')).toBe('title');
    expect(reviewErrorField('REVIEW_BODY_TOO_SHORT')).toBe('body');
    expect(reviewErrorField('REVIEW_BODY_TOO_LONG')).toBe('body');
    expect(reviewErrorField('REVIEW_TEXT_INVALID')).toBe('body');
    expect(reviewErrorField('REVIEW_DISPLAY_NAME_INVALID')).toBe('display_name');
    expect(reviewErrorField('REVIEW_LOCALE_INVALID')).toBeNull();
    expect(reviewErrorField(undefined)).toBeNull();
  });

  it('fatal codes end on a full-page state', () => {
    expect(reviewFatalState('REVIEW_LINK_INVALID')).toBe('link_invalid');
    expect(reviewFatalState('REVIEW_ORDER_NOT_ELIGIBLE')).toBe('not_eligible');
    expect(reviewFatalState('STORE_APP_NOT_ENABLED')).toBe('unavailable');
    expect(reviewFatalState('REVIEW_PRODUCT_NOT_FOUND')).toBe('unavailable');
    expect(reviewFatalState('REVIEW_BODY_TOO_SHORT')).toBeNull();
    expect(reviewFatalState(null)).toBeNull();
  });

  it('reviewLocale: the API form of the page locale', () => {
    expect(reviewLocale('sv')).toBe('sv');
    expect(reviewLocale('de-at')).toBe('de-AT');
    expect(reviewLocale('DE_AT')).toBe('de-AT');
    expect(reviewLocale('')).toBe('en');
    expect(reviewLocale('swedish')).toBe('en');
    for (const l of ['sv', 'de-AT', 'en']) expect(reviewLocale(l)).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
  });
});
