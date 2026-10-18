'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_CHECKOUT_SETTINGS, type CheckoutSettings } from '@/lib/checkoutSettings';

// ── Store checkout settings context (M5 W2-A) ────────────────────────────────
// `storefront.getStore(...).checkout` (normalized) made available to every
// client component of the storefront: add-to-cart destination, phone
// requirement, pay button label, coupon URL params. Provided by StoreProviders;
// the defaults (today's behaviour) outside a provider tree or when the API
// sent no block.

const CheckoutSettingsContext = createContext<CheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);

export function CheckoutSettingsProvider({ value, children }: { value?: CheckoutSettings | null; children: ReactNode }) {
  return <CheckoutSettingsContext.Provider value={value ?? DEFAULT_CHECKOUT_SETTINGS}>{children}</CheckoutSettingsContext.Provider>;
}

/** The store's checkout settings (defaults outside a StoreProviders tree). */
export function useCheckoutSettings(): CheckoutSettings {
  return useContext(CheckoutSettingsContext);
}
