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
        defaultLocale;
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
