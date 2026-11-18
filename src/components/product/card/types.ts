// Props shared by the enhanced product card and its parts. OWNER: lead
// (contract file: plans/newroj/PRODUCT-CARD-CONTRACT.md). Builders import
// from here; a change to this file goes through the lead.

import type { ComponentProps } from 'react';
import type { ProductCard } from '@/components/product/ProductCard';
import type { CardExtras, CardSizes, CardSwatches } from '@/lib/productCard/model';
import type { ProductCardSettings } from '@/lib/productCard/settings';
import type { MotionAttrs } from '@/themes/creative/recipes';

/** The classic ProductCard props, unchanged. */
export type ClassicCardProps = ComponentProps<typeof ProductCard>;

/** What a call site adds to the classic props for the enhanced card. */
export interface CardAdditions {
  /** Card model of the product (`cardExtrasOf` / `withCardExtras`). */
  card?: CardExtras | null;
  productId?: string;
  /** Slug the product page answers to (quick add reads the product with it). */
  productSlug?: string;
  /**
   * Motion attributes for the card root, for callers that compute their own
   * (sections: `item(cards, 0)`). Unset: derived from `motion` / `arriving`
   * exactly as the classic card does.
   */
  entrance?: MotionAttrs;
}

/** Props of the dispatcher (`StoreProductCard`). */
export type StoreProductCardProps = ClassicCardProps & CardAdditions;

/** Props of `ProductCardEnhanced`. */
export type EnhancedCardProps = ClassicCardProps &
  CardAdditions & {
    settings: ProductCardSettings;
  };

export interface CardSwatchListProps {
  swatches: CardSwatches;
}

export interface CardSizeLineProps {
  sizes: CardSizes;
}

export interface QuickAddButtonProps {
  productSlug: string;
  productId?: string;
  title: string;
  /** Product page URL (the fallback for products that cannot be quick-added). */
  href: string;
  card?: CardExtras | null;
  currency?: string;
}
