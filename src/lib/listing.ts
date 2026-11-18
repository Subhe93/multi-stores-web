// Projection helpers for the builder's `product-listing` section. The
// storefront product payload carries every translation (full HTML
// descriptions), variants and category rows; the listing section only needs
// card-level fields, so routes trim products before handing them to the
// client component — otherwise the whole catalogue would be serialised into
// the page's RSC payload.

import type { ListingProduct } from '@/themes/types';
import { promotionsForProduct } from '@/lib/requiresShipping';

interface PromotionRow {
  type?: string;
  value?: unknown;
  translations?: Array<{ title?: string }>;
}

/** The subset of a storefront product payload that the listing projection reads. */
export interface StorefrontProductRow {
  id: string;
  base_price: number | string;
  compare_at_price?: number | string | null;
  created_at?: string;
  translations?: Array<{ locale: string; title?: string; slug?: string }>;
  images?: Array<{ url?: string }>;
  promotions?: PromotionRow[];
  vendor?: { company_name?: string | null } | null;
  /** False = service / digital product (read through `lib/requiresShipping`). */
  requires_shipping?: boolean | null;
  /** b2b app only: estimated tax rate for the company net view. */
  tax_rate_bp?: number | null;
}

export function toListingProduct(p: StorefrontProductRow): ListingProduct {
  // The card badge shows the first promotion; a product without shipping
  // never advertises free shipping (same rule as the product page).
  const promo = promotionsForProduct(p, p.promotions)[0];
  return {
    id: p.id,
    base_price: Number(p.base_price),
    compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : undefined,
    created_at: p.created_at,
    translations: (p.translations || []).map((tr) => ({
      locale: tr.locale,
      title: tr.title,
      slug: tr.slug,
    })),
    images: p.images?.[0]?.url ? [{ url: p.images[0].url }] : [],
    promotions: promo
      ? [{ type: promo.type, value: promo.value, translations: [{ title: promo.translations?.[0]?.title }] }]
      : undefined,
    vendor: p.vendor?.company_name ? { company_name: p.vendor.company_name } : undefined,
  };
}

/**
 * Card projection of the server-paginated listings: `toListingProduct` plus
 * the b2b `tax_rate_bp`, so a card shows the same net price as the built-in
 * grid. Used only in server mode; the legacy template projection is
 * unchanged.
 */
export function toListingCard(p: StorefrontProductRow): ListingProduct {
  return { ...toListingProduct(p), tax_rate_bp: p.tax_rate_bp ?? undefined };
}
