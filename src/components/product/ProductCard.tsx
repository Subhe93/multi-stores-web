import Link from 'next/link';
import { Eye } from 'lucide-react';

interface ProductCardProps {
  title: string;
  href: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  currency?: string;
  badge?: string;
  promotionLabel?: string;
}

export function ProductCard({
  title,
  href,
  price,
  comparePrice,
  imageUrl,
  currency = 'EUR',
  badge,
  promotionLabel,
}: ProductCardProps) {
  const formatted = new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(price);

  const compareFormatted =
    comparePrice && comparePrice > price
      ? new Intl.NumberFormat('en', { style: 'currency', currency }).format(comparePrice)
      : null;

  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  return (
    <Link href={href} className="group block">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <svg
              viewBox="0 0 24 24"
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9l4-4 4 4 4-4 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-full shadow-lg translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Eye className="w-4 h-4" />
            View
          </span>
        </div>

        {/* Discount badge */}
        {discount > 0 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-[11px] font-bold text-white rounded-full bg-red-500">
            -{discount}%
          </span>
        )}

        {/* Custom badge (e.g. "New") */}
        {badge && !discount && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 text-[11px] font-bold text-white rounded-full"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
          >
            {badge}
          </span>
        )}

        {/* Promotion badge */}
        {promotionLabel && (
          <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold text-amber-800 rounded-full bg-amber-100 border border-amber-200">
            {promotionLabel}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:opacity-75 transition-opacity">
          {title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {formatted}
          </span>
          {compareFormatted && (
            <span className="text-xs text-gray-400 line-through">{compareFormatted}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
