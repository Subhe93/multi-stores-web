'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { CartItem as CartItemType } from '@/hooks/useCart';

interface OrderSummaryProps {
  items: CartItemType[];
  subtotal: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency?: string;
  locale?: string;
}

export function OrderSummary({
  items,
  subtotal,
  shipping,
  discount,
  total,
  currency = 'EUR',
  locale = 'en',
}: OrderSummaryProps) {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const fmt = (amount: number) => formatPrice(amount, currency, locale);

  const summaryContent = (
    <>
      {/* Item list */}
      <div className="space-y-3 mb-6">
        {items.map((item) => {
          const img = item.imageUrl || item.image;
          const label = item.title || item.name || 'Product';
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {img ? (
                    <img src={img} alt={label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      No img
                    </div>
                  )}
                </div>
                {/* Quantity badge */}
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center font-medium">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                {item.variant && (
                  <p className="text-xs text-gray-400">{item.variant}</p>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 shrink-0">
                {fmt(item.price * item.quantity)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('cart.subtotal')}</span>
          <span className="text-gray-700">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('cart.shipping')}</span>
          <span className="text-gray-700">
            {shipping !== undefined && shipping > 0
              ? fmt(shipping)
              : t('cart.calculatedAtCheckout')}
          </span>
        </div>
        {discount !== undefined && discount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>{t('cart.discount')}</span>
            <span>-{fmt(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-3 mt-2">
          <span className="text-gray-900">{t('cart.total')}</span>
          <span className="text-gray-900">{fmt(total)}</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden lg:block bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('checkout.orderSummary')}
        </h2>
        {summaryContent}
      </div>

      {/* Mobile: collapsible toggle */}
      <div className="lg:hidden border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-4 py-3"
          aria-expanded={mobileOpen}
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--store-primary, #2563eb)' }}>
            {mobileOpen ? t('checkout.hideOrderSummary') : t('checkout.showOrderSummary')}
            {mobileOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
          <span className="text-base font-bold text-gray-900">{fmt(total)}</span>
        </button>

        {/* Collapsible content */}
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
            mobileOpen ? 'max-h-[2000px]' : 'max-h-0'
          }`}
        >
          <div className="px-4 pb-4">
            {summaryContent}
          </div>
        </div>
      </div>
    </>
  );
}
