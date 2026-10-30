// Schema.org availability of a storefront product, by the same rule checkout
// enforces: a product with (active) variants is out of stock only when every
// variant has a tracked stock of 0 or less (the storefront API serves an
// untracked variant stock as 999); a product without variants only when it
// tracks inventory and its stock number is 0 or less (a missing number is
// unlimited).

export interface AvailabilityInput {
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  variants?: { stock?: number | null }[] | null;
}

export function productAvailability(p: AvailabilityInput): 'InStock' | 'OutOfStock' {
  const variants = p.variants ?? [];
  if (variants.length > 0) {
    return variants.some((v) => (v.stock ?? 1) > 0) ? 'InStock' : 'OutOfStock';
  }
  if (p.track_inventory && p.stock_quantity != null && p.stock_quantity <= 0) {
    return 'OutOfStock';
  }
  return 'InStock';
}
