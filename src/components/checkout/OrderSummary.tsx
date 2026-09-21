'use client';

import { useState } from 'react';
import { Loader2, ShoppingBag, Tag, X, Minus, Plus, Trash2 } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { TaxLine, TaxPricingMode } from '@/lib/tax';
import { TaxLineRows } from '@/components/cart/TaxLineRows';

// ── Order summary (checkout side panel) ──────────────────────────────────────
// Shared by the classic checkout (read-only line items) and the Kustom-first
// checkout, which passes `onUpdateQuantity` / `onRemoveItem` so the customer
// can edit the cart next to the payment iframe without leaving the page.

export interface OrderSummaryItem {
  id: string;
  title?: string;
  name?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  image?: string;
  variant?: string;
  currency?: string;
  bundleOfferId?: string | null;
  bundleOriginalUnitPrice?: number | null;
  bundleTitle?: string | null;
  bundleLabel?: string | null;
  bundleStickerText?: string | null;
}

export interface OrderSummaryProps {
  items: OrderSummaryItem[];
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  coupon: { code: string; type: string; discount: number; freeShipping?: boolean } | null;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponLoading: boolean;
  couponError: string;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  shippingCost: number | null;
  shippingEstimate: { min: number; max: number } | null;
  shippingLoading: boolean;
  shippingError: string;
  effectiveShipping: number;
  /** When set, every line gets quantity +/- and a remove button. */
  onUpdateQuantity?: (itemId: string, quantity: number) => Promise<void> | void;
  onRemoveItem?: (itemId: string) => Promise<void> | void;
  /** Optional copy under the shipping row (e.g. "calculated in the Kustom checkout"). */
  shippingNote?: string;
  /** Name of the chosen shipping method, shown as "Shipping (Standard shipping)".
   *  Kustom mode passes nothing: the options live inside its iframe. */
  shippingMethodName?: string;
  /** Itemized tax lines (from POST /orders/quote, the Kustom session or GET /cart). */
  taxLines?: TaxLine[];
  /** Sum of `taxLines`; kept for callers that only have the total. */
  taxTotal?: number;
  /** INCLUSIVE: `total` contains the tax (muted rows under it); EXCLUSIVE: the
   *  rows add up before `total`, which must then already include them. */
  pricingMode?: TaxPricingMode;
  /** The lines are a registration-country estimate (no address yet). */
  taxEstimated?: boolean;
  /** EXCLUSIVE only: no quote yet (country unknown / request in flight). */
  taxPending?: boolean;
  t: (key: string) => string;
}

interface LineControlsProps {
  itemId: string;
  quantity: number;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  t: (key: string) => string;
}

