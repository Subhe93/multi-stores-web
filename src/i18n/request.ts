import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Fallback for store pages (not under [locale] segment):
  // read locale from cookie/header set by middleware
  if (!locale || !(locales as readonly string[]).includes(locale)) {
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
            const store = (await storefront.getStore(storeSlug)) as {
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

  if (!(locales as readonly string[]).includes(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
