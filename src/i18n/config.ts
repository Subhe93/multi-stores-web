// Platform (marketing, auth, legal) UI locales: the `[locale]` routes, the
// platform language menu, the platform sitemap and its hreflang.
export const locales = ['en', 'ar', 'tr', 'de', 'fr', 'sv'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Storefront locales: everything a store can enable (mirror of the API's
// SUPPORTED_LOCALES in markets/market.types.ts). A superset of `locales`;
// 'ku' is Kurdish, Kurmanji (Latin script, left to right). The platform pages
// are not served in the store-only locales.
export const storeLocales = [...locales, 'ku'] as const;
export type StoreLocale = (typeof storeLocales)[number];

// Locales in review (mirror of the API's REVIEW_LOCALES): a store that
// enables one serves it under its URL prefix, but it stays out of the
// language switcher, hreflang, sitemaps and search indexing until a native
// speaker has reviewed the texts. Removing a code here makes it public.
export const reviewLocales: readonly StoreLocale[] = ['ku'];

export function isStoreLocale(locale: string | null | undefined): locale is StoreLocale {
  return (storeLocales as readonly string[]).includes(locale ?? '');
}

export function isReviewLocale(locale: string | null | undefined): boolean {
  return (reviewLocales as readonly string[]).includes(locale ?? '');
}

export const rtlLocales: Locale[] = ['ar'];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
