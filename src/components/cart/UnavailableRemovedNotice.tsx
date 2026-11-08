'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

// Deleted / unpublished products (fix batch 1, item 5): "An item that is no
// longer available was removed from your cart". Shown on the cart and
// checkout pages after the cart dropped such lines; nothing otherwise.
export function UnavailableRemovedNotice({ className = '' }: { className?: string }) {
  const t = useTranslations();
  const { unavailableRemoved, dismissUnavailableRemoved } = useCart();
  if (unavailableRemoved <= 0) return null;
  return (
    <div role="status" className={`flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 ${className}`}>
      <span className="flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>{t('cart.unavailableRemoved', { count: unavailableRemoved })}</span>
      </span>
      <button
        type="button"
        onClick={dismissUnavailableRemoved}
        className="size-8 -me-2 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
        aria-label={t('cart.couponNoticeDismiss')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Runs the cart's availability probe once, when the cart has loaded (cart /
 * checkout page load), so lines of deleted products are dropped up front.
 */
export function useCartAvailabilityCheck(enabled = true): void {
  const { loading, items, checkCartAvailability } = useCart();
  const doneRef = useRef(false);
  const checkRef = useRef(checkCartAvailability);
  useEffect(() => { checkRef.current = checkCartAvailability; });
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!enabled || loading || !hasItems || doneRef.current) return;
    doneRef.current = true;
    void checkRef.current();
  }, [enabled, loading, hasItems]);
}
