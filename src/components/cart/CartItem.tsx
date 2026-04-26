'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/api';

export interface CartItemData {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: string;
  customFields?: Record<string, unknown>;
  customerFile?: string;
  currency?: string;
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
  const currency = item.currency || 'EUR';
  const lineTotal = item.price * item.quantity;
  const img = resolveMediaUrl(item.imageUrl);

  async function handleQuantity(qty: number) {
    if (qty < 1) return;
    setUpdating(true);
    try { await onUpdateQuantity(item.id, qty); } finally { setUpdating(false); }
  }

  return (
    <div className={`flex gap-3 py-4 border-b border-gray-100 last:border-b-0 transition-opacity ${updating ? 'opacity-50' : ''}`}>
      {/* Thumbnail with quantity badge */}
      <div className="relative w-16 h-16 shrink-0">
        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
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
          <h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{item.title}</h3>
          <p className="text-sm font-semibold text-gray-900 shrink-0">{formatPrice(lineTotal, currency, locale)}</p>
        </div>

        {item.variant && (
          <p className="text-xs text-gray-500">{item.variant}</p>
        )}

        {item.customFields && Object.keys(item.customFields).length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {Object.entries(item.customFields).map(([k, v]) => (
              <span key={k} className="text-xs text-gray-400">{k}: {String(v)}</span>
            ))}
          </div>
        )}

        {/* Quantity controls + remove */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => handleQuantity(item.quantity - 1)}
              disabled={updating || item.quantity <= 1}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease"
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
              aria-label="Increase"
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
      </div>
    </div>
  );
}
