'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/hooks/useCart';

function CartProviderWithAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  return <CartProvider token={token}>{children}</CartProvider>;
}

export function StoreProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProviderWithAuth>{children}</CartProviderWithAuth>
    </AuthProvider>
  );
}
