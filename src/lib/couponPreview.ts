// Product-page coupon banner: data model, cache and display rules.
//
// POST /promotions/coupon-preview answers "what does coupon X do for this
// product line, given the cart it will join". The answer has static fields
// (kind, percent, fixed amount, free shipping, whether the product is
// targeted, the minimums) and dynamic ones (min_met, discount_amount) that
// depend on the line and cart figures. Static fields are cached per
// (store, market, code, product) in sessionStorage so the banner can render
// at once on the next product view; the dynamic ones are re-queried when the
// line or cart changes, with linear math from the last server answer in the
// meantime. The order path stays authoritative: the banner only ever shows
// the server's amount or a proportional estimate of it.

import { roundMoney2 } from '@/lib/couponDiscount';

/** POST /promotions/coupon-preview response (API `CouponPreview`). */
export interface CouponPreview {
  code: string;
  /** null only for a FREE_SHIPPING promotion. */
  discount_kind: 'percentage' | 'fixed' | null;
  percent: number | null;
  /** Fixed face value in the market currency. */
  amount: number | null;
  free_shipping: boolean;
  /** False when the coupon targets other products, or (with `below_cost`) cannot be used on it. */
  applies: boolean;
  /**
   * Marketplace provider-cost floor: the discounted price would fall below
   * what the provider is owed, so the order would reject the coupon. Sent
   * with `applies: false`; absent from older API answers (= false).
   */
  below_cost?: boolean;
  /** Market currency; null without a positive minimum. */
  min_amount: number | null;
  min_quantity: number | null;
  /** True without minimums; null when a needed figure was not sent. */
  min_met: boolean | null;
  /** Server discount on `line_amount` (market currency), when computable. */
  discount_amount: number | null;
}

/** The fields that do not depend on the line / cart figures. */
export type CouponPreviewStatic = Omit<CouponPreview, 'min_met' | 'discount_amount'>;

/** The figures a preview is asked for (all amounts in the market currency). */
export interface CouponPreviewInput {
  storeId: string;
  marketKey?: string;
  marketPreview?: boolean;
  code: string;
  productId: string;
  lineAmount: number;
  cartSubtotal: number;
  itemCount: number;
  /** Units behind `lineAmount` and the selected variant (provider-cost floor). */
  quantity?: number;
  variantId?: string | null;
}

/** The last server answer for one (code, product): the figures it was for. */
export interface CouponPreviewAnswer {
  sig: string;
  lineAmount: number;
  minMet: boolean | null;
  discountAmount: number | null;
}

/** Request body for POST /promotions/coupon-preview. */
export function couponPreviewBody(input: CouponPreviewInput): Record<string, unknown> {
  return {
    coupon_code: input.code,
    store_id: input.storeId,
    product_id: input.productId,
    ...(input.marketKey ? { market: input.marketKey, ...(input.marketPreview ? { preview: true } : {}) } : {}),
    line_amount: roundMoney2(Math.max(0, input.lineAmount)),
    cart_subtotal: roundMoney2(Math.max(0, input.cartSubtotal)),
    item_count: Math.max(0, Math.round(input.itemCount)),
    // The line may carry add-ons or a variant price: the API judges the
    // provider-cost floor on these instead of guessing them from the amount.
    ...(typeof input.quantity === 'number' && input.quantity >= 1 ? { quantity: Math.round(input.quantity) } : {}),
    ...(input.variantId ? { variant_id: input.variantId } : {}),
  };
}

/** Identifies the static fields: one coupon on one product in one market. */
export function couponPreviewKey(storeId: string, marketKey: string | undefined, code: string, productId: string): string {
  return `ms_coupon_preview:${storeId}:${marketKey || ''}:${code}:${productId}`;
}

/** Identifies one request (static key + the dynamic figures). */
export function couponPreviewSig(input: CouponPreviewInput): string {
  const b = couponPreviewBody(input);
  return `${couponPreviewKey(input.storeId, input.marketKey, input.code, input.productId)}|${input.marketPreview ? 1 : 0}|${b.line_amount}|${b.cart_subtotal}|${b.item_count}|${b.quantity ?? ''}|${b.variant_id ?? ''}`;
}

export function staticOf(p: CouponPreview): CouponPreviewStatic {
  return {
    code: p.code,
    discount_kind: p.discount_kind,
    percent: p.percent,
    amount: p.amount,
    free_shipping: p.free_shipping,
    applies: p.applies,
    ...(p.below_cost === true ? { below_cost: true } : {}),
    min_amount: p.min_amount,
    min_quantity: p.min_quantity,
  };
}

