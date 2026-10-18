'use client';

import { useTranslations } from 'next-intl';
import { Tag, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

// Coupon auto-apply (M5 W2-A): "Discount code X added" / "… is not valid" /
// "… will be applied" banner shown on the cart and checkout pages. Renders
// nothing for stores without the feature (no notice is ever set) and once
// the shopper dismissed it.
export function CouponAutoApplyNotice({ className = '' }: { className?: string }) {
  const t = useTranslations();
  const { couponNotice, dismissCouponNotice } = useCart();
  if (!couponNotice) return null;
  const invalid = couponNotice.status === 'invalid';
  const tone = invalid
    ? 'bg-red-50 border-red-200 text-red-700'
    : couponNotice.status === 'applied'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-blue-50 border-blue-200 text-blue-700';
  const message =
    couponNotice.status === 'applied'
      ? t('cart.couponAutoApplied', { code: couponNotice.code })
      : invalid
        ? t('cart.couponAutoInvalid', { code: couponNotice.code })
        : t('cart.couponAutoPending', { code: couponNotice.code });
  return (
    <div role="status" className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${tone} ${className}`}>
      <span className="flex items-center gap-2">
        <Tag className="w-3.5 h-3.5 shrink-0" />
        <span>{message}</span>
      </span>
      <button
        type="button"
        onClick={dismissCouponNotice}
        className="size-8 -me-2 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
        aria-label={t('cart.couponNoticeDismiss')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
