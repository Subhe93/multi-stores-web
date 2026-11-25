'use client';

// Pagination of the reviews block (M171): real links
// (`<path>?reviews_page=N#reviews`) so every page is reachable without
// JavaScript and by crawlers. Page 1 links to the path without the
// parameter; other query parameters of the request (`variant`) are kept.
// The product canonical never carries a query, so these URLs are not
// separate indexable pages.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { reviewsPageHref, reviewsPageWindow } from '@/lib/reviews';

const LINK =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors hover:opacity-80';
const BORDER = 'var(--theme-colors-border, #e5e7eb)';

export function ReviewsPagination({
  page,
  totalPages,
  basePath,
  baseQuery,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  baseQuery: string;
}) {
  const t = useTranslations('reviews');
  if (!(totalPages > 1)) return null;
  const href = (p: number) => reviewsPageHref(basePath, baseQuery, p);
  return (
    <nav aria-label={t('pagination')} className="mt-8 flex flex-wrap items-center gap-2" data-reviews-pagination="">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" prefetch={false} className={LINK} style={{ borderColor: BORDER }}>
          {t('previous')}
        </Link>
      )}
      {reviewsPageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            aria-label={t('pageLabel', { page: p })}
            className={`${LINK} font-semibold`}
            style={{ borderColor: 'var(--theme-colors-text, #111827)' }}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            prefetch={false}
            aria-label={t('pageLabel', { page: p })}
            className={LINK}
            style={{ borderColor: BORDER }}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} rel="next" prefetch={false} className={LINK} style={{ borderColor: BORDER }}>
          {t('next')}
        </Link>
      )}
    </nav>
  );
}
