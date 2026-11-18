// Facet answer of GET /storefront/:slug/products?facets=1 (paged mode).
// Mirrors `FacetsAnswer` of the API's product-list-facets.ts.

export interface FacetValue {
  /** Facet key (what the URL and the API carry). */
  value: string;
  label: string;
  /** Products with this value under the other active filters. */
  count: number;
}

export interface ListingFacets {
  collection: Array<FacetValue & { parent: string | null }>;
  type: FacetValue[];
  color: Array<FacetValue & { swatch?: string; swatch2?: string }>;
  size: FacetValue[];
  price: { min: number; max: number } | null;
  in_stock: { count: number };
}

/** Normalise an unknown `facets` value (an older API sends none). */
export function toListingFacets(raw: unknown): ListingFacets | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<ListingFacets>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const price =
    f.price && typeof f.price.min === 'number' && typeof f.price.max === 'number'
      ? { min: f.price.min, max: f.price.max }
      : null;
  return {
    collection: arr(f.collection),
    type: arr(f.type),
    color: arr(f.color),
    size: arr(f.size),
    price,
    in_stock: { count: typeof f.in_stock?.count === 'number' ? f.in_stock.count : 0 },
  };
}
