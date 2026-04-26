'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { locales } from '@/i18n/config';

/**
 * Returns a function that prefixes paths with the current locale
 * ONLY when the URL already has a locale prefix (i.e. secondary locale).
 * Primary locale links stay clean (no prefix).
 */
export function useLocalePath() {
  const locale = useLocale();
  const pathname = usePathname();
  const hasPrefix = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );
  const prefix = hasPrefix ? `/${locale}` : '';

  return (path: string) => `${prefix}${path}`;
}
