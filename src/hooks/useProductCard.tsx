'use client';

// Product card settings of the current store (theme_customizations.product.card,
// already resolved) for client components. null = the store did not opt in:
// every caller renders today's card. Fed by StoreProviders (store layout,
// builder preview, demo); outside a provider the value is null.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ProductCardSettings } from '@/lib/productCard/settings';

interface ProductCardContextValue {
  settings: ProductCardSettings | null;
  storeSlug?: string;
}

const NONE: ProductCardContextValue = { settings: null };
const ProductCardContext = createContext<ProductCardContextValue>(NONE);

export function ProductCardProvider({
  settings,
  storeSlug,
  children,
}: {
  settings?: ProductCardSettings | null;
  storeSlug?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ settings: settings ?? null, storeSlug }), [settings, storeSlug]);
  return <ProductCardContext.Provider value={value}>{children}</ProductCardContext.Provider>;
}

/** The store's card settings, or null (classic card, no `card=1`). */
export function useProductCardSettings(): ProductCardSettings | null {
  return useContext(ProductCardContext).settings;
}

/** Slug of the store the cards belong to (quick add reads the product with it). */
export function useProductCardStoreSlug(): string | undefined {
  return useContext(ProductCardContext).storeSlug;
}
