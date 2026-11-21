import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';
import type { LinkScope } from '@/lib/localePaths';

/** Visible keyboard focus ring for links and buttons of a section. */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Href of an owner-entered link inside a section: internal paths get the
 * link prefix of the request (a secondary locale's `/<locale>`, or on a
 * locale-path market the visited `/de-at`), external links stay untouched
 * and an empty value gives '#'. Sections pass `{ locale, primaryLocale,
 * pathPrefix }` from their props.
 */
export function sectionHref(raw: unknown, scope: LinkScope): string {
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) return '#';
  return localizeStoreUrl(url, storeLocalePrefix(scope), scope.locale);
}
