// ── Focused storefront (`checkout_settings.external_focus`) ──────────────────
// A store with its own website (headless booking P3, `external_site_url`) can
// turn the storefront into a purchase step of that site: the buyer arrives on
// a product page, adds to the cart, pays and goes back. In this mode
//   - the header is logo + "back to site" + cart, the footer is legal links
//     only (`FocusedHeader` / `FocusedFooter`, chosen in the store layout);
//   - the browsing pages (home, collections, product listing, content pages)
//     redirect to the external site (`focusRedirectTarget`);
//   - the product page drops every link into a listing, and "add to cart"
//     leads to the cart page (`afterAddDestination`).
//
// `focusedStorefront()` is THE gate: every server and client check goes
// through it, so a store without the flag (or without a valid site) never
// takes any focused branch. Pure helpers only (no `next/*` imports): shared
// by server components, client components and the unit tests.

import type { AfterAddToCart, CheckoutSettings } from './checkoutSettings';
import { COOKIE_POLICY_SLUGS } from './consent';
import { externalSiteHost, externalSiteHosts, externalSiteUrl } from './externalReturn';

type FocusSettings = Pick<
  CheckoutSettings,
  'external_site_url' | 'return_url' | 'return_mode' | 'back_label' | 'external_focus'
>;

export interface FocusedStorefront {
  /** The validated external site URL (redirect target, logo and back link). */
  siteUrl: string;
  /** Host shown to the shopper ("Back to example.se"), without `www.`. */
  siteHost: string;
}

/** Lower-case host name of a `Host` header value (port and trailing dot dropped). */
export function normalizeRequestHost(host: string | null | undefined): string | null {
  const h = (host ?? '').trim().toLowerCase().split(':')[0]!.replace(/\.$/, '');
  return h || null;
}

/**
 * The focused storefront of a store, or null (the normal storefront). Needs
 * the flag AND a valid external site. With `requestHost` the mode is also
 * off when the external site is the very host being served (or its `www.`
 * twin): the API refuses such a site, this is the loop guard behind it.
 */
export function focusedStorefront(
  settings: FocusSettings | null | undefined,
  requestHost?: string | null,
): FocusedStorefront | null {
  if (settings?.external_focus !== true) return null;
  const siteUrl = externalSiteUrl(settings);
  const siteHost = externalSiteHost(settings);
  if (!siteUrl || !siteHost) return null;
  const host = normalizeRequestHost(requestHost);
  if (host && externalSiteHosts(siteUrl).includes(host)) return null;
  return { siteUrl, siteHost };
}

/**
 * The settings as the storefront of `requestHost` uses them: the focus flag
 * is dropped when the mode is not in force on this host, so the client tree
 * (which never sees the request host) agrees with the server.
 */
export function resolveFocusForHost<T extends CheckoutSettings>(settings: T, requestHost: string | null | undefined): T {
  if (settings.external_focus !== true || focusedStorefront(settings, requestHost)) return settings;
  const rest = { ...settings };
  delete rest.external_focus;
  return rest;
}

/**
 * Where "add to cart" leads. Focused storefront: the cart page (the cart is
 * a step: several products in one order) unless the store explicitly chose
 * `checkout`. Otherwise the stored setting, unchanged.
 */
export function afterAddDestination(
  settings: (FocusSettings & Pick<CheckoutSettings, 'after_add_to_cart'>) | null | undefined,
): AfterAddToCart {
  const stored = settings?.after_add_to_cart ?? 'stay';
  if (!focusedStorefront(settings)) return stored;
  return stored === 'checkout' ? 'checkout' : 'cart';
}

// ── Redirects ────────────────────────────────────────────────────────────────

/** What a store path is, for the focused storefront. */
export type FocusRouteKind =
  /** Store home page. */
  | 'home'
  /** `/collections` and every collection page. */
  | 'collections'
  /** The `/products` listing (not a product page). */
  | 'product-listing'
  /** A builder / static content page at the store root (`/{pageSlug}`). */
  | 'content-page'
  /** Everything that is never redirected. */
  | 'keep';

// First path segments that are never a content page. `products` is handled
// separately (the listing redirects, a product page does not).
const KEPT_SEGMENTS = new Set([
  'cart',
  'checkout',
  'account',
  'auth',
  'legal',
  'p',
  'market-not-found',
  'api',
  '_next',
  'builder-preview',
  'fonts-cdn',
  'store',
]);

// Same keywords as the store footer's legal-page heuristic, plus the cookie
// page: a content page whose slug carries one of them is never redirected.
// English and Swedish words: a policy page that is not registered as a legal
// page must still not leave the store.
const LEGAL_SLUG_KEYWORDS = ['privacy', 'terms', 'return', 'refund', 'shipping', 'cookie', 'integritet', 'villkor', 'angerratt', 'retur', 'leverans', 'kakor'];

