'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';
import { StoreTaxProvider } from '@/hooks/useStoreTax';
import type { StoreTaxConfig } from '@/lib/tax';

function CartProviderWithAuth({
  children,
  locale,
  storeId,
  storeCurrency,
  storeTax,
}: {
  children: ReactNode;
  locale?: string;
  storeId?: string;
  storeCurrency?: string;
  storeTax?: StoreTaxConfig | null;
}) {
  const { token } = useAuth();
  return (
    <CartProvider
      token={token}
      locale={locale}
      storeId={storeId}
      storeCurrency={storeCurrency}
      storeTax={storeTax}
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
}) {
  return (
    <AuthProvider>
      <StoreTaxProvider value={storeTax ?? null}>
        <CartProviderWithAuth
          locale={locale}
          storeId={storeId}
          storeCurrency={storeCurrency}
          storeTax={storeTax}
        >
          {children}
        </CartProviderWithAuth>
      </StoreTaxProvider>
    </AuthProvider>
  );
}
