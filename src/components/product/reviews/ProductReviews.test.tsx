import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProductReviewsData, PublicReview } from '@/lib/reviews';

// Reviews block (M171): summary, distribution, list with the verified badge
// and the owner reply, each review in its own language, empty state, real
// pagination links, and review text rendered as text only.

vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { has: () => true },
  );
  return { useLocale: () => 'en', useTranslations: () => t };
});

import { ProductReviews } from './ProductReviews';
import { ProductRatingLine, hasRatingLine } from './ProductRatingLine';
import { StarRating } from './StarRating';

const review = (over: Partial<PublicReview> = {}): PublicReview => ({
  id: 'r1',
  rating: 5,
  title: 'Perfect gift',
  body: 'Fast delivery.\nLooks great.',
  display_name: 'Anna S.',
  locale: 'sv',
  verified: true,
  published_at: '2026-11-20T10:12:00.000Z',
  reply: null,
  ...over,
});

const data = (over: Partial<ProductReviewsData> = {}): ProductReviewsData => ({
  summary: { average: 4.6, count: 12, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 8 } },
  items: [review()],
  page: 1,
  total_pages: 1,
  slot: 'inline',
  base_path: '/products/mug',
  base_query: '',
  write_href: '/reviews/write?product=p1',
  store_name: 'Namez',
  ...over,
});

const EMPTY = data({
  summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  items: [],
  total_pages: 0,
});

