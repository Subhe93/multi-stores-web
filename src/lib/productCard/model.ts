// Card model of the enhanced product card: what a card needs beyond the
// classic fields, computed once per product row and independent of the
// store's card settings (so a setting toggles without a refetch).
//
// `toCardExtras` reads a storefront product row (list payload, with or
// without `card=1`; a missing field simply yields null) and is safe on the
// server and in the browser. The three readers it combines live in their
// own modules: stock.ts, options.ts.

import type { ListingProduct } from '@/themes/types';
import { labelsForLocale, type LabelRow, type VariantOptionLabels } from '@/lib/variantOptionLabels';
import { cardSizes, cardSwatches } from './options';
import { cardStock } from './stock';

/** A variant as the list payload carries it (own and imported products). */
export interface CardVariantRow {
  id?: string;
  options?: Record<string, string> | null;
  /** 999 = the API's "untracked" sentinel. */
  stock?: number | null;
  is_active?: boolean | null;
}

/** The fields of a storefront product row the card model reads. */
export interface CardSourceRow {
  id: string;
  images?: Array<{ url?: string | null }> | null;
  variants?: CardVariantRow[] | null;
  /** Option display config (array or keyed object, as the product page reads it). */
  variant_option_config?: unknown;
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  [extra: string]: unknown;
}

export interface CardSwatch {
  /** Option value as stored ("Sand"); also the accessible name. */
  value: string;
  /** M159: the value in the page language when it has a label (else absent). */
  label?: string;
  /** CSS colour of the dot. */
  css?: string;
  /** Second colour of a two-colour value. */
  css2?: string;
  /** Raw image URL of an image swatch (resolve with resolveMediaUrl). */
  image?: string;
}

export interface CardSwatches {
  /** At most CARD_SWATCH_MAX; empty when no value resolves to a colour or image. */
  items: CardSwatch[];
  /** Values beyond `items` ("+N"). */
  more: number;
  /** All colour values of the product (the "N colours" fallback). */
  total: number;
}

export interface CardSizes {
  /** At most CARD_SIZE_MAX, in the seller's order. */
  /** `label`: M159, the value in the page language when it has one. */
  items: Array<{ value: string; available: boolean; label?: string }>;
  more: number;
}

/**
 * Stock as a card may show it. null = untracked or unknown: show nothing.
 * `count` is set only for 1..LOW_STOCK_CAP (settings.ts); the card compares
 * it with the store's threshold.
 */
export interface CardStock {
  soldOut: boolean;
  count: number | null;
}

export interface CardExtras {
  /** Raw URL of the second image (hover), or null. */
  second_image: string | null;
  swatches: CardSwatches | null;
  sizes: CardSizes | null;
  stock: CardStock | null;
  /** The product has selectable variants (quick add opens the picker). */
  has_variants: boolean;
}

export const CARD_SWATCH_MAX = 5;
export const CARD_SIZE_MAX = 8;

/**
 * M159: option display labels of a list row in `locale` (its translation
 * rows carry them); null without a locale or labels.
 */
export function cardOptionLabels(row: CardSourceRow, locale?: string | null): VariantOptionLabels | null {
  if (!locale) return null;
  // A custom product's own translations never hold labels: they live on the
  // base product (`option_label_translations` on list rows, or a nested
  // `product.translations` when a payload carries the base product).
  const product = row.product as { translations?: unknown } | null | undefined;
  for (const raw of [row.translations, row.option_label_translations, product?.translations]) {
    const labels = Array.isArray(raw) ? labelsForLocale(raw as LabelRow[], locale) : null;
    if (labels) return labels;
  }
  return null;
}

/** `locale` (M159): swatch / size names in that language when labelled. */
export function toCardExtras(row: CardSourceRow, locale?: string | null): CardExtras {
  const second = row.images?.[1]?.url;
  const labels = cardOptionLabels(row, locale);
  return {
    second_image: typeof second === 'string' && second ? second : null,
    swatches: cardSwatches(row, labels),
    sizes: cardSizes(row, labels),
    stock: cardStock(row),
    has_variants: (row.variants?.length ?? 0) > 0,
  };
}

/**
 * A listing projection (`toListingProduct` / `toListingCard`) with the card
 * model attached under `card`. Use only when the store has card settings;
 * without them the projection must stay exactly as today.
 */
export function withCardExtras<T extends ListingProduct>(projected: T, row: CardSourceRow, locale?: string | null): T {
  return { ...projected, card: toCardExtras(row, locale) };
}

/** The card model of a product: the attached one, else computed from the row itself. */
export function cardExtrasOf(product: ListingProduct | CardSourceRow, locale?: string | null): CardExtras {
  const attached = (product as ListingProduct).card;
  return attached ?? toCardExtras(product as CardSourceRow, locale);
}
