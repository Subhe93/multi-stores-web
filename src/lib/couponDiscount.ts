// Coupon discount shown in the cart, drawer and checkout (one formula).
//
// The order path (API orders.service) is authoritative: it validates the
// coupon against the base-currency subtotal and per-line totals, so a
// product-targeted coupon discounts only the targeted lines, a fixed amount
// never exceeds what it applies to and the discount never exceeds the
// subtotal. This helper mirrors that rule so every surface shows the amount
// the order will charge:
//   1. the server's `discount_amount` when it was computed for exactly the
//      current cart lines (`cartKey` match),
//   2. otherwise a live estimate: percentage of the base (targeted lines
//      only for a targeted coupon), fixed face value capped at the base.

import { availableLines, sumLineTotals } from '@/lib/cartAvailability';

/** Applied coupon as the cart keeps it (useCart + localStorage). */
export interface AppliedCoupon {
  code: string;
  /** Percentage value (type 'percentage') or fixed face value (type 'fixed'). */
  discount: number;
  type: 'percentage' | 'fixed';
  freeShipping?: boolean;
  /** Server discount for the cart lines identified by `cartKey`. */
  discountAmount?: number;
  /** Signature of the cart lines the server amount was computed for. */
  cartKey?: string;
  /** True when the coupon only applies to some products; undefined = unknown. */
  targeted?: boolean;
  /** Targeted product / custom product ids when the API sent them. */
  productIds?: string[];
  /**
   * In memory only: restored from the legacy shared `guest_coupon` key and
   * not yet validated for this store. Shows no discount until it is.
   */
  unverified?: boolean;
}

/** The fields of a cart line the discount depends on. */
export interface CouponLine {
  productId: string;
  customProductId?: string;
  /** Selected variant: its price adjustment moves the provider-cost floor. */
  variantId?: string;
  price: number;
  quantity: number;
  unavailableInMarket?: boolean;
}

/** One `line_totals` entry of POST /promotions/validate-coupon. */
export interface CouponLineTotal {
  product_id: string;
  amount: number;
  /** Units behind `amount` (the line may carry add-ons, so never estimated). */
  quantity: number;
  variant_id?: string;
}

/** Money is compared and shown in 2 decimals, like the API's rounding. */
export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The id the API matches targeted coupons against (custom product first). */
export function couponLineProductId(line: CouponLine): string {
  return line.customProductId || line.productId || '';
}

/**
 * `line_totals` for POST /promotions/validate-coupon (same shape as the order
 * path). Quantity and variant let the API judge the marketplace
 * provider-cost floor exactly like the order (per unit, per variant).
 */
export function couponLineTotals(lines: readonly CouponLine[]): CouponLineTotal[] {
  return availableLines(lines)
    .map((l): CouponLineTotal => ({
      product_id: couponLineProductId(l),
      amount: roundMoney2(l.price * l.quantity),
      quantity: Math.max(1, Math.round(l.quantity)),
      ...(l.variantId ? { variant_id: l.variantId } : {}),
    }))
    .filter((l) => l.product_id !== '');
}

/** Order-independent signature of the lines that affect the discount. */
export function couponCartKey(lines: readonly CouponLine[]): string {
  return availableLines(lines)
    .map((l) => `${couponLineProductId(l)}:${l.price}:${l.quantity}`)
    .sort()
    .join('|');
}

/**
 * Whether a coupon applies to a product: true for an untargeted coupon,
 * true / false when the targeted ids are known, null when unknown.
 */
export function couponAppliesToProduct(coupon: AppliedCoupon | null | undefined, productId: string): boolean | null {
  if (!coupon) return false;
  if (coupon.targeted === false) return true;
  if (coupon.productIds && coupon.productIds.length > 0) return coupon.productIds.includes(productId);
  if (coupon.targeted === true) return null;
  return true;
}

