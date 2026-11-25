'use client';

// Stars + "4.6 (12)" under the product title (M171), linking to the reviews
// block. Rendered by the four title components only when the product has at
// least one approved review; without `product.reviews` they render exactly
// their previous markup (the callers do not mount this component at all).

import { useTranslations } from 'next-intl';
import { REVIEWS_ANCHOR, formatAverage, type ProductReviewsData } from '@/lib/reviews';
import { StarRating } from './StarRating';

type WithSummary = Pick<ProductReviewsData, 'summary'>;

/** True when the title components show the line. */
export function hasRatingLine<T extends WithSummary>(reviews: T | null | undefined): reviews is T {
  return Boolean(reviews && reviews.summary && reviews.summary.count > 0);
}

export function ProductRatingLine({ reviews, className }: { reviews: WithSummary; className?: string }) {
  const t = useTranslations('reviews');
  const { average, count } = reviews.summary;
  if (!(count > 0)) return null;
  const value = formatAverage(average);
  return (
    <a
      href={`#${REVIEWS_ANCHOR}`}
      data-product-rating-line=""
      className={`inline-flex w-fit items-center gap-2 text-sm hover:underline ${className ?? ''}`.trim()}
      style={{ color: 'var(--theme-colors-muted, #6b7280)' }}
    >
      <StarRating value={average} label={t('averageLabel', { value })} />
      <span>{t('ratingLine', { value, count })}</span>
    </a>
  );
}
