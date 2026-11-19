// Storefront locale rules shared by the proxy, the store layouts, the
// switchers, hreflang and the sitemap. Pure and client-safe (no
// next/headers), so the edge proxy, server components and vitest import it.
//
// Two lists from i18n/config drive everything here:
// - `storeLocales`: every locale a store can enable. A superset of the
//   platform `locales`; the extra codes ('ku') are store-only.
// - `reviewLocales`: locales whose texts wait for a native speaker's review.
//   A store that enables one serves it under its URL prefix, but it is left
//   out of the language switchers, hreflang and sitemaps, and its pages are
//   noindex. Removing the code from `reviewLocales` makes it public.

import { isReviewLocale, locales, storeLocales } from '@/i18n/config';
import { intlLocale, type IntlKind } from './intlLocale';

export { isReviewLocale };

/**
 * The locale to hand to Intl at a storefront call site. A locale with a fixed
 * Intl mapping ('ku' -> 'de' numbers / 'en-GB' dates, see intlLocale) is
 * mapped; every other value (the six platform locales, '', undefined) is
 * returned exactly as given, so their output is unchanged.
 */
export function formatLocale<T extends string | null | undefined>(
  locale: T,
  kind: IntlKind = 'number',
): T | string {
  if (!locale) return locale;
  const mapped = intlLocale(locale, kind);
  return mapped === locale.trim() ? locale : mapped;
}

/** True for a storefront locale that the platform pages do not serve ('ku'). */
export function isStoreOnlyLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  return (
    (storeLocales as readonly string[]).includes(locale) &&
    !(locales as readonly string[]).includes(locale)
  );
}

/** The storefront locale prefix of a public path (`/ku/cart` -> 'ku'), or null. */
export function matchStoreLocalePrefix(
  pathname: string,
  list: readonly string[] = storeLocales,
): string | null {
  return list.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? null;
}

/** `list` without the locales in review (order kept). */
export function publicLocales(list: readonly string[]): string[] {
  return list.filter((l) => !isReviewLocale(l));
}

/**
 * The secondary locales a language switcher lists: non-empty, different from
 * the primary, and without the locales in review (order and any duplicate
 * kept, so a store without a review locale gets exactly its list). A review
 * locale stays in the list only while it is the one being rendered, so a
 * reviewer on `/ku/` sees it selected and can switch back (the switchers also
 * use the list to strip the current prefix from the browser path).
 */
export function switcherLocales(
  primaryLocale: string | null | undefined,
  secondaryLocales: readonly (string | null | undefined)[] | null | undefined,
  currentLocale?: string | null,
): string[] {
  const out: string[] = [];
  for (const l of secondaryLocales ?? []) {
    if (!l || l === primaryLocale) continue;
    if (isReviewLocale(l) && l !== currentLocale) continue;
    out.push(l);
  }
  return out;
}

/** The language fields of the storefront payload the gate reads. */
export interface StoreLanguageFields {
  language_config?: { primary_locale?: string | null; secondary_locales?: string[] | null } | null;
  market?: { default_locale?: string | null; locales?: string[] | null } | null;
}

/** True when the store (or its request market) has enabled `locale`. */
export function storeServesLocale(store: StoreLanguageFields | null | undefined, locale: string): boolean {
  const cfg = store?.language_config;
  if (cfg?.primary_locale === locale) return true;
  if ((cfg?.secondary_locales ?? []).includes(locale)) return true;
  const market = store?.market;
  if (market?.default_locale === locale) return true;
  return (market?.locales ?? []).includes(locale);
}

/**
 * True when the request must answer 404: its URL locale is store-only (the
 * proxy accepts the prefix for every store) and this store has not enabled
 * it. The six platform locales never gate here, so a store without 'ku'
 * behaves exactly as before.
 */
export function isLocaleNotServed(
  urlLocale: string | null | undefined,
  store: StoreLanguageFields | null | undefined,
): boolean {
  if (!urlLocale || !isStoreOnlyLocale(urlLocale)) return false;
  return !storeServesLocale(store, urlLocale);
}
