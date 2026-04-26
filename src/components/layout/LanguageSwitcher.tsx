'use client';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  ar: 'ع',
  tr: 'TR',
  fr: 'FR',
  de: 'DE',
};

interface LanguageSwitcherProps {
  primaryLocale?: string;
  availableLocales: string[];
  primaryColor?: string;
  /** Active locale resolved by the server (avoids usePathname hydration issues with rewrites) */
  activeLang?: string;
}

export function LanguageSwitcher({ primaryLocale = 'en', availableLocales, primaryColor, activeLang }: LanguageSwitcherProps) {
  if (availableLocales.length === 0) return null;

  const allLocales = [primaryLocale, ...availableLocales.filter(l => l !== primaryLocale)];

  // Use server-resolved locale when available; otherwise detect from browser URL
  const activeLocale = activeLang ?? primaryLocale;

  const switchTo = (locale: string) => {
    // Read the real browser pathname (not the rewritten one from usePathname)
    const browserPath = window.location.pathname;

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
    window.location.href = target;
  };

  return (
    <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
      {allLocales.map((locale) => {
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
