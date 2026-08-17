'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';

function CartProviderWithAuth({
  children,
  locale,
  storeId,
  storeCurrency,
}: {
  children: ReactNode;
  locale?: string;
  storeId?: string;
  storeCurrency?: string;
}) {
  const { token } = useAuth();
  return (
    <CartProvider
      token={token}
      locale={locale}
      storeId={storeId}
      storeCurrency={storeCurrency}
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
}: {
  children: ReactNode;
  locale?: string;
  /** Store the cart belongs to — needed for store-scoped coupon validation. */
  storeId?: string;
  /** The store's currency — cart and checkout display it instead of the
   *  platform default stamped on individual items. */
  storeCurrency?: string;
}) {
  return (
    <AuthProvider>
      <CartProviderWithAuth
        locale={locale}
        storeId={storeId}
        storeCurrency={storeCurrency}
      >
        {children}
      </CartProviderWithAuth>
    </AuthProvider>
  );
}
