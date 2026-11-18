// Creative engine: shared constants and value sanitizers. Pure module (its
// only import is the locale list), safe on the server, in the proxy and in
// every engine chunk.

import { locales } from '@/i18n/config';

/** Section keys added by the creative engine (registered in the minimal theme). */
export const CREATIVE_SECTION_KEYS = [
  'hero-outline',
  'hero-sunrise',
  'stage-scenes',
  'story-pinned',
  'sticky-steps',
  'motion-path',
  'marquee-band',
  'ornament-line',
] as const;
export type CreativeSectionKey = (typeof CREATIVE_SECTION_KEYS)[number];

/**
 * Sizes of every decorative word, numeral, marquee text and travelling
 * artwork. Owner decision: no large or giant value exists.
 */
export const ACCENT_SIZES = ['sm', 'md'] as const;
export type AccentSize = (typeof ACCENT_SIZES)[number];

/** The stored size as a known value; anything else (lg, xl, junk) reads as 'md'. */
export function accentSize(raw: unknown): AccentSize {
  return raw === 'sm' ? 'sm' : 'md';
}

/** Existing sections that read heading_reveal / heading_emphasis from settings. */
export const HEADING_OPTION_SECTIONS = [
  'hero-banner',
  'hero-split',
  'parallax-banner',
  'image-with-text',
  'brand-band',
] as const;

/** Existing sections that read image_reveal / image_reveal_direction from settings. */
export const IMAGE_REVEAL_SECTIONS = ['hero-split', 'image-with-text', 'single-image'] as const;

export function headingRevealValue(raw: unknown): 'none' | 'lines' {
  return raw === 'lines' ? 'lines' : 'none';
}

export function imageRevealValue(raw: unknown): 'none' | 'mask' {
  return raw === 'mask' ? 'mask' : 'none';
}

export function imageRevealDirection(raw: unknown): 'up' | 'start' | 'end' {
  return raw === 'start' || raw === 'end' ? raw : 'up';
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
/** Never magnetic: buy controls, forms, the store chrome and dialogs. */
export const MAGNETIC_EXCLUDE =
  '[data-section-key^="product"], [data-section-key="add-to-cart"], form, header, footer, [role="dialog"]';