describe('ProductReviews', () => {
  it('is a labelled section with the #reviews anchor', () => {
    const { container } = render(<ProductReviews reviews={data()} locale="en" />);
    const section = container.querySelector('section#reviews')!;
    expect(section).not.toBeNull();
    const heading = screen.getByRole('heading', { level: 2, name: 'heading' });
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('summary: average with one decimal, stars and the count', () => {
    const { container } = render(<ProductReviews reviews={data({ summary: { ...data().summary, average: 4 } })} locale="en" />);
    const summary = container.querySelector('[data-reviews-summary]') as HTMLElement;
    expect(within(summary).getByText('4.0')).toBeTruthy();
    expect(within(summary).getByRole('img', { name: 'averageLabel:{"value":"4.0"}' })).toBeTruthy();
    expect(within(summary).getByText('count:{"count":12}')).toBeTruthy();
  });

  it('distribution: five rows from 5 to 1 with their counts and bar widths', () => {
    const { container } = render(<ProductReviews reviews={data()} locale="en" />);
    const rows = [...container.querySelectorAll('[data-reviews-distribution] li')];
    expect(rows.map((li) => li.getAttribute('aria-label'))).toEqual([
      'distributionRow:{"stars":5,"count":8}',
      'distributionRow:{"stars":4,"count":3}',
      'distributionRow:{"stars":3,"count":1}',
      'distributionRow:{"stars":2,"count":0}',
      'distributionRow:{"stars":1,"count":0}',
    ]);
    const widths = rows.map((li) => (li.querySelector('span > span') as HTMLElement).style.width);
    expect(widths).toEqual(['67%', '25%', '8%', '0%', '0%']);
  });

  it('a review: stars, title, text, name, verified badge and date', () => {
    const { container } = render(<ProductReviews reviews={data()} locale="en" />);
    const item = container.querySelector('[data-review]') as HTMLElement;
    expect(within(item).getByRole('img', { name: 'starsLabel:{"rating":5}' })).toBeTruthy();
    expect(within(item).getByRole('heading', { level: 3, name: 'Perfect gift' })).toBeTruthy();
    expect(within(item).getByText('Anna S.')).toBeTruthy();
    expect(item.querySelector('[data-review-verified]')!.textContent).toContain('verified');
    const time = item.querySelector('time')!;
    expect(time.getAttribute('datetime')).toBe('2026-11-20');
    expect(time.textContent).toBe('November 20, 2026');
  });

  it('the text keeps its language and line breaks', () => {
    const { container } = render(<ProductReviews reviews={data()} locale="en" />);
    const body = container.querySelector('[data-review-body]') as HTMLElement;
    expect(body.getAttribute('lang')).toBe('sv');
    expect(body.getAttribute('dir')).toBe('auto');
    expect(body.textContent).toBe('Fast delivery.\nLooks great.');
    expect(body.className).toContain('whitespace-pre-line');
    expect(container.querySelector('h3')!.getAttribute('lang')).toBe('sv');
  });

  it('dates follow the page locale, not the review language', () => {
    const { container } = render(<ProductReviews reviews={data()} locale="sv" />);
    expect(container.querySelector('[data-review] time')!.textContent).toBe('20 november 2026');
  });

  it('no badge for an unverified review, no heading without a title', () => {
    const { container } = render(
      <ProductReviews reviews={data({ items: [review({ verified: false, title: null })] })} locale="en" />,
    );
    expect(container.querySelector('[data-review-verified]')).toBeNull();
    expect(container.querySelector('h3')).toBeNull();
  });

  it('owner reply with the store name and its date', () => {
    const items = [review({ reply: { body: 'Thank you!', replied_at: '2026-11-21T08:00:00.000Z' } })];
    const { container } = render(<ProductReviews reviews={data({ items })} locale="en" />);
    const reply = container.querySelector('[data-review-reply]') as HTMLElement;
    expect(reply.textContent).toContain('replyFrom:{"store":"Namez"}');
    expect(reply.textContent).toContain('Thank you!');
    expect(reply.querySelector('time')!.getAttribute('datetime')).toBe('2026-11-21');
  });

  it('reply without a known store name uses the neutral label', () => {
    const items = [review({ reply: { body: 'Thanks', replied_at: null } })];
    const { container } = render(<ProductReviews reviews={data({ items, store_name: undefined })} locale="en" />);
    const reply = container.querySelector('[data-review-reply]') as HTMLElement;
    expect(reply.textContent).toContain('reply');
    expect(reply.textContent).not.toContain('replyFrom');
    expect(reply.querySelector('time')).toBeNull();
  });

  it('empty state: heading, text and the write link; no stars, list or pagination', () => {
    const { container } = render(<ProductReviews reviews={EMPTY} locale="en" />);
    expect(container.querySelector('section#reviews')).not.toBeNull();
    expect(container.querySelector('[data-reviews-empty]')!.textContent).toBe('empty');
    expect(screen.getByRole('link', { name: 'write' }).getAttribute('href')).toBe('/reviews/write?product=p1');
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelector('[data-reviews-summary]')).toBeNull();
    expect(container.querySelector('[data-reviews-list]')).toBeNull();
    expect(container.querySelector('[data-reviews-pagination]')).toBeNull();
  });

  it('no write link on a store without customer accounts', () => {
    const { container } = render(<ProductReviews reviews={data({ write_href: undefined })} locale="en" />);
    expect(container.querySelector('[data-reviews-write]')).toBeNull();
  });

  it('pagination: real links, page 1 without the parameter, other parameters kept', () => {
    const { container } = render(
      <ProductReviews reviews={data({ page: 2, total_pages: 3, base_path: '/de-de/products/kette', base_query: 'variant=v1' })} locale="en" />,
    );
    const nav = container.querySelector('nav[data-reviews-pagination]') as HTMLElement;
    const hrefs = Object.fromEntries(
      [...nav.querySelectorAll('a')].map((a) => [a.getAttribute('aria-label') ?? a.textContent, a.getAttribute('href')]),
    );
    expect(hrefs).toEqual({
      previous: '/de-de/products/kette?variant=v1#reviews',
      'pageLabel:{"page":1}': '/de-de/products/kette?variant=v1#reviews',
      'pageLabel:{"page":3}': '/de-de/products/kette?variant=v1&reviews_page=3#reviews',
      next: '/de-de/products/kette?variant=v1&reviews_page=3#reviews',
    });
    expect(nav.querySelector('[aria-current="page"]')!.textContent).toBe('2');
    expect(nav.querySelector('a[rel="prev"]')).not.toBeNull();
    expect(nav.querySelector('a[rel="next"]')).not.toBeNull();
  });

  it('first page has no previous link, last page no next link, one page no pagination', () => {
    const first = render(<ProductReviews reviews={data({ page: 1, total_pages: 2 })} locale="en" />);
    expect(first.container.querySelector('a[rel="prev"]')).toBeNull();
    expect(first.container.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/products/mug?reviews_page=2#reviews');
    first.unmount();
    const last = render(<ProductReviews reviews={data({ page: 2, total_pages: 2 })} locale="en" />);
    expect(last.container.querySelector('a[rel="next"]')).toBeNull();
    expect(last.container.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/products/mug#reviews');
    last.unmount();
    const one = render(<ProductReviews reviews={data()} locale="en" />);
    expect(one.container.querySelector('[data-reviews-pagination]')).toBeNull();
  });

  it('review text, title, name and reply are never HTML', () => {
    const hostile = '<img src=x onerror=alert(1)><script>alert(2)</script><a href="https://evil.example">x</a>';
    const items = [
      review({ title: hostile, body: `${hostile} https://evil.example`, display_name: '<b>Bob</b>', reply: { body: hostile, replied_at: null } }),
    ];
    const { container } = render(<ProductReviews reviews={data({ items })} locale="en" />);
    const item = container.querySelector('[data-review]') as HTMLElement;
    expect(item.querySelector('img, script, b')).toBeNull();
    // Nothing is linkified either.
    expect(item.querySelector('a')).toBeNull();
    expect(item.querySelector('[data-review-body]')!.textContent).toBe(`${hostile} https://evil.example`);
    const html = renderToStaticMarkup(<ProductReviews reviews={data({ items })} locale="en" />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
  });

  it('is complete in the server HTML', () => {
    const html = renderToStaticMarkup(<ProductReviews reviews={data({ page: 1, total_pages: 2 })} locale="en" />);
    expect(html).toContain('id="reviews"');
    expect(html).toContain('Fast delivery.');
    expect(html).toContain('href="/products/mug?reviews_page=2#reviews"');
  });
});

describe('ProductRatingLine', () => {
  it('stars and "4.6 (12)" linking to the block', () => {
    render(<ProductRatingLine reviews={data()} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('#reviews');
    expect(link.textContent).toContain('ratingLine:{"value":"4.6","count":12}');
    expect(within(link).getByRole('img', { name: 'averageLabel:{"value":"4.6"}' })).toBeTruthy();
  });

  it('nothing without approved reviews', () => {
    expect(hasRatingLine(undefined)).toBe(false);
    expect(hasRatingLine(null)).toBe(false);
    expect(hasRatingLine(EMPTY)).toBe(false);
    expect(hasRatingLine(data())).toBe(true);
    const { container } = render(<ProductRatingLine reviews={EMPTY} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('StarRating', () => {
  it('one labelled image, left-to-right, filled in proportion', () => {
    const { container } = render(
      <div dir="rtl">
        <StarRating value={4.6} label="4.6 out of 5" />
      </div>,
    );
    const img = screen.getByRole('img', { name: '4.6 out of 5' });
    expect(img.getAttribute('dir')).toBe('ltr');
    expect(container.querySelectorAll('svg')).toHaveLength(10);
    for (const svg of container.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true');
    const overlay = img.children[1] as HTMLElement;
    expect(overlay.style.width).toBe('92%');
    expect(overlay.style.left).toBe('0px');
  });

  it('clamps out-of-range values', () => {
    const { container, rerender } = render(<StarRating value={9} label="x" />);
    expect((container.querySelector('[role="img"]')!.children[1] as HTMLElement).style.width).toBe('100%');
    rerender(<StarRating value={Number.NaN} label="x" />);
    expect((container.querySelector('[role="img"]')!.children[1] as HTMLElement).style.width).toBe('0%');
  });
});
