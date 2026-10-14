'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/api';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { UnavailableInMarketNotice } from './UnavailableInMarket';

export interface CartItemData {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: string;
  customFields?: Record<string, unknown>;
  /** Resolved "label: value" lines; preferred over the raw id-keyed map. */
  customFieldDisplay?: { id: string; label: string; value: unknown; display?: string | null }[];
  customerFile?: string;
  currency?: string;
  /** b2b stores: estimated rate of the line, for the company net view. */
  taxRateBp?: number | null;
  /** Markets app: hidden in the request market — no price, remove only. */
  unavailableInMarket?: boolean;
}

// Turn a stored custom-field value into short display text: option labels
// win, files show their name, booleans a check mark, everything else as-is.
export function formatCartFieldValue(value: unknown, display?: string | null): string {
  if (display) return display;
  if (value === true) return '\u2713';
  if (value === false) return '\u2014';
  if (value && typeof value === 'object') {
    const obj = value as { name?: unknown; url?: unknown };
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.url === 'string') return obj.url.split('/').pop() || '';
    return '';
  }
  return String(value ?? '');
}

interface CartItemProps {
  item: CartItemData;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  locale?: string;
}

export function CartItem({ item, onUpdateQuantity, onRemove, locale = 'en' }: CartItemProps) {
  const t = useTranslations();
  const [updating, setUpdating] = useState(false);
  const display = useDisplayPrice();
  const currency = item.currency || 'EUR';
  // Company view (b2b app) shows the net line total; persons the gross.
  const lineTotal = display(item.price, item.taxRateBp, currency).amount * item.quantity;
  const img = resolveMediaUrl(item.imageUrl);
  const unavailable = item.unavailableInMarket === true;

  async function handleQuantity(qty: number) {
    if (qty < 1) return;
    setUpdating(true);
    try { await onUpdateQuantity(item.id, qty); } finally { setUpdating(false); }
  }

  return (
    <div className={`flex gap-3 py-4 border-b border-gray-100 last:border-b-0 transition-opacity ${updating ? 'opacity-50' : ''}`}>
      {/* Thumbnail with quantity badge */}
      <div className="relative w-16 h-16 shrink-0">
        <div className={`w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 ${unavailable ? 'opacity-50 grayscale' : ''}`}>
          {img ? (
            <img src={img} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-100" />
          )}
        </div>
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-600 text-white text-[9px] font-bold flex items-center justify-center z-10">
          {item.quantity}
        </span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-sm font-medium leading-snug line-clamp-2 ${unavailable ? 'text-gray-400' : 'text-gray-900'}`}>{item.title}</h3>
          {/* An unavailable line has no valid price in this market. */}
          {!unavailable && (
            <p className="text-sm font-semibold text-gray-900 shrink-0">{formatPrice(lineTotal, currency, locale)}</p>
          )}
        </div>

        {unavailable && <UnavailableInMarketNotice />}

        {item.variant && (
          <p className="text-xs text-gray-500">{item.variant}</p>
        )}

        {item.customFieldDisplay && item.customFieldDisplay.length > 0 ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {item.customFieldDisplay.map((f) => (
              <span key={f.id} className="text-xs text-gray-400">
                {f.label}: {formatCartFieldValue(f.value, f.display)}
              </span>
            ))}
          </div>
        ) : item.customFields && Object.keys(item.customFields).length > 0 ? (
          // Legacy items without resolved labels: show only the values so the
          // customer never sees a raw field id.
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {Object.entries(item.customFields).map(([k, v]) => (
              <span key={k} className="text-xs text-gray-400">{formatCartFieldValue(v)}</span>
            ))}
          </div>
        ) : null}

        {/* Unavailable line: the API rejects quantity changes, so only Remove. */}
        {unavailable ? (
          <div className="flex items-center justify-end mt-auto pt-2">
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('cart.remove')}
            </button>
          </div>
        ) : (
        /* Quantity controls + remove */
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => handleQuantity(item.quantity - 1)}
              disabled={updating || item.quantity <= 1}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t('common.decreaseQuantity')}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 h-7 flex items-center justify-center text-xs font-medium text-gray-900 border-x border-gray-200">
              {item.quantity}
            </span>
            <button
              onClick={() => handleQuantity(item.quantity + 1)}
              disabled={updating}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t('common.increaseQuantity')}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label={t('cart.remove')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
