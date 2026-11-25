'use client';

// Reviews block of the product page (M171, store app `reviews`): average,
// count, rating distribution, the approved reviews of the current page (with
// the verified badge, the date and the owner reply), pagination and the
// "Write a review" link.
//
// Only `useTranslations`: no state, no effect, no fetch, so the whole block
// is in the server HTML and matches the JSON-LD of the same page (both hang
// on one value of the product route). Review text is always rendered as
// text: never as HTML, never linkified.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BadgeCheck } from 'lucide-react';
import {
  REVIEWS_ANCHOR,
  formatAverage,
  formatReviewDate,
  ratingShare,
  type ProductReviewsData,
  type RatingKey,
} from '@/lib/reviews';
import { StarRating } from './StarRating';
import { ReviewsPagination } from './ReviewsPagination';

const TEXT = 'var(--theme-colors-text, #111827)';
const MUTED = 'var(--theme-colors-muted, #6b7280)';
const BORDER = 'var(--theme-colors-border, #e5e7eb)';
const LINK_COLOR = 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))';
const ROWS: RatingKey[] = ['5', '4', '3', '2', '1'];
const HEADING_ID = 'product-reviews-heading';

export function ProductReviews({
  reviews,
  locale,
  className,
}: {
  reviews: ProductReviewsData;
  /** Page locale: dates and UI strings. Each review keeps its own language. */
  locale: string;
  className?: string;
}) {
  const t = useTranslations('reviews');
  const { summary, items } = reviews;
  const hasReviews = summary.count > 0 && items.length > 0;
  const average = formatAverage(summary.average);

  return (
    <section
      id={REVIEWS_ANCHOR}
      aria-labelledby={HEADING_ID}
      data-product-reviews=""
      className={`mt-12 border-t pt-10 ${className ?? ''}`.trim()}
      style={{ borderColor: BORDER, color: TEXT, scrollMarginTop: '6rem' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={HEADING_ID} className="text-xl font-semibold lg:text-2xl">
          {t('heading')}
        </h2>
        {reviews.write_href && (
          <Link
            href={reviews.write_href}
            prefetch={false}
            rel="nofollow"
            data-reviews-write=""
            className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors hover:opacity-80"
            style={{ borderColor: BORDER, color: LINK_COLOR }}
          >
            {t('write')}
          </Link>
        )}
      </div>

      {!hasReviews && (
        <p className="mt-4 text-sm" style={{ color: MUTED }} data-reviews-empty="">
          {t('empty')}
        </p>
      )}

      {hasReviews && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10" data-reviews-summary="">
            <div className="flex flex-col gap-1">
              <span className="text-4xl font-bold leading-none tabular-nums">{average}</span>
              <StarRating value={summary.average} label={t('averageLabel', { value: average })} size={20} />
              <span className="text-sm" style={{ color: MUTED }}>
                {t('count', { count: summary.count })}
              </span>
            </div>
            <ul className="flex max-w-md flex-col gap-1.5" data-reviews-distribution="">
              {ROWS.map((stars) => {
                const share = ratingShare(summary, stars);
                return (
                  <li
                    key={stars}
                    className="flex items-center gap-3 text-sm"
                    aria-label={t('distributionRow', { stars: Number(stars), count: summary.distribution[stars] })}
                  >
                    <span aria-hidden="true" className="w-3 shrink-0 tabular-nums">
                      {stars}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-2 flex-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: BORDER }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${share}%`, backgroundColor: 'var(--theme-colors-rating, #f59e0b)' }}
                      />
                    </span>
                    <span aria-hidden="true" className="w-8 shrink-0 text-end tabular-nums" style={{ color: MUTED }}>
                      {summary.distribution[stars]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="mt-8 flex flex-col" data-reviews-list="">
            {items.map((review) => {
              const date = formatReviewDate(review.published_at, locale);
              const replyDate = review.reply ? formatReviewDate(review.reply.replied_at, locale) : '';
              return (
                <li
                  key={review.id}
                  className="border-t py-6 first:border-t-0 first:pt-0"
                  style={{ borderColor: BORDER }}
                  data-review=""
                >
                  <article>
                    <StarRating value={review.rating} label={t('starsLabel', { rating: review.rating })} />
                    {review.title && (
                      <h3
                        className="mt-2 text-base font-semibold wrap-break-word"
                        lang={review.locale || undefined}
                        dir="auto"
                      >
                        {review.title}
                      </h3>
                    )}
                    <p
                      className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-break-word"
                      lang={review.locale || undefined}
                      dir="auto"
                      data-review-body=""
                    >
                      {review.body}
                    </p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: MUTED }}>
                      <span className="font-medium" style={{ color: TEXT }} dir="auto">
                        {review.display_name}
                      </span>
                      {review.verified && (
                        <span className="inline-flex items-center gap-1" data-review-verified="">
                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                          {t('verified')}
                        </span>
                      )}
                      {date && review.published_at && <time dateTime={review.published_at.slice(0, 10)}>{date}</time>}
                    </p>
                    {review.reply && (
                      <div className="mt-4 rounded-xl border p-4 sm:ms-6" style={{ borderColor: BORDER }} data-review-reply="">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                          <span>{reviews.store_name ? t('replyFrom', { store: reviews.store_name }) : t('reply')}</span>
                          {replyDate && review.reply.replied_at && (
                            <time
                              className="font-normal"
                              style={{ color: MUTED }}
                              dateTime={review.reply.replied_at.slice(0, 10)}
                            >
                              {replyDate}
                            </time>
                          )}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-break-word" dir="auto">
                          {review.reply.body}
                        </p>
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>

          <ReviewsPagination
            page={reviews.page}
            totalPages={reviews.total_pages}
            basePath={reviews.base_path}
            baseQuery={reviews.base_query}
          />
        </>
      )}
    </section>
  );
}
