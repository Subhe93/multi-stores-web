import { defaultLocale, locales } from '@/i18n/config';

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

/**
 * `alternates` for a PLATFORM (marketing) page: canonical pointing at the page
 * in its own locale, plus hreflang for every locale we serve and an x-default
 * on the default one.
 *
 * Paths stay relative — the root layout's metadataBase turns them absolute,
 * which is exactly what was missing before (a relative canonical with no base
 * resolves against Next's localhost default).
 */
export function buildPlatformAlternates(
  path: string,
  locale: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = localePath(path, l);
  }
  languages['x-default'] = localePath(path, defaultLocale);

  const selfLocale = (locales as readonly string[]).includes(locale)
    ? locale
    : defaultLocale;
  return { canonical: localePath(path, selfLocale), languages };
}
