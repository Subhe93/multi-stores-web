// Product URL paths shared by the product page, the store sitemap (M161 A/B1)
// and every product link of the storefront (M163). The page and the sitemap
// build `pathByLocale` with the same function from the same data, so the
// sitemap alternates equal the in-page alternates for every product × market.
// Product links (sections, listing grids, JSON-LD, creative picks) pick their
// slug with `productLinkSlug`, which follows the same fallback chain as the
// canonical, so an internal link is the canonical URL of the page it opens.

import { buildStoreAlternates, buildStoreOrigin } from './storeUrl';
import { isUsableSlug } from './slugRoute';
import type { MarketRoute } from './market';

export interface ProductSlugTranslation {
  locale?: string | null;
  slug?: string | null;
}

/**
 * Translated product sub-path per locale (`/products/<slug>`). Rows without a
 * locale or a usable slug (`isUsableSlug`: a degenerate `-` resolves to a 404)
 * are skipped. Locales no market advertises are harmless:
 * `buildStoreAlternates` only reads the locales of advertised slots.
 */
export function productPathByLocale(translations: readonly ProductSlugTranslation[] | null | undefined): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const tr of translations ?? []) {
    if (tr.locale && isUsableSlug(tr.slug)) paths[tr.locale] = `/products/${tr.slug}`;
  }
  return paths;
}

/**
 * Locale whose slug a product link falls back to when the rendered locale has
 * no usable slug: the market default locale, else the store primary locale.
 * The same chain as the canonical fallback of `productAlternates`.
 */
export function productLinkFallbackLocale(
  primaryLocale: string | null | undefined,
  market?: Pick<MarketRoute, 'default_locale'> | null,
): string {
  return market?.default_locale || primaryLocale || 'en';
}

/**
 * Slug of the canonical product URL for `locale`:
 *  1. the usable slug of `locale`;
 *  2. the usable slug of `fallbackLocale` (market default / primary);
 *  3. the first usable slug in API order (the page is then self-canonical);
 * null when no row has a usable slug (callers fall back to the product id).
 */
export function productLinkSlug(
  translations: readonly ProductSlugTranslation[] | null | undefined,
  locale: string,
  fallbackLocale: string,
): string | null {
  const rows = translations ?? [];
  const own = rows.find((tr) => tr.locale === locale && isUsableSlug(tr.slug));
  if (own?.slug) return own.slug;
  const fallback = rows.find((tr) => tr.locale === fallbackLocale && isUsableSlug(tr.slug));
  if (fallback?.slug) return fallback.slug;
  const first = rows.find((tr) => isUsableSlug(tr.slug));
  return first?.slug ?? null;
}

/** `/products/<slug>` (no locale prefix) of `productLinkSlug`, or `/products/<id>`. */
export function productLinkPath(
  translations: readonly ProductSlugTranslation[] | null | undefined,
  opts: { locale: string; fallbackLocale: string; id: string },
): string {
  return `/products/${productLinkSlug(translations, opts.locale, opts.fallbackLocale) || opts.id}`;
}

/** The sitemap payload's `slugs` record (locale → slug) in the same list form. */
export function slugRecordToTranslations(slugs: Record<string, string> | null | undefined): ProductSlugTranslation[] {
  return Object.entries(slugs ?? {}).map(([locale, slug]) => ({ locale, slug }));
}

/** The slice of the storefront store payload the product alternates need. */
export interface ProductAlternatesStore {
  custom_domain?: string | null;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  market?: MarketRoute | null;
  markets?: MarketRoute[];
}

/**
 * The `alternates` block of a product page: canonical + hreflang. The product
 * JSON-LD (url, offers.url, breadcrumb) uses the same canonical, so the three
 * never disagree. `slug` is the stored slug the request matched; with a
 * market the canonical takes the rendered locale's translated slug.
 */
export function productAlternates(opts: {
  storeSlug: string;
  store: ProductAlternatesStore | null | undefined;
  translations: readonly ProductSlugTranslation[] | null | undefined;
  slug: string;
  locale: string;
  pathPrefix?: string;
  noindex?: boolean;
}): { canonical: string; languages: Record<string, string> } {
  const store = opts.store;
  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const pathByLocale = store?.market ? productPathByLocale(opts.translations) : null;
  // With a market, a locale without its own translated slug falls back to
  // the market's primary-locale slug, exactly like the sitemap (whose `slug`
  // is that one), so the fallback never depends on the slug requested.
  // Without a market the requested (stored) slug stays the path.
  const fallbackPath =
    (pathByLocale && (pathByLocale[store?.market?.default_locale || primaryLocale] ?? pathByLocale[primaryLocale])) ||
    `/products/${opts.slug}`;
  return buildStoreAlternates({
    pathPrefix: opts.pathPrefix,
    origin: buildStoreOrigin(opts.storeSlug, store?.custom_domain || null, store?.market),
    locale: opts.locale,
    primaryLocale,
    secondaryLocales: store?.language_config?.secondary_locales || [],
    path: fallbackPath,
    markets: store?.markets,
    market: store?.market,
    noindex: opts.noindex,
    storeCustomDomain: store?.custom_domain ?? null,
    storeSlug: opts.storeSlug,
    pathByLocale,
  });
}
