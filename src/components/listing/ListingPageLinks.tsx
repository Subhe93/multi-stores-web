// Crawlable pager of a product listing (M166 A): plain `<a href>` links to
// `?page=N`, rendered on the server, so crawlers and visitors without JS
// reach every page. No client state of its own: the listing hands it a
// model built by `buildListingPager` (lib/listingPageParam.ts).
//
// `position="top"` renders only the "previous page" link (shown above the
// grid on page N > 1).

import { useTranslations } from 'next-intl';
import type { ListingPagerModel } from '@/lib/listingPageParam';

const LINK =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2';
const RING = { '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties;

export function ListingPageLinks({
  pager,
  position = 'bottom',
}: {
  pager: ListingPagerModel | null | undefined;
  position?: 'top' | 'bottom';
}) {
  const t = useTranslations('product');
  if (!pager || pager.totalPages <= 1) return null;

  if (position === 'top') {
    if (!pager.prevHref) return null;
    return (
      <nav aria-label={t('pagination')} className="mb-6 flex justify-start" data-listing-pager="top">
        <a rel="prev" href={pager.prevHref} className={LINK} style={RING}>
          <span aria-hidden="true" className="me-1 rtl:rotate-180 inline-block">
            ‹
          </span>
          {t('prevPage')}
        </a>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t('pagination')}
      className="mt-6 flex flex-wrap items-center justify-center gap-1"
      data-listing-pager="bottom"
    >
      {pager.prevHref && (
        <a rel="prev" href={pager.prevHref} className={LINK} style={RING}>
          <span aria-hidden="true" className="me-1 rtl:rotate-180 inline-block">
            ‹
          </span>
          {t('prevPage')}
        </a>
      )}
      {pager.items.map((item, i) =>
        item === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-gray-400">
            …
          </span>
        ) : item.current ? (
          <span
            key={item.page}
            aria-current={item.page === pager.page ? 'page' : undefined}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
          >
            <span className="sr-only">{t('pageN', { n: item.page })}</span>
            <span aria-hidden="true">{item.page}</span>
          </span>
        ) : (
          <a key={item.page} href={item.href} className={LINK} style={RING} aria-label={t('pageN', { n: item.page })}>
            {item.page}
          </a>
        ),
      )}
      {pager.nextHref && (
        <a rel="next" href={pager.nextHref} className={LINK} style={RING}>
          {t('nextPage')}
          <span aria-hidden="true" className="ms-1 rtl:rotate-180 inline-block">
            ›
          </span>
        </a>
      )}
      <p className="sr-only">{t('pageOfTotal', { n: pager.page, total: pager.totalPages })}</p>
    </nav>
  );
}
