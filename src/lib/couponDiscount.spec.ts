import { describe, expect, it } from 'vitest';
import {
  classifyCouponError,
  couponAppliesToProduct,
  couponCartKey,
  couponDiscount,
  couponLineTotals,
  inferTargeted,
  parseStoredCoupon,
  type AppliedCoupon,
} from '@/lib/couponDiscount';

const A = { productId: 'p1', price: 100, quantity: 1 };
const B = { productId: 'p2', price: 300, quantity: 1 };
const HIDDEN = { productId: 'p3', price: 999, quantity: 1, unavailableInMarket: true };

describe('couponDiscount', () => {
  it('no coupon / empty cart → 0', () => {
    expect(couponDiscount(null, [A])).toBe(0);
    expect(couponDiscount({ code: 'X', type: 'percentage', discount: 10 }, [])).toBe(0);
  });

  it('untargeted percentage → share of the whole subtotal (hidden lines excluded)', () => {
    expect(couponDiscount({ code: 'X', type: 'percentage', discount: 10 }, [A, B, HIDDEN])).toBe(40);
  });

  it('fixed amount is capped at the subtotal', () => {
    expect(couponDiscount({ code: 'X', type: 'fixed', discount: 500 }, [A])).toBe(100);
    expect(couponDiscount({ code: 'X', type: 'fixed', discount: 50 }, [A])).toBe(50);
  });

  it('server amount wins when it was computed for exactly these lines', () => {
    const coupon: AppliedCoupon = {
      code: 'X', type: 'percentage', discount: 10, discountAmount: 10, targeted: true, cartKey: couponCartKey([A, B]),
    };
    expect(couponDiscount(coupon, [B, A])).toBe(10);
  });

  it('an unverified (legacy, not yet validated) coupon shows no discount', () => {
    const coupon: AppliedCoupon = { code: 'X', type: 'percentage', discount: 10, unverified: true };
    expect(couponDiscount(coupon, [A, B])).toBe(0);
  });

  it('targeted percentage with known ids → targeted lines only', () => {
    const coupon: AppliedCoupon = { code: 'X', type: 'percentage', discount: 10, targeted: true, productIds: ['p1'] };
    expect(couponDiscount(coupon, [A, B])).toBe(10);
    expect(couponDiscount(coupon, [{ ...A, quantity: 3 }, B])).toBe(30);
  });

  it('targeted fixed with known ids → capped at the targeted lines', () => {
    const coupon: AppliedCoupon = { code: 'X', type: 'fixed', discount: 250, targeted: true, productIds: ['p1'] };
    expect(couponDiscount(coupon, [A, B])).toBe(100);
  });

  it('targeted (ids unknown) on a changed cart → last server amount, never above the subtotal', () => {
    const coupon: AppliedCoupon = {
      code: 'X', type: 'percentage', discount: 10, discountAmount: 10, targeted: true, cartKey: 'stale',
    };
    expect(couponDiscount(coupon, [A, B])).toBe(10);
    expect(couponDiscount({ ...coupon, discountAmount: 5000 }, [A])).toBe(100);
  });

  it('custom product lines match by custom product id', () => {
    const coupon: AppliedCoupon = { code: 'X', type: 'percentage', discount: 50, targeted: true, productIds: ['c1'] };
    expect(couponDiscount(coupon, [{ productId: 'base', customProductId: 'c1', price: 80, quantity: 1 }, B])).toBe(40);
  });

  it('rounds to 2 decimals', () => {
    expect(couponDiscount({ code: 'X', type: 'percentage', discount: 15 }, [{ productId: 'p', price: 33.33, quantity: 1 }])).toBe(5);
  });
});

describe('couponLineTotals / couponCartKey', () => {
  it('per-line totals of the available lines, keyed like the order path', () => {
    expect(couponLineTotals([{ ...A, quantity: 2 }, { productId: 'base', customProductId: 'c1', price: 10, quantity: 1 }, HIDDEN])).toEqual([
      { product_id: 'p1', amount: 200 },
      { product_id: 'c1', amount: 10 },
    ]);
  });
  it('key ignores line order and changes with quantity', () => {
    expect(couponCartKey([A, B])).toBe(couponCartKey([B, A]));
    expect(couponCartKey([A, B])).not.toBe(couponCartKey([{ ...A, quantity: 2 }, B]));
  });
});