// Compact quantity stepper + remove, same look as the cart page's CartItem.
function LineControls({ itemId, quantity, onUpdateQuantity, onRemoveItem, t }: LineControlsProps) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  return (
    <div className={`flex items-center justify-between mt-1.5 transition-opacity ${busy ? 'opacity-50' : ''}`}>
      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => run(() => onUpdateQuantity(itemId, quantity - 1))}
          disabled={busy || quantity <= 1}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={t('common.decreaseQuantity')}
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-7 h-6 flex items-center justify-center text-xs font-medium text-gray-900 border-x border-gray-200 tabular-nums">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => run(() => onUpdateQuantity(itemId, quantity + 1))}
          disabled={busy}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={t('common.increaseQuantity')}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => run(() => onRemoveItem(itemId))}
        disabled={busy}
        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
        aria-label={t('cart.remove')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function OrderSummary({
  items, subtotal, discount, total, currency,
  coupon, couponCode, setCouponCode, couponLoading, couponError,
  onApplyCoupon, onRemoveCoupon,
  shippingCost, shippingEstimate, shippingLoading, shippingError, effectiveShipping,
  onUpdateQuantity, onRemoveItem, shippingNote, shippingMethodName,
  taxLines = [], pricingMode = 'INCLUSIVE', taxEstimated = false, taxPending = false,
  t,
}: OrderSummaryProps) {
  const editable = Boolean(onUpdateQuantity && onRemoveItem);
  const exclusive = pricingMode === 'EXCLUSIVE';

  return (
    <div className="space-y-4">
      {/* Item list */}
      <div className="space-y-3">
        {items.map((item) => {
          const img = resolveMediaUrl(item.imageUrl || item.image);
          const title = item.title || item.name || 'Product';
          const lineTotal = item.price * item.quantity;
          const originalUnit =
            typeof item.bundleOriginalUnitPrice === 'number'
              ? item.bundleOriginalUnitPrice
              : null;
          const originalLineTotal =
            originalUnit !== null ? originalUnit * item.quantity : null;
          return (
            <div key={item.id} className={`flex gap-3 ${editable ? 'items-start' : 'items-center'}`}>
              <div className="relative w-14 h-14 shrink-0">
                <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-white">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-600 text-white text-[10px] font-bold flex items-center justify-center z-10">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug line-clamp-2">{title}</p>
                {item.variant && <p className="text-xs text-gray-500">{item.variant}</p>}
                {item.bundleOfferId && (
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      <Tag className="w-2.5 h-2.5" />
                      {item.bundleTitle || 'Bundle'}
                      {item.bundleLabel ? ` · ${item.bundleLabel}` : ''}
                    </span>
                    {item.bundleStickerText && (
                      <span className="inline-flex items-center rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {item.bundleStickerText}
                      </span>
                    )}
                  </div>
                )}
                {editable && onUpdateQuantity && onRemoveItem && (
                  <LineControls
                    itemId={item.id}
                    quantity={item.quantity}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                    t={t}
                  />
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {formatPrice(lineTotal, currency)}
                </p>
                {originalLineTotal !== null && originalLineTotal > lineTotal && (
                  <p className="text-[10px] text-gray-400 line-through tabular-nums">
                    {formatPrice(originalLineTotal, currency)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-1">
        {/* Coupon input */}
        {coupon?.code ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-green-600" />
              <span className="text-sm font-medium text-green-700">{coupon.code}</span>
            </div>
            <button
              type="button"
              onClick={onRemoveCoupon}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label={t('cart.removeCoupon')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onApplyCoupon(); } }}
                placeholder={t('cart.couponPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              />
            </div>
            <button
              type="button"
              onClick={onApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition flex items-center gap-1 shrink-0"
            >
              {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('cart.applyCoupon')}
            </button>
          </div>
        )}
        {couponError && <p className="text-xs text-red-500 mb-2">{couponError}</p>}

        {/* Price rows */}
        <div className="flex justify-between text-sm py-1">
          <span className="text-gray-600">{t('cart.subtotal')}</span>
          <span className="text-gray-900 font-medium">{formatPrice(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-gray-600">
            {t('cart.shipping')}
            {shippingMethodName ? ` (${shippingMethodName})` : ''}
          </span>
          <span className={`font-medium ${effectiveShipping === 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {shippingLoading ? '...'
              : coupon?.freeShipping ? t('checkout.freeShippingLabel')
              : shippingCost === null ? t('cart.calculatedAtCheckout')
              : shippingCost === 0 ? t('checkout.freeShippingLabel')
              : formatPrice(shippingCost, currency)}
          </span>
        </div>
        {shippingNote && (
          <p className="text-xs text-gray-500 text-right -mt-1">{shippingNote}</p>
        )}
        {shippingEstimate && !coupon?.freeShipping && shippingCost !== null && shippingCost > 0 && (
          <p className="text-xs text-gray-500 text-right -mt-1">{shippingEstimate.min}-{shippingEstimate.max} {t('checkout.businessDays')}</p>
        )}
        {shippingError && (
          <p className="text-xs text-red-500 mt-1">{shippingError}</p>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-green-600">{t('cart.discount')}</span>
            <span className="text-green-600 font-medium">-{formatPrice(discount, currency)}</span>
          </div>
        )}

        {/* EXCLUSIVE: tax is added on top, so the rows come before the total. */}
        {exclusive && (
          taxLines.length > 0 ? (
            <TaxLineRows lines={taxLines} currency={currency} variant="row" />
          ) : (
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{t('cart.tax')}</span>
              <span className="text-gray-500">{taxPending ? '...' : t('cart.calculatedAtCheckout')}</span>
            </div>
          )
        )}

        <div className="flex justify-between pt-3 border-t border-gray-200 mt-1">
          <span className="text-base font-semibold text-gray-900">{t('cart.total')}</span>
          <span className="text-base font-bold text-gray-900">{formatPrice(total, currency)}</span>
        </div>
        {/* INCLUSIVE: informational, prices already contain the tax. */}
        {!exclusive && taxLines.length > 0 && (
          <div className="pt-1 space-y-0.5">
            <TaxLineRows lines={taxLines} currency={currency} variant="muted" />
          </div>
        )}
        {taxLines.length > 0 && taxEstimated && (
          <p className="text-xs text-gray-500 pt-1">{t('cart.taxEstimatedNote')}</p>
        )}
      </div>
    </div>
  );
}
