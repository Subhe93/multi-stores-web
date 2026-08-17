'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';

function CartProviderWithAuth({
  children,
  locale,
  storeId,
}: {
  children: ReactNode;
  locale?: string;
  storeId?: string;
}) {
  const { token } = useAuth();
  return (
    <CartProvider token={token} locale={locale} storeId={storeId}>
      {children}
    </CartProvider>
  );
}

export function StoreProviders({
  children,
  locale,
  storeId,
}: {
  children: ReactNode;
  locale?: string;
  /** Store the cart belongs to — needed for store-scoped coupon validation. */
  storeId?: string;
}) {
  return (
    <AuthProvider>
      <CartProviderWithAuth locale={locale} storeId={storeId}>
        {children}
      </CartProviderWithAuth>
    </AuthProvider>
  );
}
