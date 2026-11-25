// Open Graph block of every storefront route (M161 C). Next merges metadata
// per top-level key, so each route sets its whole `openGraph` object; this
// helper makes them consistent: og:url = the canonical, og:locale from the
// request, and an image fallback (the route's own image, else the store logo).

import { marketUrlSlots, type PathMarket } from './localePaths';

// Language defaults when neither the URL slot nor the market fixes a country.
// `ar_AR` is Facebook's own code for Arabic.
const LANGUAGE_DEFAULTS: Record<string, string> = {
  en: 'en_US',
  sv: 'sv_SE',
  de: 'de_DE',
  fr: 'fr_FR',
  tr: 'tr_TR',
  ar: 'ar_AR',
  nb: 'nb_NO',
  da: 'da_DK',
  fi: 'fi_FI',
  nl: 'nl_NL',
  es: 'es_ES',
  it: 'it_IT',
};

const baseLanguage = (locale: string) => locale.split(/[-_]/)[0]!.toLowerCase();

/**
 * Country of the request's language-country path slot (`/de-at` → 'AT'), else
 * the single country of a one-country market, else null. Stores without the
 * markets app always get null.
 */
export function requestCountry(
  market: Partial<PathMarket> | null | undefined,
  pathPrefix: string | undefined,
): string | null {
  if (!market) return null;
  if (pathPrefix && typeof market.default_locale === 'string' && Array.isArray(market.locales)) {
    const slot = marketUrlSlots(market as PathMarket).find((s) => s.prefix === pathPrefix);
    if (slot?.country) return slot.country.toUpperCase();
  }
  const countries = market.countries ?? [];
  return countries.length === 1 && countries[0] ? countries[0].toUpperCase() : null;
}

/**
 * `og:locale` (`ll_CC`): the language with the request country when there is
 * one, else the language default. A language outside the table without a
 * country gives undefined (no tag).
 */
export function ogLocale(locale: string | null | undefined, country: string | null | undefined): string | undefined {
  if (!locale) return undefined;
  const lang = baseLanguage(locale);
  if (!/^[a-z]{2,3}$/.test(lang)) return undefined;
  if (country && /^[A-Za-z]{2}$/.test(country)) return `${lang}_${country.toUpperCase()}`;
  return LANGUAGE_DEFAULTS[lang];
}

/** The universal fallback image: the store logo, absolute. */
export function ogFallbackImage(
  store: { logo_url?: string | null } | null | undefined,
  resolve: (url: string) => string,
): string | undefined {
  return store?.logo_url ? resolve(store.logo_url) : undefined;
}

export interface StoreOpenGraphInput {
  title?: string | null;
  description?: string | null;
  /** The page canonical (`alternates.canonical`). */
  url?: string | null;
  /** The route's own image, already absolute. */
  image?: string | null;
  /** Used when `image` is missing (the store logo, absolute). */
  fallbackImage?: string | null;
  /**
   * M170 A: alt text of the route's own `image` (`og:image:alt`). Ignored
   * when the fallback image is used (a product alt never describes the logo).
   */
  imageAlt?: string | null;
  locale?: string | null;
  country?: string | null;
}

/** An image with its alt text (`og:image` + `og:image:alt`). */
export interface StoreOpenGraphImage {
  url: string;
  alt: string;
}

export interface StoreOpenGraph<Image = string> {
  type: 'website';
  title?: string;
  description?: string;
  url?: string;
  images?: Image[];
  locale?: string;
}

/** URL of an `images` entry (a bare URL, or the object form with an alt). */
export function ogImageUrl(entry: string | StoreOpenGraphImage | null | undefined): string | undefined {
  if (!entry) return undefined;
  return typeof entry === 'string' ? entry : entry.url;
}

// Routes that pass an `imageAlt` may get the object form; every other route
// keeps the plain `string[]` type (and output) it always had.
export function buildStoreOpenGraph(
  input: StoreOpenGraphInput & { imageAlt: string | null | undefined },
): StoreOpenGraph<string | StoreOpenGraphImage>;
export function buildStoreOpenGraph(input: StoreOpenGraphInput): StoreOpenGraph;
export function buildStoreOpenGraph(input: StoreOpenGraphInput): StoreOpenGraph<string | StoreOpenGraphImage> {
  const image = input.image || input.fallbackImage || undefined;
  const alt = input.image ? (input.imageAlt || '').trim() : '';
  const locale = ogLocale(input.locale, input.country);
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.url ? { url: input.url } : {}),
    ...(image ? { images: [alt ? { url: image, alt } : image] } : {}),
    ...(locale ? { locale } : {}),
    type: 'website',
  };
}
