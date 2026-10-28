// JSON-LD for builder pages (home, STATIC and LANDING). Product and collection
// routes describe themselves (Product / CollectionPage + BreadcrumbList) and
// the store layout emits Organization + WebSite, but a landing page such as
// /present-till-pappa carried nothing: crawlers saw an anonymous page with no
// position in the site. Pure helpers, no fetching, so the routes can call them
// with data already in scope.

import { buildBreadcrumb } from './jsonld';
import { COLLECTION_PRODUCTS_SECTION_KEY } from './preloadSections';
import { storeLocalePath } from './storeUrl';

/** The slice of a section a page needs to classify itself. */
export interface PageSectionLite {
  section_key: string;
  is_hidden?: boolean;
}

/**
 * True when the page renders a product list, i.e. has a visible
 * collection-products section — the same visibility rule `preloadSectionData`
 * uses, so the markup never claims a list the page does not show.
 */
export function pageListsProducts(sections: PageSectionLite[] | null | undefined): boolean {
  return (sections ?? []).some((s) => !s.is_hidden && s.section_key === COLLECTION_PRODUCTS_SECTION_KEY);
}

/** `noindex` anywhere in the robots directive (e.g. `noindex, nofollow`). */
export function isNoindexRobots(robots: string | null | undefined): boolean {
  return /\bnoindex\b/i.test(robots ?? '');
}

/**
 * The `isPartOf` reference to the site-wide WebSite node emitted by the store
 * layout. That node has no `@id`, so the reference carries the same `url` and
 * `name`, which is how consumers reconcile the two.
 */
function webSiteRef(origin: string, siteName?: string) {
  return {
    '@type': 'WebSite',
    url: origin,
    ...(siteName ? { name: siteName } : {}),
  };
}

export interface LandingJsonLdInput {
  /** Store origin from `buildStoreOrigin` (no trailing slash). */
  origin: string;
  /** Sub-path of the page, e.g. `/present-till-pappa`. */
  path: string;
  locale: string;
  primaryLocale: string;
  /** Page title (h1 / meta title). */
  name: string;
  /** Meta description, when the creator wrote one. */
  description?: string | null;
  /** A creator-supplied canonical overrides the locale URL, as in metadata. */
  canonical?: string | null;
  /** Store name, for the WebSite reference. */
  siteName?: string;
  /** Localised "Home" label for the breadcrumb root. */
  homeLabel: string;
  /** Page sections: a visible product list upgrades WebPage to CollectionPage. */
  sections?: PageSectionLite[] | null;
  /** The page's robots directive: a noindex page emits nothing. */
  robots?: string | null;
}

/**
 * WebPage (or CollectionPage when the page lists products) + BreadcrumbList
 * Home → page for a STATIC / LANDING builder page. Returns null for a noindex
 * page so structured data never advertises a page the creator hid.
 */
export function buildLandingJsonLd(input: LandingJsonLdInput): {
  page: Record<string, unknown>;
  breadcrumb: ReturnType<typeof buildBreadcrumb>;
} | null {
  if (isNoindexRobots(input.robots)) return null;

  const pageUrl = input.canonical || storeLocalePath(input.origin, input.locale, input.primaryLocale, input.path);
  const description = input.description?.trim();

  const page: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': pageListsProducts(input.sections) ? 'CollectionPage' : 'WebPage',
    name: input.name,
    ...(description ? { description } : {}),
    url: pageUrl,
    inLanguage: input.locale,
    isPartOf: webSiteRef(input.origin, input.siteName),
  };

  const breadcrumb = buildBreadcrumb([
    { name: input.homeLabel, url: storeLocalePath(input.origin, input.locale, input.primaryLocale, '') },
    { name: input.name, url: pageUrl },
  ]);

  return { page, breadcrumb };
}

export interface HomeJsonLdInput {
  /** Store origin from `buildStoreOrigin`; the home URL in the primary locale. */
  origin: string;
  locale: string;
  primaryLocale: string;
  /** Store (or published home) name. */
  name: string;
  /** Store description or the home's meta description, tags stripped. */
  description?: string | null;
  /** A creator-supplied canonical overrides the locale URL, as in metadata. */
  canonical?: string | null;
  /** The home's robots directive: a noindex home emits nothing. */
  robots?: string | null;
}

/**
 * WebPage for the storefront home. Organization and WebSite already come from
 * the layout, so this only adds the page node and points `isPartOf` at that
 * WebSite. The url is the origin itself for the primary locale and the
 * `/{locale}` form otherwise.
 */
export function buildHomeJsonLd(input: HomeJsonLdInput): Record<string, unknown> | null {
  if (isNoindexRobots(input.robots)) return null;
  const description = input.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    ...(description ? { description } : {}),
    url: input.canonical || storeLocalePath(input.origin, input.locale, input.primaryLocale, ''),
    inLanguage: input.locale,
    isPartOf: webSiteRef(input.origin, input.name),
  };
}
