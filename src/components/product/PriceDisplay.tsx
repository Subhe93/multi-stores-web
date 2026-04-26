import { formatPrice } from '@/lib/format';

interface PriceDisplayProps {
  price: number;
  comparePrice?: number;
  currency?: string;
  locale?: string;
}

export function PriceDisplay({ price, comparePrice, currency = 'EUR', locale = 'en' }: PriceDisplayProps) {
  const fmt = (amount: number) => formatPrice(amount, currency, locale);
  const isOnSale = comparePrice !== undefined && comparePrice > price;
  const discountPct = isOnSale
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

  return (
    <div className="flex items-center flex-wrap gap-3">
      <span
        className="text-3xl font-extrabold tracking-tight"
        style={isOnSale ? { color: 'var(--store-primary, #2563eb)' } : { color: '#111827' }}
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
    </div>
  );
}