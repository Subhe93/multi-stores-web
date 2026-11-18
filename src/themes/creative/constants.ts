// Creative engine: shared constants and value sanitizers. Pure module (its
// only import is the locale list), safe on the server, in the proxy and in
// every engine chunk.

import { locales } from '@/i18n/config';

/** Section keys added by the motion engine (registered in the minimal theme). */
export const CREATIVE_SECTION_KEYS = [
  'ornament-line',
  'cover-hero',
  'look-spread',
  'object-study',
  'script-manifesto',
  'impact-arc',
  'pattern-band',
] as const;
export type CreativeSectionKey = (typeof CREATIVE_SECTION_KEYS)[number];

/**
 * Sizes of every decorative element (the hero emblem). Owner decision: no
 * large or giant value exists.
 */
export const ACCENT_SIZES = ['sm', 'md'] as const;
export type AccentSize = (typeof ACCENT_SIZES)[number];

/** The stored size as a known value; anything else (lg, xl, junk) reads as 'md'. */
export function accentSize(raw: unknown): AccentSize {
  return raw === 'sm' ? 'sm' : 'md';
}

/**
 * First route segments under the store layout that are commerce pages: the
 * store-level runtime (smooth scrolling, magnetic buttons, curtain) never
 * runs there. Everything else (home, page slugs) is a brand page.
 */
export const COMMERCE_SEGMENTS = [
  'products',
  'collections',
  'cart',
  'checkout',
  '(checkout)',
  'account',
  'auth',
  'legal',
  'market-not-found',
] as const;

/** Product lists and product pages: light, fast motion; smooth scrolling stays on. */
export const SHOP_SEGMENTS = ['products', 'collections'] as const;

export type RouteScope = 'brand' | 'shop' | 'flow';

/**
 * Motion scope of a route under the store layout. brand = home and content
 * pages (everything), shop = product lists and product pages (light and
 * fast), flow = cart, checkout, account, sign-in, legal (entrance and
 * feedback only; no smooth scrolling, no curtain, no magnetic pull).
 */
export function routeScope(segment: string | null): RouteScope {
  if (isBrandSegment(segment)) return 'brand';
  return (SHOP_SEGMENTS as readonly string[]).includes(segment as string) ? 'shop' : 'flow';
}

/** `null` (home) and page slugs are brand pages. */
export function isBrandSegment(segment: string | null): boolean {
  if (segment === null || segment === '') return true;
  return !(COMMERCE_SEGMENTS as readonly string[]).includes(segment);
}

/**
 * Same test for a URL path (curtain destinations). Drops the internal
 * `/store/<slug>` prefix and one leading locale, then tests the first segment.
 */
export function isBrandPath(pathname: string): boolean {
  const parts = pathname.split(/[?#]/)[0].split('/').filter(Boolean);
  if (parts[0] === 'store' && parts.length >= 2) parts.splice(0, 2);
  if (parts.length && (locales as readonly string[]).includes(parts[0])) parts.shift();
  return isBrandSegment(parts.length ? parts[0] : null);
}

/** Buttons that take the magnetic pull (set by PillButton). */
export const MAGNETIC_SELECTOR = '[data-cx-magnetic]';
/** Dialogs, drawers and the mobile menu: page-level effects stay out of them. */
export const OVERLAY_SELECTOR = '[role="dialog"], [aria-modal="true"], .store-overlay';
/**
 * Never magnetic: buy controls (product blocks, every fast-tier surface,
 * links to the cart and the checkout, submit buttons), form controls, the
 * store chrome and everything inside a drawer or dialog.
 */
export const MAGNETIC_EXCLUDE =
  '[data-section-key^="product"], [data-section-key="add-to-cart"], [data-cx-tier="fast"], ' +
  'form, label, input, select, textarea, [type="submit"], [contenteditable], ' +
  'a[href*="/cart"], a[href*="/checkout"], header, footer, ' +
  OVERLAY_SELECTOR;
