'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { useMarket } from '@/hooks/useMarket';

/** "Not available in <market>" text for a cart line hidden in the request market. */
export function useUnavailableInMarketText(): string {
  const t = useTranslations('cart');
  const market = useMarket();
  const name = market?.name || market?.primary_hostname || '';
  return name ? t('unavailableInMarket', { market: name }) : t('unavailableHere');
}

/** Inline notice shown on a flagged cart line in place of its price. */
export function UnavailableInMarketNotice({ className = '' }: { className?: string }) {
  const text = useUnavailableInMarketText();
  return (
    <p className={`inline-flex items-center gap-1 text-xs font-medium text-amber-700 ${className}`}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

/** Hint under a disabled checkout button while unavailable lines remain. */
export function RemoveUnavailableHint({ className = '' }: { className?: string }) {
  const t = useTranslations('cart');
  return (
    <p role="status" className={`text-xs text-amber-700 text-center ${className}`}>
      {t('removeUnavailable')}
    </p>
  );
}
