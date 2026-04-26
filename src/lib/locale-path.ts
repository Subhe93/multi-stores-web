import { defaultLocale } from '@/i18n/config';

/**
 * Returns the correct path prefix for a given locale.
 * Default locale (en) has no prefix, others get /<locale> prefix.
 */
export function localePath(path: string, locale: string): string {
  if (locale === defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}
