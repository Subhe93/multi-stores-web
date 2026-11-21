'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useMarket, useMarkets, useMarketPathByLocale, useStoreCustomDomain } from '@/hooks/useMarket';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { encodeGuestCart } from '@/lib/cartHandoff';
import { MARKET_SUGGEST_DISMISS_COOKIE } from '@/lib/market';
import { countryName } from '@/lib/marketSwitch';
import { regionLocales } from '@/lib/region';
import { buildRegionUrl } from '@/lib/regionUrl';

interface MarketSuggestBannerProps {
  storeSlug: string;
  /** Market key the proxy suggested (`x-market-suggest`). */
  suggestedKey: string;
  /** Visitor country the suggestion came from (`x-market-geo`). */
  country: string | null;
}

const DISMISS_MAX_AGE_S = 365 * 24 * 60 * 60;

/**
 * "It looks like you are in {country}. [Shop for {country} ({currency})]"
 * strip under the header (M1-DESIGN §4.4 / L7, wording M155: the visitor
 * sees a country and a currency, never a market name). Never redirects;
 * dismiss sets a 365-day cookie the proxy honours so the suggestion header
 * stops being sent. The target URL comes from `buildRegionUrl`, so the
 * landing side stores the visitor's country (`?rg=`).
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
    // The geo country only when the suggested market sells there: it is then
    // the visitor's own country and the landing host stores it (`rg`). A
    // country no market lists falls into the default market as "Other
    // countries" (null), so nothing is stored. A non-default target that
    // does not list the geo country is routed by its first country.
    const geo = country?.trim().toUpperCase() ?? null;
    const choiceCountry =
      geo && target.countries.some((c) => c.toUpperCase() === geo) ? geo : target.is_default ? null : (target.countries[0] ?? null);
    // Languages come from the single resolver: the current locale when the
    // chosen country offers it, else that country's default.
    const offered = regionLocales(choiceCountry, {
      current,
      markets,
      primaryLocale: current.default_locale,
      secondaryLocales: current.locales,
      currentLocale: locale,
    });
    const choiceLocale = offered.includes(locale) ? locale : (offered[0] ?? locale);
    const url = buildRegionUrl(
      { country: choiceCountry, locale: choiceLocale },
      {
        storeSlug,
        current,
        markets,
        storeCustomDomain,
        primaryLocale: current.default_locale,
        locales: [current.default_locale, ...current.locales, locale],
        currentLocale: locale,
        pathname: window.location.pathname,
        search: window.location.search,
        pathByLocale,
        cart: handoff,
      },
    );
    if (url) window.location.assign(url);
  };

  const countryLabel = country ? countryName(country, locale) : target.countries[0] ? countryName(target.countries[0], locale) : target.currency;

  return (
    <div
      role="status"
      className="store-surface store-bd border-b px-4 py-2 text-sm flex items-center justify-center gap-3 flex-wrap"
    >
      <span className="text-gray-700">
        {t('market.suggest.title', { country: countryLabel })}
      </span>
      <button
        type="button"
        onClick={go}
        className="px-3 py-1 rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
      >
        {t('market.suggest.cta', { country: countryLabel, currency: target.currency })}
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
