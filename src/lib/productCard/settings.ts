// Product card settings of a store: `theme_customizations.product.card`.
// The object is opt-in: absent (or not a plain object) means the classic
// card everywhere and no `card=1` on any product request. Present (even
// empty) means the enhanced card with the defaults below.
//
// Pure module (no React, no server-only import): read by server routes,
// client sections and tests alike. The dashboard mirrors these value sets.

export const CARD_STYLES = ['classic', 'editorial'] as const;
export const CARD_ASPECTS = ['square', 'portrait', 'landscape'] as const;
export const CARD_CORNERS = ['theme', 'square'] as const;
export const CARD_AVAILABILITY = ['off', 'sold_out', 'sold_out_and_low'] as const;
export const CARD_BADGES = ['percent', 'sale', 'none'] as const;

export type CardStyle = (typeof CARD_STYLES)[number];
export type CardAspect = (typeof CARD_ASPECTS)[number];
export type CardCorners = (typeof CARD_CORNERS)[number];
export type CardAvailability = (typeof CARD_AVAILABILITY)[number];
export type CardBadge = (typeof CARD_BADGES)[number];

/**
 * Highest "Only N left" number a card may show. Equal to the API's cache
 * rule LOW_STOCK_DISPLAY_THRESHOLD (orders/stock-visibility.ts): above it a
 * stock change does not revalidate the store, so the number would be stale.
 * Do not raise it without changing that rule.
 */
export const LOW_STOCK_CAP = 10;
export const LOW_STOCK_DEFAULT = 3;

/** The object as stored (every key optional). */
export interface ProductCardStored {
  style?: CardStyle;
  aspect?: CardAspect;
  corners?: CardCorners;
  hover_image?: boolean;
  swatches?: boolean;
  sizes_line?: boolean;
  availability?: CardAvailability;
  low_stock_threshold?: number;
  badge?: CardBadge;
  quick_add?: boolean;
}

/** The settings with every default applied. */
export interface ProductCardSettings {
  style: CardStyle;
  aspect: CardAspect;
  corners: CardCorners;
  hover_image: boolean;
  swatches: boolean;
  sizes_line: boolean;
  availability: CardAvailability;
  /** 1..LOW_STOCK_CAP. */
  low_stock_threshold: number;
  badge: CardBadge;
  quick_add: boolean;
}

function oneOf<T extends string>(set: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Resolve a stored `card` object. Unknown values fall back to the default. */
export function resolveProductCard(stored: unknown): ProductCardSettings | null {
  if (!isRecord(stored)) return null;
  const style = oneOf(CARD_STYLES, stored.style, 'classic');
  const editorial = style === 'editorial';
  const n = Number(stored.low_stock_threshold);
  const threshold = Number.isInteger(n) ? Math.min(LOW_STOCK_CAP, Math.max(1, n)) : LOW_STOCK_DEFAULT;
  return {
    style,
    aspect: oneOf(CARD_ASPECTS, stored.aspect, editorial ? 'portrait' : 'square'),
    corners: oneOf(CARD_CORNERS, stored.corners, editorial ? 'square' : 'theme'),
    hover_image: stored.hover_image === true,
    swatches: stored.swatches === true,
    sizes_line: stored.sizes_line === true,
    availability: oneOf(CARD_AVAILABILITY, stored.availability, 'off'),
    low_stock_threshold: threshold,
    badge: oneOf(CARD_BADGES, stored.badge, 'percent'),
    quick_add: stored.quick_add === true,
  };
}

/**
 * The store's card settings from its `theme_customizations` (any shape), or
 * null when the store did not opt in.
 */
export function readProductCard(customizations: unknown): ProductCardSettings | null {
  if (!isRecord(customizations) || !isRecord(customizations.product)) return null;
  return resolveProductCard(customizations.product.card);
}

/**
 * Query parameters a product list request gains for the enhanced card:
 * `{ card: '1' }` with settings, `{}` without (the request stays as today).
 * Spread it LAST into the params object so the default URL does not move.
 */
export function cardQuery(settings: ProductCardSettings | null | undefined): { card?: '1' } {
  return settings ? { card: '1' } : {};
}

/** Tailwind aspect class of the `aspect` setting (callers with their own aspect keep theirs). */
export function cardAspectClass(aspect: CardAspect): string {
  return aspect === 'portrait' ? 'aspect-[4/5]' : aspect === 'landscape' ? 'aspect-[4/3]' : 'aspect-square';
}
