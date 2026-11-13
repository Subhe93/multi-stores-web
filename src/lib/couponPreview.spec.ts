import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyPreviewError,
  couponBannerView,
  couponPreviewBody,
  couponPreviewKey,
  couponPreviewSig,
  parsePreviewStatic,
  readPreviewCache,
  writePreviewCache,
  type CouponPreviewStatic,
} from './couponPreview';

const PCT: CouponPreviewStatic = {
  code: 'SUMMER20',
  discount_kind: 'percentage',
  percent: 20,
  amount: null,
  free_shipping: false,
  applies: true,
  min_amount: null,
  min_quantity: null,
};

const cur = (lineAmount: number, cartSubtotal = lineAmount, itemCount = 1, sig = `s:${lineAmount}:${cartSubtotal}:${itemCount}`) => ({
  sig,
  lineAmount,
  cartSubtotal,
  itemCount,
});

describe('couponPreviewBody / keys', () => {
  it('sends the market only for market stores and rounds the figures', () => {
    expect(
      couponPreviewBody({ storeId: 's1', code: 'X', productId: 'p1', lineAmount: 99.999, cartSubtotal: 150.004, itemCount: 3 }),
    ).toEqual({ coupon_code: 'X', store_id: 's1', product_id: 'p1', line_amount: 100, cart_subtotal: 150, item_count: 3 });
    expect(
      couponPreviewBody({ storeId: 's1', marketKey: 'de', marketPreview: true, code: 'X', productId: 'p1', lineAmount: 1, cartSubtotal: 1, itemCount: 1 }),
    ).toMatchObject({ market: 'de', preview: true });
  });

  it('keys the static cache per store, market, code and product; the sig adds the figures', () => {
    expect(couponPreviewKey('s1', 'de', 'X', 'p1')).not.toBe(couponPreviewKey('s1', undefined, 'X', 'p1'));
    const base = { storeId: 's1', code: 'X', productId: 'p1', lineAmount: 100, cartSubtotal: 100, itemCount: 1 };
    expect(couponPreviewSig(base)).not.toBe(couponPreviewSig({ ...base, itemCount: 2 }));
    expect(couponPreviewSig(base)).not.toBe(couponPreviewSig({ ...base, variantId: 'v1' }));
  });

  it('sends the quantity and the selected variant for the provider-cost floor', () => {
    expect(
      couponPreviewBody({ storeId: 's1', code: 'X', productId: 'p1', lineAmount: 50, cartSubtotal: 50, itemCount: 1, quantity: 1, variantId: 'v1' }),
    ).toMatchObject({ line_amount: 50, quantity: 1, variant_id: 'v1' });
    const none = couponPreviewBody({ storeId: 's1', code: 'X', productId: 'p1', lineAmount: 50, cartSubtotal: 50, itemCount: 1, quantity: 0, variantId: null });
    expect(none).not.toHaveProperty('quantity');
    expect(none).not.toHaveProperty('variant_id');
  });
});

describe('preview cache', () => {
  // Node environment: a Map-backed sessionStorage on a stub window.
  const data = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('window', { sessionStorage });
    return () => vi.unstubAllGlobals();
  });

  it('round-trips static fields and drops malformed entries', () => {
    writePreviewCache('k', PCT);
    expect(readPreviewCache('k')).toEqual(PCT);
    sessionStorage.setItem('k2', JSON.stringify({ ...PCT, discount_kind: 'percentage', percent: null }));
    expect(readPreviewCache('k2')).toBeNull();
    writePreviewCache('k', null);
    expect(readPreviewCache('k')).toBeNull();
  });

  it('parsePreviewStatic keeps only the static fields', () => {
    expect(parsePreviewStatic({ ...PCT, min_met: true, discount_amount: 20 })).toEqual(PCT);
  });
});

describe('classifyPreviewError', () => {
  it('only PROMOTION_COUPON_INVALID is invalid; rate limit, network and market errors are plain errors', () => {
    expect(classifyPreviewError({ status: 400, code: 'PROMOTION_COUPON_INVALID' })).toBe('invalid');
    expect(classifyPreviewError({ status: 429 })).toBe('error');
    expect(classifyPreviewError(new TypeError('Failed to fetch'))).toBe('error');
    expect(classifyPreviewError({ status: 404, code: 'MARKET_NOT_FOUND' })).toBe('error');
  });
});