describe('inferTargeted', () => {
  it('full-cart amount → untargeted; clearly smaller → targeted', () => {
    expect(inferTargeted('percentage', 10, 40, 400)).toBe(false);
    expect(inferTargeted('percentage', 10, 39.99, 400)).toBe(false);
    expect(inferTargeted('percentage', 10, 10, 400)).toBe(true);
    expect(inferTargeted('fixed', 100, 100, 400)).toBe(false);
    expect(inferTargeted('fixed', 500, 400, 400)).toBe(false);
    expect(inferTargeted('fixed', 500, 100, 400)).toBe(true);
  });
});

describe('couponAppliesToProduct', () => {
  it('reads the targeting', () => {
    expect(couponAppliesToProduct(null, 'p1')).toBe(false);
    expect(couponAppliesToProduct({ code: 'X', type: 'fixed', discount: 1, targeted: false }, 'p1')).toBe(true);
    expect(couponAppliesToProduct({ code: 'X', type: 'fixed', discount: 1, productIds: ['p2'] }, 'p1')).toBe(false);
    expect(couponAppliesToProduct({ code: 'X', type: 'fixed', discount: 1, targeted: true }, 'p1')).toBeNull();
  });
});

describe('classifyCouponError', () => {
  it('cart-dependent failures are soft', () => {
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_MIN_AMOUNT', status: 400 })).toBe('soft');
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_MIN_QUANTITY', status: 400 })).toBe('soft');
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_NOT_APPLICABLE', status: 400 })).toBe('soft');
    // Older API: plain message, no code.
    expect(classifyCouponError(Object.assign(new Error('Minimum order amount is 500'), { status: 400 }))).toBe('soft');
    expect(classifyCouponError(Object.assign(new Error('Minimum 3 items required'), { status: 400 }))).toBe('soft');
  });
  it('rate limit / server errors are transient', () => {
    expect(classifyCouponError({ status: 429 })).toBe('transient');
    expect(classifyCouponError({ status: 503 })).toBe('transient');
  });
  it('anything else is hard', () => {
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_INVALID', status: 400 })).toBe('hard');
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_EXPIRED', status: 400 })).toBe('hard');
    expect(classifyCouponError({ code: 'PROMOTION_COUPON_USAGE_LIMIT_REACHED', status: 400 })).toBe('hard');
    // A 4xx about the code without a known soft code.
    expect(classifyCouponError(Object.assign(new Error('Bad'), { status: 400 }))).toBe('hard');
    expect(classifyCouponError(Object.assign(new Error('Not found'), { status: 404 }))).toBe('hard');
  });
  it('an error without an HTTP status is transient (never discards a code)', () => {
    // fetch dropped (offline / flaky mobile network).
    expect(classifyCouponError(new TypeError('Failed to fetch'))).toBe('transient');
    // A proxy's HTML 502/503 page parsed as JSON.
    expect(classifyCouponError(new SyntaxError("Unexpected token '<'"))).toBe('transient');
    // Aborted request.
    expect(classifyCouponError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe('transient');
    expect(classifyCouponError(new Error('boom'))).toBe('transient');
    expect(classifyCouponError(null)).toBe('transient');
  });
  it('an older API rejecting an unknown request field is transient', () => {
    const err = Object.assign(new Error('property line_totals should not exist'), { status: 400 });
    expect(classifyCouponError(err)).toBe('transient');
    // A coded 400 is judged by its code, never by the message.
    expect(
      classifyCouponError(Object.assign(new Error('should not exist'), { status: 400, code: 'PROMOTION_COUPON_INVALID' })),
    ).toBe('hard');
  });
});

describe('parseStoredCoupon', () => {
  it('accepts a coupon, rejects junk', () => {
    expect(parseStoredCoupon(JSON.stringify({ code: 'X', type: 'fixed', discount: 5 }))?.code).toBe('X');
    expect(parseStoredCoupon('{"code":"X"}')).toBeNull();
    expect(parseStoredCoupon('not json')).toBeNull();
    expect(parseStoredCoupon(null)).toBeNull();
  });
});
