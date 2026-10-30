'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useMarket, useMarkets, useMarketPathByLocale, useStoreCustomDomain } from '@/hooks/useMarket';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { encodeGuestCart } from '@/lib/cartHandoff';
import { MARKET_SUGGEST_DISMISS_COOKIE } from '@/lib/market';
import { buildMarketSwitchUrl, countryName, marketLabel } from '@/lib/marketSwitch';

interface MarketSuggestBannerProps {
  storeSlug: string;
  /** Market key the proxy suggested (`x-market-suggest`). */
  suggestedKey: string;
  /** Visitor country the suggestion came from (`x-market-geo`). */
  country: string | null;
}

const DISMISS_MAX_AGE_S = 365 * 24 * 60 * 60;

/**
 * "It looks like you are in {country}. Switch to {market}?" strip under the
 * header (M1-DESIGN §4.4 / L7). Never redirects; dismiss sets a 365-day
 * cookie the proxy honours so the suggestion header stops being sent.
 */
export function MarketSuggestBanner({ storeSlug, suggestedKey, country }: MarketSuggestBannerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const current = useMarket();
  const markets = useMarkets();
  const { items } = useCart();
  const { token } = useAuth();
  const pathByLocale = useMarketPathByLocale();
  const storeCustomDomain = useStoreCustomDomain();
  const [dismissed, setDismissed] = useState(false);

  const target = markets.find((m) => m.key === suggestedKey);
  if (dismissed || !current || !target || target.key === current.key) return null;

  const dismiss = () => {
    document.cookie = `${MARKET_SUGGEST_DISMISS_COOKIE}=1; path=/; max-age=${DISMISS_MAX_AGE_S}; samesite=lax`;
    setDismissed(true);
  };

  const go = () => {
    const handoff = token ? { param: null, dropped: 0 } : encodeGuestCart(items);
    window.location.assign(
      buildMarketSwitchUrl({
        storeSlug,
        current,
        target,
        pathname: window.location.pathname,
        search: window.location.search,
        locale,
        pathByLocale,
        cartParam: handoff.param,
        cartDropped: handoff.dropped,
        storeCustomDomain,
      }),
    );
  };

  const marketName = marketLabel(target);
  const countryLabel = country ? countryName(country, locale) : marketName;

  return (
    <div
      role="status"
      className="store-surface store-bd border-b px-4 py-2 text-sm flex items-center justify-center gap-3 flex-wrap"
    >
      <span className="text-gray-700">
        {t('market.suggest.title', { country: countryLabel, market: marketName })}
      </span>
      <button
        type="button"
        onClick={go}
        className="px-3 py-1 rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
      >
        {t('market.suggest.cta', { market: marketName })}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('market.suggest.dismiss')}
        className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
