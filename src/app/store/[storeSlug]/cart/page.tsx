'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShoppingCart, Lock, ChevronLeft, Tag, X, Loader2, Minus, Plus } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/api';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CartSkeleton() {
  return (
    <div className="min-h-screen store-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-8" />
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7 space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4 py-5 border-b border-gray-200">
                <div className="w-20 h-20 bg-gray-100 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-gray-100 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mt-3" />
                </div>
                <div className="h-4 w-14 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-5 mt-10 lg:mt-0">
            <div className="store-surface store-bd border rounded-xl p-6 space-y-4">
              <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
              <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse mt-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function CartEmpty() {
  const t = useTranslations();
  const lp = useLocalePath();

  return (
    <div className="min-h-screen store-page flex flex-col items-center justify-center px-4 py-24">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #2563eb) 10%, white)' }}
      >
        <ShoppingCart className="w-9 h-9" style={{ color: 'var(--store-primary, #2563eb)' }} />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">{t('cart.empty')}</h1>
      <p className="text-gray-500 mb-8 text-center max-w-xs text-sm">{t('cart.emptyDescription')}</p>
      <Link
        href={lp('/products')}
        className="px-8 py-3 text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
      >
        {t('cart.continueShopping')}
      </Link>
    </div>
  );
}

// ── Shopify-style Cart Item ───────────────────────────────────────────────────
interface CartItemRowProps {
  item: {
    id: string;
    title?: string;
    name?: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    image?: string;
    variant?: string;
    currency?: string;
    customFields?: Record<string, unknown>;
    bundleOfferId?: string | null;
    bundleOriginalUnitPrice?: number | null;
    bundleTitle?: string | null;
    bundleLabel?: string | null;
    bundleStickerText?: string | null;
  };
  onUpdateQuantity: (id: string, qty: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClearBundle: (id: string) => Promise<void>;
}

function CartItemRow({ item, onUpdateQuantity, onRemove, onClearBundle }: CartItemRowProps) {
  const [updating, setUpdating] = useState(false);
  const currency = item.currency || 'EUR';
  const title = item.title || item.name || 'Product';
  const img = resolveMediaUrl(item.imageUrl || item.image);
  const lineTotal = item.price * item.quantity;
  const hasBundle = Boolean(item.bundleOfferId);
  const originalUnit =
    typeof item.bundleOriginalUnitPrice === 'number' ? item.bundleOriginalUnitPrice : null;
  const originalLineTotal = originalUnit !== null ? originalUnit * item.quantity : null;

  async function changeQty(qty: number) {
    if (qty < 1) return;
    setUpdating(true);
    try { await onUpdateQuantity(item.id, qty); } finally { setUpdating(false); }
  }

  return (
    <div className={`flex gap-4 py-5 border-b border-gray-200 last:border-b-0 transition-opacity ${updating ? 'opacity-50' : ''}`}>
      {/* Thumbnail */}
      <div className="relative w-20 h-20 shrink-0">
        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          {img ? (
            <img src={img} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ShoppingCart className="w-6 h-6" />
            </div>
          )}
        </div>
        {/* Quantity badge */}
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-600 text-white text-[10px] font-semibold flex items-center justify-center z-10">
          {item.quantity}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{title}</p>
        {item.variant && (
          <p className="text-xs text-gray-500">{item.variant}</p>
        )}
        {hasBundle && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <Tag className="w-3 h-3" />
              {item.bundleTitle || 'Bundle'}
              {item.bundleLabel ? ` · ${item.bundleLabel}` : ''}
            </span>
            {item.bundleStickerText && (
              <span className="inline-flex items-center rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {item.bundleStickerText}
              </span>
            )}
            <button
              onClick={() => onClearBundle(item.id)}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
            >
              Remove bundle
            </button>
          </div>
        )}
        {item.customFields && Object.keys(item.customFields).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {Object.entries(item.customFields).map(([k, v]) => (
              <span key={k} className="text-xs text-gray-400">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}

        {/* Quantity stepper */}
        <div className="flex items-center gap-3 mt-auto pt-2">
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden h-8">
            <button
              onClick={() => changeQty(item.quantity - 1)}
              disabled={updating || item.quantity <= 1 || hasBundle}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 h-8 flex items-center justify-center text-sm font-medium text-gray-900 border-x border-gray-300">
              {item.quantity}
            </span>
            <button
              onClick={() => changeQty(item.quantity + 1)}
              disabled={updating || hasBundle}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Line price */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900">{formatPrice(lineTotal, currency)}</p>
        {originalLineTotal !== null && originalLineTotal > lineTotal && (
          <p className="text-xs text-gray-400 line-through tabular-nums">
            {formatPrice(originalLineTotal, currency)}
          </p>
        )}
        {item.quantity > 1 && (
          <p className="text-xs text-gray-400 mt-0.5">{formatPrice(item.price, currency)} each</p>
        )}
      </div>
    </div>
  );
}

// ── Main Cart Page ─────────────────────────────────────────────────────────────
export default function StoreCartPage() {
  const t = useTranslations();
  const lp = useLocalePath();
  const {
    items, loading, subtotal, total, coupon,
    itemCount, updateQuantity, removeItem, clearBundle, clearCart, applyCoupon, removeCoupon,
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const currency = items[0]?.currency || 'EUR';

  const discount = coupon
    ? coupon.type === 'percentage'
      ? subtotal * (coupon.discount / 100)
      : coupon.discount
    : 0;

  if (loading) return <CartSkeleton />;
  if (items.length === 0) return <CartEmpty />;

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

  return (
    <div className="min-h-screen store-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Page title */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">
          {t('cart.title')}
        </h1>

        <div className="lg:grid lg:grid-cols-12 lg:gap-12">

          {/* ── Left: Items ─────────────────────────────────── */}
          <div className="lg:col-span-7">
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  onClearBundle={clearBundle}
                />
              ))}
            </div>

            {/* Continue shopping */}
            <div className="mt-6 pt-4 flex items-center justify-between">
              <Link
                href={lp('/products')}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                {t('cart.continueShopping')}
              </Link>

              {/* Clear cart */}
              <button
                onClick={() => clearCart()}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                {t('cart.clearCart')}
              </button>
            </div>
          </div>

          {/* ── Right: Order Summary ─────────────────────────── */}
          <div className="lg:col-span-5 mt-10 lg:mt-0">
            <div className="store-surface store-bd rounded-xl border p-6 lg:sticky lg:top-6">

              <h2 className="text-base font-semibold text-gray-900 mb-4">
                {t('checkout.orderSummary')}
                <span className="ml-2 font-normal text-gray-500 text-sm">
                  ({t('cart.itemCount', { count: itemCount })})
                </span>
              </h2>

              {/* Mini item list */}
              <div className="space-y-3 mb-4">
                {items.map((item) => {
                  const img = resolveMediaUrl(item.imageUrl || item.image);
                  const title = item.title || item.name || 'Product';
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative w-10 h-10 shrink-0">
                        <div className="w-full h-full rounded overflow-hidden border border-gray-200 bg-white">
                          {img ? (
                            <img src={img} alt={title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-100" />
                          )}
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-600 text-white text-[9px] font-bold flex items-center justify-center z-10">
                          {item.quantity}
                        </span>
                      </div>
                      <p className="flex-1 text-xs text-gray-700 leading-snug line-clamp-1">{title}</p>
                      <p className="text-xs font-semibold text-gray-900 shrink-0">
                        {formatPrice(item.price * item.quantity, item.currency || 'EUR')}
                      </p>
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
                      onClick={() => removeCoupon()}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove coupon"
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
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                        placeholder={t('cart.couponPlaceholder')}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition flex items-center gap-1 shrink-0"
                    >
                      {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('cart.applyCoupon')}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="text-xs text-red-500 mb-2">{couponError}</p>
                )}

                {/* Totals */}
                <div className="flex justify-between text-sm text-gray-600 py-1">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-medium text-gray-900">{formatPrice(subtotal, currency)}</span>
                </div>

                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">{t('cart.shipping')}</span>
                  <span className="text-green-600 font-medium">{t('checkout.freeShippingLabel')}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-green-600">{t('cart.discount')}</span>
                    <span className="text-green-600 font-medium">-{formatPrice(discount, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between py-3 border-t border-gray-200 mt-1">
                  <span className="text-base font-semibold text-gray-900">{t('cart.total')}</span>
                  <span className="text-base font-bold text-gray-900">{formatPrice(total, currency)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <Link
                href={lp('/checkout')}
                className="flex items-center justify-center gap-2 w-full py-3.5 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity mt-1"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                <Lock className="w-4 h-4" />
                {t('cart.checkout')}
              </Link>

              <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                {t('cart.secureCheckout')}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
