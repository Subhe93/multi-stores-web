// Availability reader of the card model. OWNER: builder W1.
//
// One rule for every listing surface, read from the list payload only:
// - a product with variants is sold out when no active variant has stock,
//   and has a count when every active variant is tracked and the total is
//   small enough to show;
// - a product without variants is read from track_inventory / stock_quantity;
// - anything untracked or unknown yields null, and the card shows nothing.
// The platform has no backorder flag (lib/productQuantity.ts), so there is
// no "sold out but orderable" case to exclude.

import type { CardSourceRow, CardStock, CardVariantRow } from './model';
import { LOW_STOCK_CAP } from './settings';

/** The API sends 999 for a variant whose stock is not tracked. */
const UNTRACKED = 999;

function isActive(v: CardVariantRow): boolean {
  return v.is_active !== false;
}

function countOf(total: number): number | null {
  return Number.isInteger(total) && total >= 1 && total <= LOW_STOCK_CAP ? total : null;
}

/**
 * Stock of a product row as a card may show it; null when stock is not
 * tracked or cannot be known. See PRODUCT-CARD-CONTRACT.md, "Availability".
 */
export function cardStock(row: CardSourceRow): CardStock | null {
  const variants = Array.isArray(row.variants) ? row.variants : [];

  if (variants.length > 0) {
    const active = variants.filter(isActive);
    // A stock that is not a number is unknown: say nothing about the product.
    if (active.some((v) => typeof v.stock !== 'number' || !Number.isFinite(v.stock))) return null;
    const stocks = active.map((v) => v.stock as number);
    if (!stocks.some((s) => s > 0)) return { soldOut: true, count: null };
    if (stocks.some((s) => s >= UNTRACKED)) return { soldOut: false, count: null };
    const total = stocks.reduce((sum, s) => sum + Math.max(0, s), 0);
    return { soldOut: false, count: countOf(total) };
  }

  if (row.track_inventory !== true) return null;
  const qty = row.stock_quantity;
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return null;
  if (qty <= 0) return { soldOut: true, count: null };
  return { soldOut: false, count: countOf(qty) };
}
