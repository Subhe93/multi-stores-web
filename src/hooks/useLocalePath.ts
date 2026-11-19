'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { storeLocales } from '@/i18n/config';

/**
 * Returns a function that prefixes paths with the current locale
 * ONLY when the URL already has a locale prefix (i.e. secondary locale).
 * Primary locale links stay clean (no prefix).
 */
export function useLocalePath() {
  const locale = useLocale();
  const pathname = usePathname();
  // Storefront locales, store-only ones ('ku') included; the platform pages
  // never carry those prefixes, so their result is unchanged.
  const hasPrefix = storeLocales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  const prefix = hasPrefix ? `/${locale}` : '';

  return (path: string) => `${prefix}${path}`;
}