describe('couponBannerView', () => {
  it('percentage + applies + min met: line minus the server amount', () => {
    const c = cur(100);
    expect(couponBannerView(PCT, { sig: c.sig, lineAmount: 100, minMet: true, discountAmount: 19.99 }, c)).toEqual({
      kind: 'percentage', code: 'SUMMER20', regular: 100, discounted: 80.01, freeShipping: false,
    });
  });

  it('scales the last server amount linearly until the re-query lands', () => {
    const answer = { sig: 'old', lineAmount: 100, minMet: true, discountAmount: 20 };
    expect(couponBannerView(PCT, answer, cur(250))).toMatchObject({ kind: 'percentage', regular: 250, discounted: 200 });
  });

  it('uses the percent from the cache when there is no answer yet', () => {
    expect(couponBannerView(PCT, null, cur(120))).toMatchObject({ kind: 'percentage', discounted: 96 });
  });

  it('minimum not met: condition, no price (server answer or local check)', () => {
    const s = { ...PCT, min_amount: 500, min_quantity: 3 };
    const c = cur(100, 200, 2);
    expect(couponBannerView(s, { sig: c.sig, lineAmount: 100, minMet: false, discountAmount: null }, c)).toEqual({
      kind: 'min_not_met', code: 'SUMMER20', minAmount: 500, minQuantity: 3, freeShipping: false,
    });
    expect(couponBannerView(s, null, cur(100, 200, 2)).kind).toBe('min_not_met');
    expect(couponBannerView(s, null, cur(100, 600, 3)).kind).toBe('percentage');
    // min_met null (figure missing) never shows a price.
    expect(couponBannerView(s, { sig: c.sig, lineAmount: 100, minMet: null, discountAmount: null }, c).kind).toBe('min_not_met');
  });

  it('fixed: order-level amount, no per-item price', () => {
    const s: CouponPreviewStatic = { ...PCT, discount_kind: 'fixed', percent: null, amount: 50 };
    expect(couponBannerView(s, null, cur(100))).toEqual({ kind: 'fixed', code: 'SUMMER20', amount: 50, freeShipping: false });
  });

  it('free shipping', () => {
    const s: CouponPreviewStatic = { ...PCT, discount_kind: null, percent: null, free_shipping: true };
    expect(couponBannerView(s, null, cur(100))).toEqual({ kind: 'free_shipping', code: 'SUMMER20' });
  });

  it('below_cost gives its own muted note (no price), even with applies:true', () => {
    expect(couponBannerView({ ...PCT, applies: false, below_cost: true }, null, cur(100))).toEqual({ kind: 'below_cost', code: 'SUMMER20' });
    expect(couponBannerView({ ...PCT, below_cost: true }, null, cur(100))).toEqual({ kind: 'below_cost', code: 'SUMMER20' });
  });

  it('parsePreviewStatic keeps below_cost:true, drops false/absent, rejects a non-boolean', () => {
    expect(parsePreviewStatic({ ...PCT, applies: false, below_cost: true })).toEqual({ ...PCT, applies: false, below_cost: true });
    expect(parsePreviewStatic({ ...PCT, below_cost: false })).toEqual(PCT);
    expect(parsePreviewStatic(PCT)).toEqual(PCT);
    expect(parsePreviewStatic({ ...PCT, below_cost: 'yes' })).toBeNull();
  });

  it('applies:false gives the muted note; no static gives nothing', () => {
    expect(couponBannerView({ ...PCT, applies: false }, null, cur(100))).toEqual({ kind: 'not_applicable', code: 'SUMMER20' });
    expect(couponBannerView(null, null, cur(100))).toEqual({ kind: 'none' });
  });

  it('no discount figure (zero line or zero server amount): banner without a price', () => {
    const c = cur(0);
    expect(couponBannerView(PCT, { sig: c.sig, lineAmount: 0, minMet: true, discountAmount: 0 }, c)).toMatchObject({
      kind: 'percentage', discounted: null,
    });
  });
});
