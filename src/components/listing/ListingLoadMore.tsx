'use client';

// Status line and "load more" button under a server-paginated product grid
// (product-listing section and the built-in listing routes). The status line
// is always rendered, so the server HTML already says how many products are
// shown out of how many.

import { useEffect, useRef, type RefObject } from 'react';
import { useTranslations } from 'next-intl';

export function ListingLoadMore({
  shown,
  total,
  hasMore,
  loading,
  error,
  onLoadMore,
  gridRef,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
  /** The grid whose children are the cards (focus moves to the first new one). */
  gridRef: RefObject<HTMLElement | null>;
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

  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <p role="status" aria-live="polite" className="text-sm text-gray-500">
        {t('shownOfTotal', { shown, total })}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t('loadMoreError')}
        </p>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={onClick}
          aria-disabled={loading || undefined}
          aria-busy={loading || undefined}
          className="min-h-11 min-w-44 px-6 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow focus:outline-none focus-visible:ring-2 aria-disabled:cursor-progress aria-disabled:opacity-70"
          style={{ '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties}
        >
          {loading ? t('loadingMore') : t('loadMore')}
        </button>
      )}
    </div>
  );
}
