import type { MarketRoute } from '@/lib/market';

// Live markets of namez-se (2026-11-21), shared by the M155 region tests.
export const NAMEZ_SE: MarketRoute = {
  key: 'default', name: 'namez', default_locale: 'sv', locales: ['en', 'ar'], countries: ['SE'], currency: 'SEK',
  is_default: true, primary_hostname: 'namez.se', status: 'LIVE',
};
export const NAMEZ_EU: MarketRoute = {
  key: 'eu', name: 'Europe', default_locale: 'en', locales: ['de', 'fr', 'ar'],
  countries: ['DE', 'FI', 'AT', 'NL', 'BE', 'FR', 'ES', 'IT', 'IE', 'PT'], currency: 'EUR',
  is_default: false, primary_hostname: 'namez.shop', status: 'LIVE',
};
export const NAMEZ_MARKETS: MarketRoute[] = [NAMEZ_SE, NAMEZ_EU];
