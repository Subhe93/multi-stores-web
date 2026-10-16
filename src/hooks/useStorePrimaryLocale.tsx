'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The store's primary content locale (`language_config.primary_locale`),
// provided by StoreProviders. Client pages use it as the label fallback of
// translated snapshots (e.g. order personalization rows). Undefined outside
// a store tree.

const StorePrimaryLocaleContext = createContext<string | undefined>(undefined);

export function StorePrimaryLocaleProvider({ value, children }: { value?: string; children: ReactNode }) {
  return <StorePrimaryLocaleContext.Provider value={value}>{children}</StorePrimaryLocaleContext.Provider>;
}

/** The store's primary locale, or undefined when unknown. */
export function useStorePrimaryLocale(): string | undefined {
  return useContext(StorePrimaryLocaleContext);
}
