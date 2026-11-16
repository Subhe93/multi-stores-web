'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { resolveBackLabel } from '@/lib/externalReturn';
import { focusedStorefront, type FocusedStorefront } from '@/lib/focusedStorefront';

// Client side of the focused storefront gate (src/lib/focusedStorefront.ts).
// The settings come from the StoreProviders context the store layout fills
// (already resolved for the request host), so the server render and the
// hydrated tree always agree. Outside a provider tree, and for every store
// without the flag, both hooks return null.

/** The focused storefront of the current store, or null. */
export function useFocusedStorefront(): FocusedStorefront | null {
  return focusedStorefront(useCheckoutSettings());
}

export interface BackToSiteLink {
  href: string;
  rel: 'noreferrer';
  /** The merchant's `back_label` for the locale, else "Back to <host>". */
  label: string;
}

/** The "back to site" link of a focused storefront, or null. */
export function useBackToSite(): BackToSiteLink | null {
  const settings = useCheckoutSettings();
  const locale = useLocale();
  const t = useTranslations('checkout');
  const focus = focusedStorefront(settings);
  if (!focus) return null;
  return {
    href: focus.siteUrl,
    rel: 'noreferrer',
    label: resolveBackLabel(settings, locale) || t('returnToSite', { site: focus.siteHost }),
  };
}
