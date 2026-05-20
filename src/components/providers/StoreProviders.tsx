'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';

function CartProviderWithAuth({ children, locale }: { children: ReactNode; locale?: string }) {
  const { token } = useAuth();
  return <CartProvider token={token} locale={locale}>{children}</CartProvider>;
}

export function StoreProviders({ children, locale }: { children: ReactNode; locale?: string }) {
  return (
    <AuthProvider>
      <CartProviderWithAuth locale={locale}>{children}</CartProviderWithAuth>
    </AuthProvider>
  );
}
