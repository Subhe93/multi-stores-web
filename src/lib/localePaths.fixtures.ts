// Test fixtures of M156 (language-country URL paths), shared by the specs.
// The Namez target config of M156-LANG-COUNTRY-URLS-DESIGN.md §2.3: the nl
// rows are stored but inactive (nl is not a storefront locale yet).

import type { MarketLocalePath, MarketRoute } from './market';

export const NAMEZ_EU_PATHS: MarketLocalePath[] = [
  { path: 'de-de', locale: 'de', country: 'DE', hreflang: ['de-DE', 'de'] },
  { path: 'de-at', locale: 'de', country: 'AT', hreflang: ['de-AT'] },
  { path: 'fr-fr', locale: 'fr', country: 'FR', hreflang: ['fr-FR', 'fr'] },
  { path: 'fr-be', locale: 'fr', country: 'BE', hreflang: ['fr-BE'] },
  { path: 'nl-nl', locale: 'nl', country: 'NL', hreflang: ['nl-NL', 'nl'] },
  { path: 'nl-be', locale: 'nl', country: 'BE', hreflang: ['nl-BE'] },
  { path: 'ar', locale: 'ar', country: null, hreflang: ['ar'] },
];

/** namez.se: the default market, no locale paths. */
export const NAMEZ_SE: MarketRoute = {
  key: 'default',
  name: 'Sverige',
  default_locale: 'sv',
  locales: ['en', 'ar'],
  countries: ['SE'],
  currency: 'SEK',
  is_default: true,
  primary_hostname: 'namez.se',
  status: 'LIVE',
};

/** namez.shop with the M156 config (x-default market, like the consultant's table). */
export const NAMEZ_EU: MarketRoute = {
  key: 'eu',
  name: 'Europe',
  default_locale: 'en',
  locales: ['de', 'fr', 'ar'],
  countries: ['DE', 'FI', 'AT', 'NL', 'BE', 'FR', 'ES', 'IT', 'IE', 'PT'],
  currency: 'EUR',
  is_default: false,
  primary_hostname: 'namez.shop',
  status: 'LIVE',
  is_x_default: true,
  locale_paths: NAMEZ_EU_PATHS,
};

/** The same eu market as today (no locale paths): the regression fixture. */
export const NAMEZ_EU_LEGACY: MarketRoute = (() => {
  const { locale_paths: _paths, ...rest } = NAMEZ_EU;
  void _paths;
  return rest;
})();
