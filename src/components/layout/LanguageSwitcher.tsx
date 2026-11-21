'use client';

import { localePathSwitchTarget, switchableLocales } from '@/lib/localePaths';
import { useMarket, usePreferredCountry } from '@/hooks/useMarket';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  ar: 'ع',
  tr: 'TR',
  fr: 'FR',
  de: 'DE',
  sv: 'SV',
};

interface LanguageSwitcherProps {
  primaryLocale?: string;
  availableLocales: string[];
  primaryColor?: string;
  /** Active locale resolved by the server (avoids usePathname hydration issues with rewrites) */
  activeLang?: string;
}

export function LanguageSwitcher({ primaryLocale = 'en', availableLocales, primaryColor, activeLang }: LanguageSwitcherProps) {
  const market = useMarket();
  const preferredCountry = usePreferredCountry();
  if (availableLocales.length === 0) return null;

  const allLocales = [primaryLocale, ...availableLocales.filter(l => l !== primaryLocale)];

  // Use server-resolved locale when available; otherwise detect from browser URL
  const activeLocale = activeLang ?? primaryLocale;
  // M156: on a locale-path market a language that only exists under another
  // country's path is not offered (it would change the visitor's country).
  const shownLocales = switchableLocales(market, allLocales, preferredCountry, activeLocale);

  const switchTo = (locale: string) => {
    // Read the real browser pathname (not the rewritten one from usePathname)
    const browserPath = window.location.pathname;
    // M156: a locale-path market (`/de-at/`) maps the language to its path
    // for the visitor's country; every other store keeps the code below.
    const mapped = localePathSwitchTarget(market, browserPath, locale, preferredCountry, allLocales);
    if (mapped !== null) {
      window.location.assign(mapped);
      return;
    }

    // Strip existing locale prefix from the browser path
    const currentLocalePrefix = allLocales.find(
      l => browserPath.startsWith(`/${l}/`) || browserPath === `/${l}`
    );
    const cleanPath = currentLocalePrefix
      ? browserPath.slice(`/${currentLocalePrefix}`.length) || '/'
      : browserPath;

    let target: string;
    if (locale === primaryLocale) {
      target = cleanPath;
    } else {
      const rest = cleanPath === '/' ? '' : cleanPath;
      target = `/${locale}${rest}`;
    }
    // Hard navigation to ensure middleware runs and server components re-render
    window.location.assign(target);
  };

  return (
    <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
      {shownLocales.map((locale) => {
        const isActive = activeLocale === locale;
        return (
          <button
            key={locale}
            onClick={() => switchTo(locale)}
            className="px-2.5 py-1 font-medium transition-colors"
            style={
              isActive
                ? { backgroundColor: primaryColor || '#2563eb', color: 'white' }
                : { color: '#6b7280' }
            }
          >
            {LOCALE_LABELS[locale] || locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
