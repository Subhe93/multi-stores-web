// Quantity bounds of a product page and a cart line (headless booking B2/B3).
//
// - `max_per_order` (Product, null = unlimited) caps the units of one own
//   product per order, summed across its variants and personalized lines;
//   custom-product lines never count (mirrors api `cart/max-per-order.ts`).
// - A product without variants that tracks inventory is bounded by its
//   `stock_quantity` (the same rule order creation enforces, see
//   `productAvailability`).
// - `?qty=N` on a product link pre-fills the quantity, clamped to the bounds.
//
// Pure helpers; products without a limit and without tracked stock get no
// bound at all, so their pages and carts behave exactly as before.

/** A positive integer limit, or null (unset / malformed = unlimited). */
export function readMaxPerOrder(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : null;
}

/**
 * Highest quantity a selector may offer: the smaller of stock and the
 * per-order limit (null/undefined = no bound from that side), rounded down to
 * a multiple of `step` (bundles). Null when neither bounds it.
 */
export function effectiveMax(
  stock: number | null | undefined,
  maxPerOrder: number | null | undefined,
  step = 1,
): number | null {
  const bounds = [stock, maxPerOrder].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  );
  if (bounds.length === 0) return null;
  const s = Number.isInteger(step) && step > 1 ? step : 1;
  const top = Math.max(0, Math.min(...bounds));
  return Math.floor(top / s) * s;
}

/** Stock fields of a product (variants decide stock when there are any). */
export interface SimpleStockInput {
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  variants?: readonly unknown[] | null;
  _type?: string;
}

/**
 * Stock of a product without variants that tracks inventory, or null when
 * stock does not bound it (variants, untracked, no number, custom product).
 */
export function simpleProductStock(p: SimpleStockInput): number | null {
  if (p._type === 'custom_product') return null;
  if ((p.variants?.length ?? 0) > 0) return null;
  if (!p.track_inventory) return null;
  return typeof p.stock_quantity === 'number' && Number.isFinite(p.stock_quantity) ? p.stock_quantity : null;
}

/** The cart line fields the per-order limit reads. */
export interface LimitLine {
  id: string;
  productId: string;
  customProductId?: string;
  quantity: number;
  maxPerOrder?: number;
}

/**
 * Highest quantity this cart line may take: its product's limit minus the
 * units of the same product on the other lines. Null when the line has no
 * limit (every line of a product without `max_per_order`).
 */
export function lineMaxQty(line: LimitLine, lines: readonly LimitLine[]): number | null {
  const max = readMaxPerOrder(line.maxPerOrder);
  if (max === null || line.customProductId) return null;
  const others = lines
    .filter((l) => l.id !== line.id && !l.customProductId && l.productId === line.productId)
    .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  return Math.max(0, max - others);
}

/** Units of `productId` on own-product lines (custom-product lines excluded). */
export function productUnitsInCart(productId: string, lines: readonly LimitLine[]): number {
  return lines
    .filter((l) => !l.customProductId && l.productId === productId)
    .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
}

/** Largest `?qty` read; anything above is treated as this (then clamped). */
const QTY_PARAM_CAP = 9999;

/**
 * The `qty` query parameter as a positive integer, or null when absent or
 * not a plain positive integer (`abc`, `0`, `-1`, `2.5`).
 */
export function readQtyParam(search: string | URLSearchParams | null | undefined): number | null {
  if (!search) return null;
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const raw = params.get('qty');
  if (raw === null) return null;
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return Math.min(n, QTY_PARAM_CAP);
}

/**
 * `n` clamped to `[min, max]` on multiples of `step`. A `max` below `min`
 * (sold out) yields `min`, the page default; the add button is blocked then.
 */
export function clampQty(n: number, { min = 1, step = 1, max }: { min?: number; step?: number; max?: number | null }): number {
  const s = Number.isInteger(step) && step > 1 ? step : 1;
  const lo = Number.isInteger(min) && min >= 1 ? min : 1;
  let v = Math.max(lo, Math.floor(n));
  if (typeof max === 'number' && Number.isFinite(max)) v = Math.min(v, max);
  v = Math.floor(v / s) * s;
  return v < lo ? lo : v;
}

export const CART_MAX_PER_ORDER = 'CART_MAX_PER_ORDER';

/** The API's `CART_MAX_PER_ORDER` error, raised locally for guest carts. */
export function maxPerOrderError(productId: string, max: number): Error & { code: string; status: number; params: { max: number; product_id: string } } {
  const err = new Error(`You can order at most ${max} of this product per order.`) as Error & {
    code: string;
    status: number;
    params: { max: number; product_id: string };
  };
  err.code = CART_MAX_PER_ORDER;
  err.status = 400;
  err.params = { max, product_id: productId };
  return err;
}

/**
 * Throws `CART_MAX_PER_ORDER` when adding `adding` units of an own product
 * would put more than `max` of it in the cart (guest carts; the API checks
 * signed-in carts). No limit = never throws.
 */
export function assertGuestAdd(
  productId: string,
  adding: number,
  max: number | null | undefined,
  lines: readonly LimitLine[],
  isCustomProduct = false,
): void {
  const limit = readMaxPerOrder(max);
  if (limit === null || isCustomProduct) return;
  if (productUnitsInCart(productId, lines) + adding > limit) throw maxPerOrderError(productId, limit);
}