/** The discount the cart shows for `coupon` on `lines` (0 without a coupon). */
export function couponDiscount(coupon: AppliedCoupon | null | undefined, lines: readonly CouponLine[]): number {
  if (!coupon || coupon.unverified) return 0;
  const subtotal = sumLineTotals(lines);
  if (subtotal <= 0) return 0;

  // 1. The server's figure for exactly these lines.
  if (typeof coupon.discountAmount === 'number' && coupon.cartKey !== undefined && coupon.cartKey === couponCartKey(lines)) {
    return Math.max(0, Math.min(coupon.discountAmount, subtotal));
  }

  // 2. Live estimate. The base is the targeted lines for a targeted coupon.
  let base = subtotal;
  if (coupon.productIds && coupon.productIds.length > 0) {
    const ids = coupon.productIds;
    base = availableLines(lines)
      .filter((l) => ids.includes(couponLineProductId(l)))
      .reduce((sum, l) => sum + l.price * l.quantity, 0);
  } else if (coupon.targeted === true) {
    // Targeted lines unknown: the last server amount is the best estimate
    // until the cart is re-validated (never more than the subtotal).
    return typeof coupon.discountAmount === 'number' ? Math.max(0, Math.min(coupon.discountAmount, subtotal)) : 0;
  }
  if (base <= 0) return 0;
  const raw = coupon.type === 'percentage' ? base * (coupon.discount / 100) : Math.min(coupon.discount, base);
  return Math.max(0, Math.min(roundMoney2(raw), subtotal));
}

/**
 * Infers whether a coupon is product-targeted from a validation answer made
 * with `line_totals`: an untargeted coupon discounts the whole subtotal, so a
 * clearly smaller amount means only some lines count. A small tolerance
 * absorbs market-currency rounding.
 */
export function inferTargeted(
  kind: 'percentage' | 'fixed',
  value: number,
  discountAmount: number,
  subtotal: number,
): boolean {
  if (subtotal <= 0 || value <= 0) return false;
  const expected = kind === 'percentage' ? subtotal * (value / 100) : Math.min(value, subtotal);
  const tolerance = Math.max(0.05, expected * 0.01);
  return discountAmount < expected - tolerance;
}

/**
 * Coupon errors that depend on the cart (minimum amount / quantity, no
 * matching product, the marketplace provider-cost floor, which another item
 * or quantity can lift): the code stays pending and is retried after the cart
 * changes. `transient` = no answer about the code itself (rate limit,
 * server error, network drop, aborted request, a proxy's non-JSON error
 * page, an API that does not know a request field yet): kept, retried
 * later, nothing shown. Only a 4xx about the code (unknown, inactive,
 * expired, used up...) is `hard`.
 */
export const SOFT_COUPON_ERROR_CODES = [
  'PROMOTION_COUPON_MIN_AMOUNT',
  'PROMOTION_COUPON_MIN_QUANTITY',
  'PROMOTION_COUPON_NOT_APPLICABLE',
  'ORDER_DISCOUNT_BELOW_PROVIDER_COST',
  'PROMOTION_COUPON_BELOW_COST',
] as const;

// Older API builds send the minimum failures as a plain message (no code).
const LEGACY_MIN_MESSAGE = /^Minimum (order amount is|\d+ items required)/i;
// ValidationPipe (forbidNonWhitelisted) rejecting a field an older API build
// does not know yet (e.g. `line_totals`): says nothing about the code.
const UNKNOWN_FIELD_MESSAGE = /should not exist/i;

export type CouponErrorKind = 'soft' | 'transient' | 'hard';

export function classifyCouponError(err: unknown): CouponErrorKind {
  const e = (err ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : undefined;
  if (code && (SOFT_COUPON_ERROR_CODES as readonly string[]).includes(code)) return 'soft';
  if (!code && typeof e.message === 'string' && LEGACY_MIN_MESSAGE.test(e.message)) return 'soft';
  const status = typeof e.status === 'number' ? e.status : undefined;
  // No HTTP status: the request never got a readable answer (TypeError from
  // fetch, AbortError, SyntaxError from a non-JSON error page).
  if (status === undefined) return 'transient';
  if (status === 429 || status >= 500) return 'transient';
  if (!code && status === 400 && typeof e.message === 'string' && UNKNOWN_FIELD_MESSAGE.test(e.message)) return 'transient';
  return 'hard';
}

/** localStorage key of the applied coupon, per store (guests and customers). */
export function couponStorageKey(storeId: string | undefined): string {
  return `ms_coupon:${storeId || 'store'}`;
}

/** Parses a stored coupon; null for anything that is not a usable coupon. */
export function parseStoredCoupon(raw: string | null): AppliedCoupon | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<AppliedCoupon> | null;
    if (!c || typeof c !== 'object' || typeof c.code !== 'string' || c.code === '') return null;
    if (c.type !== 'percentage' && c.type !== 'fixed') return null;
    if (typeof c.discount !== 'number' || !Number.isFinite(c.discount)) return null;
    return c as AppliedCoupon;
  } catch {
    return null;
  }
}
