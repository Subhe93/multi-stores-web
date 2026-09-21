'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';

function CartProviderWithAuth({
  children,
  locale,
  storeId,
  storeCurrency,
  storeTaxRateBp,
}: {
  children: ReactNode;
  locale?: string;
  storeId?: string;
  storeCurrency?: string;
  storeTaxRateBp?: number | null;
}) {
  const { token } = useAuth();
  return (
    <CartProvider
      token={token}
      locale={locale}
      storeId={storeId}
      storeCurrency={storeCurrency}
      storeTaxRateBp={storeTaxRateBp}
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
  storeTaxRateBp,
}: {
  children: ReactNode;
  locale?: string;
  /** Store the cart belongs to — needed for store-scoped coupon validation. */
  storeId?: string;
  /** The store's currency — cart and checkout display it instead of the
   *  platform default stamped on individual items. */
  storeCurrency?: string;
  /** The store's resolved VAT rate in basis points (informational VAT line). */
  storeTaxRateBp?: number | null;
}) {
  return (
    <AuthProvider>
      <CartProviderWithAuth
        locale={locale}
        storeId={storeId}
        storeCurrency={storeCurrency}
        storeTaxRateBp={storeTaxRateBp}
      >
        {children}
      </CartProviderWithAuth>
    </AuthProvider>
  );
}
