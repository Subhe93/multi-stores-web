import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';

/** Visible keyboard focus ring for links and buttons of a section. */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Href of an owner-entered link inside a section: internal paths get the
 * locale prefix of a secondary locale, external links stay untouched and an
 * empty value gives '#'.
 */
export function sectionHref(raw: unknown, locale: string, primaryLocale: string): string {
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) return '#';
  return localizeStoreUrl(url, storeLocalePrefix(locale, primaryLocale), locale);
}
