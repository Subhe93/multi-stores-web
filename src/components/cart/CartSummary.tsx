'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/format';
import type { TaxLine, TaxPricingMode } from '@/lib/tax';
import { TaxLineRows } from './TaxLineRows';

interface CartSummaryProps {
  subtotal: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency?: string;
  locale?: string;
  itemCount?: number;
  /** Itemized tax lines from GET /cart (empty for guest carts). */
  taxLines?: TaxLine[];
  taxPricingMode?: TaxPricingMode;
  /** True while the lines are a registration-country estimate (or a guest cart). */
  taxEstimated?: boolean;
  /** EXCLUSIVE mode: `total` + tax; null when unknown (guest cart). */
  totalWithTax?: number | null;
}

export function CartSummary({
  subtotal,
  shipping,
  discount,
  total,
  currency = 'EUR',
  locale = 'en',
  itemCount,
  taxLines = [],
  taxPricingMode = 'INCLUSIVE',
  taxEstimated = true,
  totalWithTax = null,
}: CartSummaryProps) {
  const t = useTranslations('cart');
  const fmt = (amount: number) => formatPrice(amount, currency, locale);
  const exclusive = taxPricingMode === 'EXCLUSIVE';

  return (
    <div className="space-y-3">
      {/* Item count */}
      {itemCount !== undefined && (
        <div className="flex justify-between text-sm text-gray-500">
          <span>{t('itemCount', { count: itemCount })}</span>
        </div>
      )}

      {/* Subtotal */}
      <div className="flex justify-between text-sm text-gray-600">
        <span>{t('subtotal')}</span>
        <span>{fmt(subtotal)}</span>
      </div>

      {/* Shipping */}
      <div className="flex justify-between text-sm text-gray-600">
        <span>{t('shipping')}</span>
        <span>
          {shipping !== undefined
            ? shipping === 0
              ? t('calculatedAtCheckout')
              : fmt(shipping)
            : t('calculatedAtCheckout')}
        </span>
      </div>

      {/* Discount */}
      {discount !== undefined && discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>{t('discount')}</span>
          <span>-{fmt(discount)}</span>
        </div>
      )}

      {/* Divider + Total */}
      <div className="border-t border-dashed border-gray-200 pt-3">
        <div className="flex justify-between text-base font-bold text-gray-900">
          <span>{t('total')}</span>
          <span>{fmt(total)}</span>
        </div>

        {exclusive ? (
          taxLines.length > 0 && totalWithTax !== null ? (
            // Tax is added on top: itemized lines, then the grand total.
            <div className="mt-2 space-y-1">
              <TaxLineRows lines={taxLines} currency={currency} locale={locale} variant="row" />
              <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-gray-100">
                <span>{t('totalInclTax')}</span>
                <span>{fmt(totalWithTax)}</span>
              </div>
              {taxEstimated && <p className="text-xs text-gray-500">{t('taxEstimatedNote')}</p>}
            </div>
          ) : (
            // Guest cart: the server has nothing to estimate from yet.
            <p className="text-xs text-gray-500 mt-1">{t('taxAtCheckout')}</p>
          )
        ) : (
          // Prices are tax inclusive: informational, the total is unchanged.
          <div className="mt-1 space-y-0.5">
            <TaxLineRows lines={taxLines} currency={currency} locale={locale} variant="muted" />
          </div>
        )}
      </div>
    </div>
  );
}
