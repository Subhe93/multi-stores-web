'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronRight, Loader2, Lock, ShoppingBag } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useKustomCheckout } from '@/hooks/useKustomCheckout';
import { KustomSnippet } from '@/components/checkout/KustomSnippet';
import { OrderSummary } from '@/components/checkout/OrderSummary';

// ── Kustom-first checkout ─────────────────────────────────────────────────────
// Address, shipping and payment all happen inside Kustom's iframe; this page
// only shows the editable order summary next to it and keeps the Kustom
// session in sync (see useKustomCheckout). The API creates the order from the
// session when Kustom's validation callback fires.

interface KustomCheckoutProps {
  storeSlug: string;
  /** COD or card is available, so a link to the classic form is offered. */
  classicAvailable: boolean;
}

// `reason` codes the API puts on `?error=kustom_validation` redirects
// (API-CONTRACT-B, "Order creation inside /validation").
const VALIDATION_REASON_KEYS: Record<string, string> = {
  amount_changed: 'checkout.kustomValidationReasons.amountChanged',
  out_of_stock: 'checkout.kustomValidationReasons.outOfStock',
  coupon_invalid: 'checkout.kustomValidationReasons.couponInvalid',
  unavailable: 'checkout.kustomValidationReasons.unavailable',
};

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label}
    </div>
  );
}

export function KustomCheckout({ storeSlug, classicAvailable }: KustomCheckoutProps) {
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();
  const searchParams = useSearchParams();
  const { token, loading: authLoading, refresh: refreshAuth } = useAuth();
  const {
    items, subtotal, total, coupon, currency, loading: cartLoading,
    taxLines: cartTaxLines, taxPricingMode, taxEstimated: cartTaxEstimated,
    updateQuantity, removeItem, applyCoupon, removeCoupon,
  } = useCart();

  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const discount = coupon
    ? coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount
    : 0;

  const { html, loading, updating, failed, syncFailed, totals, retry } = useKustomCheckout({
    storeSlug,
    locale,
    // Wait for auth (so the JWT is attached) and for the cart to be loaded.
    enabled: !authLoading && !cartLoading,
    authToken: token,
    refreshAuth,
    items,
    couponCode: coupon?.code ?? null,
    notes: orderNotes,
  });

  // The session's `totals` are what the iframe charges (shipping once Kustom
  // knows the address, tax for the destination), so the summary prefers them
  // over the client-side cart figures.
  const summarySubtotal = totals ? totals.subtotal : subtotal;
  const summaryDiscount = totals ? totals.discount_amount : discount;
  const summaryShipping = totals && totals.shipping_cost > 0 ? totals.shipping_cost : null;
  const summaryTotal = totals ? totals.total : total;
  const summaryPricingMode = totals ? totals.pricing_mode : taxPricingMode;
  const summaryTaxLines = totals
    ? totals.tax_lines
    : summaryPricingMode === 'INCLUSIVE' ? cartTaxLines : [];
  const summaryTaxEstimated = totals ? false : cartTaxEstimated;
  // The session is priced in the store's charge currency, which is the one to
  // format its figures in; fall back to the cart currency on older API builds.
  const summaryCurrency = totals?.currency || currency;

  // Kustom's callbacks send the customer back here with an error code when
  // shipping is impossible or the order could not be created.
  const errorParam = searchParams.get('error');
  const reasonParam = searchParams.get('reason');
  const callbackMessage = useMemo(() => {
    if (errorParam === 'shipping_unavailable') return t('checkout.shippingUnavailable');
    if (errorParam === 'kustom_validation') {
      const key = reasonParam ? VALIDATION_REASON_KEYS[reasonParam] : undefined;
      return key ? t(key) : t('checkout.kustomValidationFailed');
    }
    return null;
  }, [errorParam, reasonParam, t]);

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      await applyCoupon(code);
      setCouponCode('');
    } catch {
      setCouponError(t('cart.couponInvalid'));
    } finally {
      setCouponLoading(false);
    }
  }

  // ── Empty cart guard ───────────────────────────────────────────────────────
  if (!cartLoading && items.length === 0) {
    return (
      <div className="min-h-screen store-page flex flex-col items-center justify-center px-4 py-20">
        <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
        <p className="text-gray-500 mb-4 text-sm">{t('cart.empty')}</p>
        <Link
          href={lp('/products')}
          className="inline-block rounded-md px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          {t('cart.continueShopping')}
        </Link>
      </div>
    );
  }

  const showSnippetLoading = loading || (!failed && !html);

  return (
    <div className="flex-1 max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center flex-wrap gap-1.5 text-xs text-gray-400 mb-7">
        <Link href={lp('/cart')} className="hover:text-gray-600 transition-colors">
          {t('cart.title')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium text-sm">{t('checkout.title')}</span>
      </nav>

      {callbackMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{callbackMessage}</span>
        </div>
      )}
      {syncFailed && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('checkout.kustomSyncFailed')}</span>
        </div>
      )}

      {/* Two columns from lg up; on smaller screens the summary comes first
          so the customer sees what they are paying for before the iframe. */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

        {/* ── Order summary (editable) ── */}
        <aside className="w-full lg:w-[45%] lg:shrink-0">
          <div className="rounded-lg store-surface border store-bd p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5 uppercase tracking-wide">
              {t('checkout.orderSummary')}
            </h2>
            <OrderSummary
              items={items} subtotal={summarySubtotal} discount={summaryDiscount}
              total={summaryTotal} currency={summaryCurrency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={summaryShipping} shippingEstimate={null}
              shippingLoading={false} shippingError=""
              effectiveShipping={summaryShipping ?? 0}
              shippingNote={summaryShipping === null ? t('checkout.shippingCalculatedInKustom') : undefined}
              taxLines={summaryTaxLines} pricingMode={summaryPricingMode}
              taxEstimated={summaryTaxEstimated} taxPending={!totals && updating}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              t={t as (key: string) => string}
            />

            {/* Order notes */}
            <div className="mt-5">
              <label htmlFor="ck_notes" className="block text-xs font-medium text-gray-700 mb-1">
                {t('checkout.orderNotes')}
              </label>
              <textarea
                id="ck_notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                placeholder={t('checkout.orderNotesPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            {classicAvailable && (
              <Link
                href={lp('/checkout?method=classic')}
                className="inline-block mt-4 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
              >
                {t('checkout.payOtherWay')}
              </Link>
            )}
          </div>
        </aside>

        {/* ── Kustom checkout ── */}
        <section className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-4 min-h-[1.75rem]">
            <h2 className="text-base font-semibold text-gray-900">{t('checkout.payWithKustom')}</h2>
            {updating && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('checkout.kustomUpdating')}
              </span>
            )}
          </div>

          {failed ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
              <p>{t('checkout.kustomSessionFailed')}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                <button
                  type="button"
                  onClick={retry}
                  className="font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                >
                  {t('checkout.retry')}
                </button>
                {classicAvailable && (
                  <Link
                    href={lp('/checkout?method=classic')}
                    className="font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                  >
                    {t('checkout.payOtherWay')}
                  </Link>
                )}
              </div>
            </div>
          ) : showSnippetLoading ? (
            <LoadingState label={t('checkout.kustomLoading')} />
          ) : (
            // The Kustom container must stay unstyled and free to grow with
            // the iframe, so only the wrapper receives layout classes.
            <KustomSnippet html={html!} className="w-full" />
          )}

          <p className="mt-6 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            {t('checkout.allTransactionsSecure')}
          </p>
        </section>
      </div>
    </div>
  );
}
