'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/format';
import { formatTaxRate, hasTax, includedTax } from '@/lib/tax';

interface CartSummaryProps {
  subtotal: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency?: string;
  locale?: string;
  itemCount?: number;
  /** VAT rate in basis points; the "Includes VAT" line is shown when > 0. */
  taxRateBp?: number;
  /** VAT included in `total`; computed from the rate when omitted. */
  taxAmount?: number;
}

export function CartSummary({
  subtotal,
  shipping,
  discount,
  total,
  currency = 'EUR',
  locale = 'en',
  itemCount,
  taxRateBp,
  taxAmount,
}: CartSummaryProps) {
  const t = useTranslations('cart');
  const fmt = (amount: number) => formatPrice(amount, currency, locale);

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
        {/* Informational: prices are tax inclusive, the total is unchanged. */}
        {hasTax(taxRateBp) && (
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{t('includesVat', { rate: formatTaxRate(taxRateBp) })}</span>
            <span>{fmt(taxAmount ?? includedTax(total, taxRateBp, currency))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
