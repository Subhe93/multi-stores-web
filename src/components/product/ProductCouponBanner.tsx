'use client';

// Product-page coupon banner: shown directly under the price when a
// campaign-link code is pending or a coupon is applied. One component for
// the monolith (ProductDetailClient) and the product-price block; every
// figure comes from the shared ProductPageState and the cart.
//
// The pending link code is previewed first; the applied coupon is the
// fallback only when the pending code is invalid. Figures go to
// POST /promotions/coupon-preview (debounced, stale requests aborted); a rate
// limit, network or market error shows nothing, so the banner never shows a
// price the order would not charge.

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, X } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { api } from '@/lib/api';
import { availableLines, sumLineTotals } from '@/lib/cartAvailability';
import { formatPrice } from '@/lib/format';
import {
  classifyPreviewError,
  couponBannerView,
  couponPreviewBody,
  couponPreviewKey,
  couponPreviewSig,
  parsePreviewStatic,
  readPreviewCache,
  writePreviewCache,
  type CouponPreview,
  type CouponPreviewAnswer,
  type CouponPreviewInput,
  type CouponPreviewStatic,
} from '@/lib/couponPreview';

/** Quiet period after a variant / quantity / cart change before re-querying. */
export const COUPON_PREVIEW_DEBOUNCE_MS = 350;

interface Entry {
  static?: CouponPreviewStatic;
  answer?: CouponPreviewAnswer;
  /** The last request failed (rate limit, network...): show nothing. */
  error?: boolean;
  /** The code cannot be used (PROMOTION_COUPON_INVALID). */
  invalid?: boolean;
}

