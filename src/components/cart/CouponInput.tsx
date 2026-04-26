'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Check, Loader2 } from 'lucide-react';

interface CouponInputProps {
  onApply: (code: string) => void;
  appliedCoupon?: string;
  onRemove?: () => void;
  loading?: boolean;
  error?: string;
}

export function CouponInput({
  onApply,
  appliedCoupon,
  onRemove,
  loading = false,
  error,
}: CouponInputProps) {
  const t = useTranslations('cart');
  const [code, setCode] = useState('');
  const [expanded, setExpanded] = useState(false);

  function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    onApply(trimmed);
    setCode('');
  }

  // Applied coupon state
  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            {t('couponApplied')}: <span className="font-bold">{appliedCoupon}</span>
          </span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            {t('remove')}
          </button>
        )}
      </div>
    );
  }

  // Collapsed state
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Tag className="w-4 h-4" />
        {t('haveCoupon')}
      </button>
    );
  }

  // Expanded input state
  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleApply()}
          placeholder={t('couponPlaceholder')}
          className={`flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition ${
            error
              ? 'border-red-300 focus:ring-red-500/20'
              : 'border-gray-200 focus:ring-gray-900/10'
          }`}
        />
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('applyCoupon')}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
