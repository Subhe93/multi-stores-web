'use client';

// Status line and "load more" button under a server-paginated product grid
// (product-listing section and the built-in listing routes). The status line
// is always rendered, so the server HTML already says how many products are
// shown out of how many.
//
// M166 A: with `nextHref` the control is a real link to the next page
// (`?page=N+1`), so it works without JS and crawlers follow it; a plain
// primary click is intercepted and loads the page in place as before.

import { useEffect, useRef, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { hover, type MotionProp } from '@/themes/creative/recipes';

export function ListingLoadMore({
  shown,
  total,
  hasMore,
  loading,
  error,
  onLoadMore,
  gridRef,
  motion,
  nextHref,
  offset = 0,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
  /** The grid whose children are the cards (focus moves to the first new one). */
  gridRef: RefObject<HTMLElement | null>;
  /** Store motion style: the button sinks a little while pressed. Unset = today's markup. */
  motion?: MotionProp;
  /** Href of the next listing page; renders the control as `<a href>`. */
  nextHref?: string;
  /**
   * Products before the first shown card (`?page=N`: (N - 1) x page size).
   * Display only: the status line counts them as seen.
   */
  offset?: number;
}) {
  const t = useTranslations('product');
  // Card count when the button was pressed; once more cards arrive, keyboard
  // focus moves to the first new card instead of staying on a button that
  // may disappear on the last page.
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const from = pendingFocus.current;
    if (from === null || loading) return;
    if (shown > from) {
      const card = gridRef.current?.children[from];
      const link = card instanceof HTMLAnchorElement ? card : card?.querySelector('a');
      link?.focus({ preventScroll: true });
    }
    pendingFocus.current = null;
  }, [shown, loading, gridRef]);

  const onClick = () => {
    if (loading) return;
    pendingFocus.current = shown;
    onLoadMore();
  };

  // The link keeps its native behaviour for new-tab / modified clicks.
  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onClick();
  };

  const className =
    'min-h-11 min-w-44 px-6 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow focus:outline-none focus-visible:ring-2 aria-disabled:cursor-progress aria-disabled:opacity-70';
  const ringStyle = { '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties;
  const motionProps = motion ? { ...hover(motion, 'press'), 'data-cx-more-btn': '' } : null;

  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <p role="status" aria-live="polite" className="text-sm text-gray-500">
        {t('shownOfTotal', { shown: Math.min(total, offset + shown), total })}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('loadMoreError')}
        </p>
      )}
      {hasMore && nextHref && (
        <a
          href={nextHref}
          rel="next"
          onClick={onLinkClick}
          aria-disabled={loading || undefined}
          aria-busy={loading || undefined}
          className={`inline-flex items-center justify-center ${className}`}
          style={ringStyle}
          {...motionProps}
        >
          {loading ? t('loadingMore') : t('loadMore')}
        </a>
      )}
      {hasMore && !nextHref && (
        <button
          type="button"
          onClick={onClick}
          aria-disabled={loading || undefined}
          aria-busy={loading || undefined}
          className={className}
          style={ringStyle}
          {...motionProps}
        >
          {loading ? t('loadingMore') : t('loadMore')}
        </button>
      )}
    </div>
  );
}