function sessionStore(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

/** Validates a cached / received static block; null for anything else. */
export function parsePreviewStatic(raw: unknown): CouponPreviewStatic | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.code !== 'string' || s.code === '') return null;
  if (s.discount_kind !== 'percentage' && s.discount_kind !== 'fixed' && s.discount_kind !== null) return null;
  if (!isNumOrNull(s.percent) || !isNumOrNull(s.amount) || !isNumOrNull(s.min_amount) || !isNumOrNull(s.min_quantity)) return null;
  if (typeof s.free_shipping !== 'boolean' || typeof s.applies !== 'boolean') return null;
  if (s.below_cost !== undefined && s.below_cost !== null && typeof s.below_cost !== 'boolean') return null;
  if (s.discount_kind === 'percentage' && !isNum(s.percent)) return null;
  if (s.discount_kind === 'fixed' && !isNum(s.amount)) return null;
  return {
    code: s.code,
    discount_kind: s.discount_kind,
    percent: s.percent,
    amount: s.amount,
    free_shipping: s.free_shipping,
    applies: s.applies,
    ...(s.below_cost === true ? { below_cost: true } : {}),
    min_amount: s.min_amount,
    min_quantity: s.min_quantity,
  };
}

export function readPreviewCache(key: string): CouponPreviewStatic | null {
  try {
    const raw = sessionStore()?.getItem(key);
    return raw ? parsePreviewStatic(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePreviewCache(key: string, value: CouponPreviewStatic | null): void {
  try {
    const store = sessionStore();
    if (!store) return;
    if (value) store.setItem(key, JSON.stringify(value));
    else store.removeItem(key);
  } catch {
    // Storage full / blocked: the banner just re-queries next time.
  }
}

/**
 * What a failed preview means for the banner: `invalid` = the code cannot be
 * used at all (the next candidate code is tried), `error` = rate limit,
 * network, market or anything else (nothing is shown, never a guessed price).
 */
export function classifyPreviewError(err: unknown): 'invalid' | 'error' {
  const e = (err ?? {}) as { code?: unknown; status?: unknown };
  return e.code === 'PROMOTION_COUPON_INVALID' ? 'invalid' : 'error';
}

/** What the banner shows. Money is in the market currency, gross. */
export type CouponBannerView =
  | { kind: 'none' }
  /** Muted note: the code targets other products. */
  | { kind: 'not_applicable'; code: string }
  /** Muted note: the order would refuse the code on this product (provider-cost floor); no price. */
  | { kind: 'below_cost'; code: string }
  /** A minimum is not reached yet: condition text, no price. */
  | { kind: 'min_not_met'; code: string; minAmount: number | null; minQuantity: number | null; freeShipping: boolean }
  /** Percentage on this product: the discounted line price (null = no figure). */
  | { kind: 'percentage'; code: string; regular: number; discounted: number | null; freeShipping: boolean }
  /** Fixed amount off the order: no per-item price. */
  | { kind: 'fixed'; code: string; amount: number; freeShipping: boolean }
  | { kind: 'free_shipping'; code: string };

/**
 * Display rule for one coupon on the current line. `answer` is the last
 * server answer for this coupon and product (possibly for other figures):
 * when it matches `sig` it is used as is; otherwise the minimums are checked
 * locally and a percentage discount is scaled linearly from it until the
 * re-query lands.
 */
export function couponBannerView(
  s: CouponPreviewStatic | null,
  answer: CouponPreviewAnswer | null,
  current: { sig: string; lineAmount: number; cartSubtotal: number; itemCount: number },
): CouponBannerView {
  if (!s) return { kind: 'none' };
  const code = s.code;
  if (s.below_cost === true) return { kind: 'below_cost', code };
  if (!s.applies) return { kind: 'not_applicable', code };

  const fresh = answer && answer.sig === current.sig ? answer : null;
  const hasMin = s.min_amount !== null || s.min_quantity !== null;
  let minMet: boolean | null;
  if (fresh) {
    minMet = fresh.minMet;
  } else if (!hasMin) {
    minMet = true;
  } else {
    // Local estimate in the market currency; the server compares in base
    // currency and its answer replaces this one.
    minMet =
      (s.min_amount === null || current.cartSubtotal >= s.min_amount) &&
      (s.min_quantity === null || current.itemCount >= s.min_quantity);
  }
  if (minMet !== true) {
    return { kind: 'min_not_met', code, minAmount: s.min_amount, minQuantity: s.min_quantity, freeShipping: s.free_shipping };
  }

  if (s.discount_kind === 'percentage') {
    const line = Math.max(0, current.lineAmount);
    let discount: number | null = null;
    if (fresh) {
      discount = fresh.discountAmount;
    } else if (answer && isNum(answer.discountAmount) && answer.lineAmount > 0) {
      discount = roundMoney2((answer.discountAmount * line) / answer.lineAmount);
    } else if (isNum(s.percent)) {
      discount = roundMoney2((line * s.percent) / 100);
    }
    const valid = isNum(discount) && discount > 0 && line > 0;
    return {
      kind: 'percentage',
      code,
      regular: line,
      discounted: valid ? roundMoney2(line - Math.min(discount as number, line)) : null,
      freeShipping: s.free_shipping,
    };
  }
  if (s.discount_kind === 'fixed' && isNum(s.amount)) {
    return { kind: 'fixed', code, amount: s.amount, freeShipping: s.free_shipping };
  }
  if (s.free_shipping) return { kind: 'free_shipping', code };
  return { kind: 'none' };
}
