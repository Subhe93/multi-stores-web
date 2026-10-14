'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMarket, useMarkets, useMarketPathByLocale } from '@/hooks/useMarket';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { encodeGuestCart } from '@/lib/cartHandoff';
import { buildMarketSwitchUrl, marketLabel } from '@/lib/marketSwitch';

interface CountrySwitcherProps {
  storeSlug: string;
  primaryColor?: string;
  /** Translated sub-paths per locale (product pages), else the same path. */
  pathByLocale?: Record<string, string | undefined> | null;
}

/**
 * Market (country) switcher — rendered next to the language switcher inside
 * `<IfApp app="markets">`. Navigates to the same page on the target market's
 * origin, carrying a guest's cart in `?c=` (M1-DESIGN §4.4 / D10).
 */
export function CountrySwitcher({ storeSlug, primaryColor, pathByLocale }: CountrySwitcherProps) {
  const t = useTranslations();
  const locale = useLocale();
  const current = useMarket();
  const markets = useMarkets();
  const { items } = useCart();
  const { token } = useAuth();
  const registeredPaths = useMarketPathByLocale();

  if (!current || markets.length < 2) return null;

  const switchTo = (key: string) => {
    const target = markets.find((m) => m.key === key);
    if (!target || target.key === current.key) return;
    // Guests carry their lines across origins; a logged-in customer's cart is
    // server-side and re-priced by the new market on the next fetch.
    const handoff = token ? { param: null, dropped: 0 } : encodeGuestCart(items);
    const url = buildMarketSwitchUrl({
      storeSlug,
      current,
      target,
      pathname: window.location.pathname,
      search: window.location.search,
      locale,
      pathByLocale: pathByLocale ?? registeredPaths,
      cartParam: handoff.param,
      cartDropped: handoff.dropped,
    });
    window.location.assign(url);
  };

  return (
    <label className="flex items-center border rounded-lg overflow-hidden text-xs">
      <span className="sr-only">{t('market.switchCountry')}</span>
      <select
        aria-label={t('market.switchCountry')}
        value={current.key}
        onChange={(e) => switchTo(e.target.value)}
        className="px-2.5 py-1 font-medium bg-transparent outline-none cursor-pointer"
        style={{ color: primaryColor || '#2563eb' }}
      >
        {markets.map((m) => (
          <option key={m.key} value={m.key}>
            {marketLabel(m)} · {m.currency}
          </option>
        ))}
      </select>
    </label>
  );
}
