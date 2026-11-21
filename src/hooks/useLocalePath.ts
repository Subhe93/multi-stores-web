'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { storeLocales } from '@/i18n/config';
import { useStorePathPrefixValue } from './useStorePathPrefix';

/**
 * Returns a function that prefixes paths with the current locale
 * ONLY when the URL already has a locale prefix (i.e. secondary locale).
 * Primary locale links stay clean (no prefix).
 *
 * M156: on a locale-path market the store layout provides the request's
 * own prefix (`/de-at`), which is used as it is; everywhere else (platform
 * pages, builder preview, other stores) the pathname detection runs as before.
 */
export function useLocalePath() {
  const locale = useLocale();
  const pathname = usePathname();
  const pathPrefix = useStorePathPrefixValue();
  // Storefront locales, store-only ones ('ku') included; the platform pages
  // never carry those prefixes, so their result is unchanged.
  const hasPrefix = storeLocales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  const prefix = pathPrefix ?? (hasPrefix ? `/${locale}` : '');

  return (path: string) => `${prefix}${path}`;
}