/** Classifies a locale-free store path (`/`, `/collections/a/b`, `/om-oss`). */
export function focusRouteKind(path: string): FocusRouteKind {
  const clean = (path.split(/[?#]/, 1)[0] ?? '').replace(/\/+$/, '');
  const segments = clean.split('/').filter(Boolean).map((s) => s.toLowerCase());
  if (segments.length === 0) return 'home';
  const [first] = segments as [string, ...string[]];
  if (first === 'collections') return 'collections';
  if (first === 'products') return segments.length === 1 ? 'product-listing' : 'keep';
  if (KEPT_SEGMENTS.has(first)) return 'keep';
  // robots.txt, sitemap.xml and every other file-like path.
  if (segments[segments.length - 1]!.includes('.')) return 'keep';
  // Unknown nested routes are left alone: only what is known is redirected.
  return segments.length === 1 ? 'content-page' : 'keep';
}

/**
 * True for a content page that must stay reachable in the focused storefront:
 * the cookie page, a page that serves a legal slug, or a page whose slug
 * looks like a policy page. `keepSlugs` are the slugs the store payload names
 * (`cookie_page_slug`, the `page_slug` of the legal list).
 */
export function isProtectedPageSlug(slug: string, keepSlugs: ReadonlyArray<string | null | undefined> = []): boolean {
  const s = slug.trim().toLowerCase();
  if (!s) return true;
  if (COOKIE_POLICY_SLUGS.includes(s)) return true;
  if (keepSlugs.some((k) => typeof k === 'string' && k.trim().toLowerCase() === s)) return true;
  return LEGAL_SLUG_KEYWORDS.some((kw) => s.includes(kw));
}

export interface FocusRedirectInput {
  /** Normalized `checkout` block of the store payload. */
  settings: FocusSettings | null | undefined;
  /** Locale-free store path of the request (`/`, `/collections/x`, `/om-oss`). */
  path: string;
  /** `Host` header of the request (loop guard). */
  requestHost?: string | null;
  /** Publication gate: a store that is not LIVE shows its gate page instead. */
  gate?: 'live' | 'coming_soon' | 'paused';
  /** The owner's preview (preview token in force): never redirected. */
  ownerPreview?: boolean;
  /** Content-page slugs the store payload marks as legal / cookie pages. */
  keepSlugs?: ReadonlyArray<string | null | undefined>;
}

/**
 * The external URL a request is redirected to (307), or null to render the
 * page. Only a LIVE store in focused mode redirects, only its browsing pages,
 * never for the owner's preview and never towards the host being served.
 */
export function focusRedirectTarget(input: FocusRedirectInput): string | null {
  const focus = focusedStorefront(input.settings, input.requestHost);
  if (!focus) return null;
  if (input.gate && input.gate !== 'live') return null;
  if (input.ownerPreview) return null;
  const kind = focusRouteKind(input.path);
  if (kind === 'keep') return null;
  if (kind === 'content-page') {
    const slug = input.path.split(/[?#]/, 1)[0]!.split('/').filter(Boolean)[0] ?? '';
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      // A malformed escape: compared as is.
    }
    if (isProtectedPageSlug(decoded, input.keepSlugs)) return null;
  }
  return focus.siteUrl;
}

// ── Product page / sitemap ───────────────────────────────────────────────────

// Sections that list other products or collections. On a focused product
// page they are a path back into the (redirected) catalogue.
const LISTING_SECTION_KEYS = new Set(['featured-products', 'product-slider', 'collection-products', 'product-listing']);

/**
 * The sections of a PRODUCT_TEMPLATE a focused storefront renders: product
 * listing sections ("related products", "more from this store") are left
 * out. Other sections are returned untouched, in the same order.
 */
export function focusedProductSections<T extends { section_key: string }>(sections: T[]): T[] {
  return sections.filter((s) => !LISTING_SECTION_KEYS.has(s.section_key));
}

interface SitemapShape {
  home: unknown;
  static_pages: unknown[];
  landing_pages: unknown[];
  collections?: unknown[];
  legal_pages?: unknown[];
}

/**
 * Sitemap data of a focused storefront: product pages only. Every URL that
 * redirects to the external site (home, content pages, collections) is
 * dropped; the caller also leaves out the `/products` listing entry.
 */
export function focusedSitemapData<T extends SitemapShape>(data: T): T {
  return { ...data, home: null, static_pages: [], landing_pages: [], collections: [], legal_pages: [] };
}
