'use client';

import { ReactNode, useMemo } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';
import { StoreTaxProvider } from '@/hooks/useStoreTax';
import { StoreAppsProvider } from '@/hooks/useStoreApps';
import { MarketProvider } from '@/hooks/useMarket';
import { StorePrimaryLocaleProvider } from '@/hooks/useStorePrimaryLocale';
import { BuyerTypeProvider, useBuyerType } from '@/hooks/useBuyerType';
import type { StoreTaxConfig } from '@/lib/tax';
import type { StorefrontApps } from '@/lib/storeApps';
import type { MarketRoute } from '@/lib/market';
import type { BuyerType } from '@/lib/buyerType';
import { normalizeB2bSettings } from '@/lib/b2bSettings';

function CartProviderWithAuth({
  children,
  locale,
  storeId,
  storeCurrency,
  storeTax,
  marketKey,
}: {
  children: ReactNode;
  locale?: string;
  storeId?: string;
  storeCurrency?: string;
  storeTax?: StoreTaxConfig | null;
  marketKey?: string;
}) {
  const { token, loading } = useAuth();
  // b2b app: the company view asks the API for per-line rates + net totals
  // (`?buyer=company`); `isCompany` is always false without the app, so the
  // request URLs of every other store stay identical (M2-DESIGN §9.11).
  const { isCompany } = useBuyerType();
  return (
    <CartProvider
      token={token}
      authReady={!loading}
      locale={locale}
      storeId={storeId}
      storeCurrency={storeCurrency}
      storeTax={storeTax}
      marketKey={marketKey}
      buyer={isCompany ? 'company' : undefined}
    >
      {children}
    </CartProvider>
  );
}

export function StoreProviders({
  children,
  locale,
  storeId,
  storeCurrency,
  storeTax,
  storeApps,
  market,
  markets,
  buyerType,
  primaryLocale,
}: {
  children: ReactNode;
  locale?: string;
  /** Store the cart belongs to — needed for store-scoped coupon validation. */
  storeId?: string;
  /** The store's currency — cart and checkout display it instead of the
   *  platform default stamped on individual items. */
  storeCurrency?: string;
  /** The store's tax settings (`tax` block of `storefront.getStore`): pricing
   *  mode + catalog display flag for price suffixes and guest-cart hints. */
  storeTax?: StoreTaxConfig | null;
  /** Enabled store apps (`apps` block of `storefront.getStore`), already
   *  normalized. Defaults to `{}` so existing callers keep working. */
  storeApps?: StorefrontApps;
  /** Market the request is served in (`market` of `storefront.getStore`);
   *  null/undefined for stores without the markets app. */
  market?: MarketRoute | null;
  /** Every LIVE market of the store (`markets` of `storefront.getStore`). */
  markets?: MarketRoute[] | null;
  /** b2b app: buyer type resolved on the server from the `ms-buyer-type`
   *  cookie / the app's default (M2-DESIGN §4.1). Only passed for stores
   *  with the app; ignored otherwise. */
  buyerType?: BuyerType;
  /** The store's primary content locale (label fallback of snapshots). */
  primaryLocale?: string;
}) {
  const b2bApp = storeApps?.b2b;
  // Stable settings object so the BuyerType context value only changes when
  // the app's settings actually do.
  const b2bSettings = useMemo(() => (b2bApp ? normalizeB2bSettings(b2bApp.settings) : null), [b2bApp]);
  return (
    <AuthProvider>
      <StoreTaxProvider value={storeTax ?? null}>
        <StoreAppsProvider value={storeApps}>
          <BuyerTypeProvider
            enabled={Boolean(b2bApp)}
            initial={buyerType}
            settings={b2bSettings}
          >
            <MarketProvider market={market} markets={markets}>
              <CartProviderWithAuth
                locale={locale}
                storeId={storeId}
                storeCurrency={storeCurrency}
                storeTax={storeTax}
                marketKey={market?.key}
              >
                <StorePrimaryLocaleProvider value={primaryLocale}>{children}</StorePrimaryLocaleProvider>
              </CartProviderWithAuth>
            </MarketProvider>
          </BuyerTypeProvider>
        </StoreAppsProvider>
      </StoreTaxProvider>
    </AuthProvider>
  );
}