export function ProductCouponBanner({ className }: { className?: string }) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const cart = useCart();

  const pendingCode = cart.pendingCouponCode || null;
  const appliedCode = cart.coupon?.code || null;
  const storeId = cart.storeId;
  const marketKey = cart.marketKey;
  const marketPreview = cart.marketPreview === true;
  // Test doubles and early renders may not carry the lines yet.
  const cartItems = useMemo(() => cart.items ?? [], [cart.items]);

  // The id the cart line will carry (custom product first, like the line source).
  const productId = state ? state.lineSource.customProductId || state.product.id : '';
  const lineAmount = state ? state.displayPrice : 0;
  const quantity = state ? state.quantity : 0;
  const cartSubtotal = sumLineTotals(cartItems) + lineAmount;
  const itemCount = availableLines(cartItems).reduce((sum, i) => sum + i.quantity, 0) + quantity;

  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const candidates = useMemo(
    () => Array.from(new Set([pendingCode, appliedCode].filter((c): c is string => Boolean(c)))),
    [pendingCode, appliedCode],
  );
  const keyFor = (code: string) => couponPreviewKey(storeId || '', marketKey, code, productId);
  // First candidate not known to be invalid: the pending code, else the applied one.
  const activeCode = storeId && productId ? candidates.find((c) => !entries[keyFor(c)]?.invalid) ?? null : null;
  const activeKey = activeCode ? keyFor(activeCode) : null;

  const input: CouponPreviewInput | null =
    activeCode && storeId
      ? {
          storeId, marketKey, marketPreview, code: activeCode, productId, lineAmount, cartSubtotal, itemCount,
          quantity, variantId: state?.selectedVariantId ?? null,
        }
      : null;
  const sig = input ? couponPreviewSig(input) : null;

  // Static fields from the session cache, so a repeat view renders at once.
  useEffect(() => {
    if (!activeKey) return;
    const cached = readPreviewCache(activeKey);
    if (!cached) return;
    setEntries((prev) => (prev[activeKey]?.static ? prev : { ...prev, [activeKey]: { ...prev[activeKey], static: cached } }));
  }, [activeKey]);

  // Debounced preview for the current figures; a newer change aborts it.
  useEffect(() => {
    if (!input || !sig || !activeKey) return;
    const key = activeKey;
    const body = couponPreviewBody(input);
    const requestLine = input.lineAmount;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<CouponPreview>('/promotions/coupon-preview', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then((res) => {
          if (controller.signal.aborted) return;
          const s = parsePreviewStatic(res);
          if (!s) {
            setEntries((prev) => ({ ...prev, [key]: { ...prev[key], error: true } }));
            return;
          }
          writePreviewCache(key, s);
          setEntries((prev) => ({
            ...prev,
            [key]: {
              static: s,
              answer: {
                sig,
                lineAmount: requestLine,
                minMet: typeof res.min_met === 'boolean' ? res.min_met : null,
                discountAmount: typeof res.discount_amount === 'number' && Number.isFinite(res.discount_amount) ? res.discount_amount : null,
              },
            },
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (classifyPreviewError(err) === 'invalid') {
            writePreviewCache(key, null);
            setEntries((prev) => ({ ...prev, [key]: { invalid: true } }));
          } else {
            setEntries((prev) => ({ ...prev, [key]: { ...prev[key], error: true } }));
          }
        });
    }, COUPON_PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `sig` captures every figure of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, activeKey]);

  if (!state || !activeCode || !activeKey || !sig) return null;
  const entry = entries[activeKey];
  if (!entry || entry.error || entry.invalid) return null;

  const view = couponBannerView(entry.static ?? null, entry.answer ?? null, { sig, lineAmount, cartSubtotal, itemCount });
  if (view.kind === 'none') return null;

  const { currency, taxRateBp, display } = state;
  const locale = state.locale;
  // Per-item prices follow the price display (b2b company view = net).
  const fmtLine = (amount: number) => formatPrice(display(amount, taxRateBp, currency).amount, currency, locale);
  // Order-level amounts are shown like the cart shows its discount.
  const fmtOrder = (amount: number) => formatPrice(amount, currency, locale);

  if (view.kind === 'not_applicable') {
    return (
      <p role="status" className={`text-xs text-gray-500 ${className ?? ''}`.trim()} data-testid="coupon-banner-na">
        {t('product.couponNotApplicable', { code: view.code })}
      </p>
    );
  }
  if (view.kind === 'below_cost') {
    // Marketplace provider-cost floor: the order would refuse the code, so
    // no discounted price is shown, only a muted note.
    return (
      <p role="status" className={`text-xs text-gray-500 ${className ?? ''}`.trim()} data-testid="coupon-banner-below-cost">
        {t('product.couponBelowCost', { code: view.code })}
      </p>
    );
  }

  const isApplied = activeCode === appliedCode;
  const isPending = activeCode === pendingCode;
  // A link code that is not applied to the cart yet is not promised as
  // "active": neutral wording, and a discounted price only from a server
  // answer of this page view (never from the cached static fields alone).
  const pendingOnly = isPending && !isApplied;
  const showPrice = isApplied || Boolean(entry.answer);
  const onClose = () => {
    if (isPending) cart.discardPendingCoupon();
    if (isApplied) void cart.removeCoupon();
  };

  const freeShipping = view.kind === 'free_shipping' || view.freeShipping;

  return (
    <div
      role="status"
      data-testid="coupon-banner"
      className={`flex items-start justify-between gap-2 bg-green-50 border border-green-200 rounded-md ps-3 pe-0 py-2 ${className ?? ''}`.trim()}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Tag className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-0.5 text-sm text-green-700 min-w-0">
          <span>
            {t.rich(pendingOnly ? 'product.couponPendingCheckout' : 'product.couponActive', {
              code: view.code,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </span>
          {view.kind === 'percentage' && view.discounted !== null && showPrice && (
            <span data-testid="coupon-banner-price">
              {t('product.couponYourPrice', { price: fmtLine(view.discounted) })}{' '}
              <span className="text-gray-400 line-through">{fmtLine(view.regular)}</span>
            </span>
          )}
          {view.kind === 'fixed' && <span>{t('product.couponFixedOff', { amount: fmtOrder(view.amount) })}</span>}
          {view.kind === 'min_not_met' && view.minAmount !== null && (
            <span>{t('product.couponMinAmount', { amount: fmtOrder(view.minAmount) })}</span>
          )}
          {view.kind === 'min_not_met' && view.minQuantity !== null && (
            <span>{t('product.couponMinQuantity', { count: view.minQuantity })}</span>
          )}
          {freeShipping && <span>{t('product.couponFreeShipping')}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="size-11 -my-2 shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
        aria-label={t('cart.removeCoupon')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
