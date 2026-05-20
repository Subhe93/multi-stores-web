// Locale display metadata — a flag (ISO country for flagcdn) plus the language
// name written in its own language. Used by the storefront locale switchers so
// languages render with a flag and a human name instead of a bare code.
//
// Flags come from flagcdn.com as SVGs: emoji flags don't render on Windows
// (they fall back to the two-letter code), so a small image source keeps the
// switcher looking right on every platform.

interface LocaleMeta {
  cc: string; // ISO 3166-1 alpha-2 country code used to build the flag URL
  label: string; // language name in its own language
}

const LOCALE_META: Record<string, LocaleMeta> = {
  en: { cc: 'gb', label: 'English' },
  ar: { cc: 'sa', label: 'العربية' },
  fr: { cc: 'fr', label: 'Français' },
  de: { cc: 'de', label: 'Deutsch' },
  es: { cc: 'es', label: 'Español' },
  it: { cc: 'it', label: 'Italiano' },
  pt: { cc: 'pt', label: 'Português' },
  nl: { cc: 'nl', label: 'Nederlands' },
  tr: { cc: 'tr', label: 'Türkçe' },
  ru: { cc: 'ru', label: 'Русский' },
  pl: { cc: 'pl', label: 'Polski' },
  sv: { cc: 'se', label: 'Svenska' },
  da: { cc: 'dk', label: 'Dansk' },
  no: { cc: 'no', label: 'Norsk' },
  fi: { cc: 'fi', label: 'Suomi' },
  zh: { cc: 'cn', label: '中文' },
  ja: { cc: 'jp', label: '日本語' },
  ko: { cc: 'kr', label: '한국어' },
  hi: { cc: 'in', label: 'हिन्दी' },
  fa: { cc: 'ir', label: 'فارسی' },
  ur: { cc: 'pk', label: 'اردو' },
  he: { cc: 'il', label: 'עברית' },
  id: { cc: 'id', label: 'Bahasa Indonesia' },
  th: { cc: 'th', label: 'ไทย' },
  vi: { cc: 'vn', label: 'Tiếng Việt' },
  uk: { cc: 'ua', label: 'Українська' },
  el: { cc: 'gr', label: 'Ελληνικά' },
  cs: { cc: 'cz', label: 'Čeština' },
  ro: { cc: 'ro', label: 'Română' },
  hu: { cc: 'hu', label: 'Magyar' },
};

export interface ResolvedLocale {
  code: string;
  label: string;
  /** Flag image URL, or '' when the locale has no known country mapping. */
  flagUrl: string;
}

/**
 * Resolve a locale code (e.g. 'en', 'ar', 'pt-BR') to its flag + native label.
 * Region variants fall back to the base language's flag/label; unknown locales
 * fall back to the upper-cased code with no flag.
 */
export function resolveLocaleMeta(locale: string): ResolvedLocale {
  const lower = locale.toLowerCase();
  const base = lower.split('-')[0];
  const meta = LOCALE_META[lower] || LOCALE_META[base];
  return {
    code: locale,
    label: meta?.label || locale.toUpperCase(),
    flagUrl: meta ? `https://flagcdn.com/${meta.cc}.svg` : '',
  };
}
