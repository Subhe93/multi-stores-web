'use client';

import { formatPrice } from '@/lib/format';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';

interface PriceDisplayProps {
  price: number;
  comparePrice?: number;
  currency?: string;
  locale?: string;
  /** Estimated tax rate of the product (b2b stores only): drives the
   *  company net view, see useDisplayPrice. */
  taxRateBp?: number | null;
}

export function PriceDisplay({ price, comparePrice, currency = 'EUR', locale = 'en', taxRateBp }: PriceDisplayProps) {
  const display = useDisplayPrice();
  const fmt = (amount: number) => formatPrice(display(amount, taxRateBp, currency).amount, currency, locale);
  const isOnSale = comparePrice !== undefined && comparePrice > price;
  const discountPct = isOnSale
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

  return (
    <div className="flex items-center flex-wrap gap-3">
      <span
        className="text-3xl font-extrabold tracking-tight"
        style={isOnSale ? { color: 'var(--theme-colors-price, var(--store-primary, #2563eb))', textShadow: 'var(--theme-price-shadow, none)' } : { color: '#111827' }}
      >
        {fmt(price)}
      </span>

      {isOnSale && (
        <>
          <span className="text-base text-gray-400 line-through font-normal">
            {fmt(comparePrice)}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
            -{discountPct}%
          </span>
        </>
      )}
      <PriceTaxSuffix className="text-xs text-gray-500" taxRateBp={taxRateBp} />
    </div>
  );
}
