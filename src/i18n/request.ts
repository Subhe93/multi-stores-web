import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isStoreLocale } from './config';
import { loadMessages } from './loadMessages';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Fallback for store pages (not under [locale] segment):
  // read locale from cookie/header set by middleware
  // Store-only locales (e.g. 'ku') load too; the [locale] platform layout
  // still answers 404 for a code outside the platform list.
  if (!locale || !isStoreLocale(locale)) {
    try {
      const { cookies, headers } = await import('next/headers');
      const cookieStore = await cookies();
      const reqHeaders = await headers();
      locale =
        cookieStore.get('x-store-locale')?.value ||
        reqHeaders.get('x-locale') ||
        '';
      // A store page without a locale prefix is the store's primary locale:
      // its UI strings (buttons, labels, tax suffix) must follow it too, not
      // fall back to English. The store lookup is the same cached fetch the
      // page itself makes.
      if (!locale) {
        const storeSlug = reqHeaders.get('x-store-slug');
        if (storeSlug) {
          try {
            const { storefront } = await import('@/lib/api');
            // Market stores pass their key so the payload's language_config
            // is the market's (M1-DESIGN D3); other stores send no key.
            const store = (await storefront.getStore(storeSlug, reqHeaders.get('x-market') || undefined)) as {
              language_config?: { primary_locale?: string } | null;
            } | null;
            locale = store?.language_config?.primary_locale || '';
          } catch {
            locale = '';
          }
        }
      }
      locale = locale || defaultLocale;
    } catch {
      locale = defaultLocale;
    }
  }

  if (!isStoreLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
