'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/format';
import type { B2bNetTotals, TaxLine, TaxPricingMode } from '@/lib/tax';
import { useBuyerType } from '@/hooks/useBuyerType';
import { TaxLineRows } from './TaxLineRows';
import { ReverseChargeCartHint } from './ReverseChargeCartHint';

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
  /** b2b app, company view: the `b2b` net block of GET /cart (null when absent). */
  b2bNet?: B2bNetTotals | null;
  /** b2b app, company view: net item subtotal (server, else client estimate);
   *  null falls back to the gross `subtotal`. */
  netItems?: number | null;
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
  b2bNet = null,
  netItems = null,
}: CartSummaryProps) {
  const t = useTranslations('cart');
  const tB2b = useTranslations('b2b');
  const { isCompany } = useBuyerType();
  const fmt = (amount: number) => formatPrice(amount, currency, locale);
  const exclusive = taxPricingMode === 'EXCLUSIVE';

  // Company view on an INCLUSIVE store (M2-DESIGN §4.3 / L4): net subtotal,
  // VAT as regular rows, "Total incl. VAT" = the unchanged gross total.
  // Persons (and every store without the app) take the branches below.
  if (isCompany && !exclusive) {
    const netSubtotal = netItems ?? subtotal;
    return (
      <div className="space-y-3">
        {itemCount !== undefined && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>{t('itemCount', { count: itemCount })}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <span>{tB2b('subtotalExclVat')}</span>
          <span>{fmt(netSubtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('shipping')}</span>
          <span>
            {shipping !== undefined && shipping !== 0
              ? fmt(b2bNet ? b2bNet.net_shipping : shipping)
              : t('calculatedAtCheckout')}
          </span>
        </div>
        {/* The net subtotal is already post-discount (L4), so the discount is
            informational here and the rows add up. */}
        {discount !== undefined && discount > 0 && (
          <p className="text-xs text-gray-500">{tB2b('includesDiscount', { amount: fmt(discount) })}</p>
        )}
        <div className="border-t border-dashed border-gray-200 pt-3 space-y-1">
          {b2bNet && (
            <div className="flex justify-between text-sm font-medium text-gray-900">
              <span>{tB2b('netTotal')}</span>
              <span>{fmt(b2bNet.net_total)}</span>
            </div>
          )}
          <TaxLineRows lines={taxLines} currency={currency} locale={locale} variant="row" />
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>{tB2b('totalInclVat')}</span>
            <span>{fmt(total)}</span>
          </div>
          {taxLines.length > 0 && taxEstimated && <p className="text-xs text-gray-500">{t('taxEstimatedNote')}</p>}
          {taxLines.length === 0 && <p className="text-xs text-gray-500">{t('taxAtCheckout')}</p>}
          <ReverseChargeCartHint />
        </div>
      </div>
    );
  }

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
