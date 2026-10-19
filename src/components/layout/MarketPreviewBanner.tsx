'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { useMarket } from '@/hooks/useMarket';

/**
 * Market preview (`<slug>--<key>.<platform host>`): a non-dismissable strip
 * at the very top of every page — "Preview of the {name} market — checkout
 * is disabled". Renders nothing on a normal market host or for a store
 * without the markets app, so those pages are unchanged.
 */
export function MarketPreviewBanner() {
  const t = useTranslations();
  const market = useMarket();
  if (!market?.preview) return null;
  return (
    <div
      role="status"
      data-testid="market-preview-banner"
      className="bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 text-center"
    >
      <Eye className="w-4 h-4 shrink-0" aria-hidden />
      <span>{t('market.preview.banner', { name: market.name || market.key })}</span>
    </div>
  );
}

/** Why the pay / place-order button is disabled on a preview host. */
export function MarketPreviewCheckoutNotice({ className = '' }: { className?: string }) {
  const t = useTranslations();
  return (
    <p
      role="note"
      data-testid="market-preview-checkout-notice"
      className={`text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-center ${className}`}
    >
      {t('market.preview.checkoutDisabled')}
    </p>
  );
}
