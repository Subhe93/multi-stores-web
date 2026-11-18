import { describe, expect, it } from 'vitest';
import {
  assertGuestStock,
  insufficientStockAvailable,
  insufficientStockError,
  lineQuantityCap,
  lineStockMax,
  productStockBound,
  readStockAvailable,
  stockRowKey,
  type StockLine,
} from './productQuantity';
import { buildLineMetadata } from './cartLine';
import { addGuestLine } from './guestCart';
import { normalizeCartItem } from '@/hooks/useCart';

// Item 9: the cart never holds more units of one stock row than the row has.

const line = (over: Partial<StockLine> & { id: string }): StockLine => ({
  productId: 'p1',
  quantity: 1,
  ...over,
});

describe('readStockAvailable', () => {
  it('numbers of 0 or more only', () => {
    expect(readStockAvailable(8)).toBe(8);
    expect(readStockAvailable(0)).toBe(0);
    expect(readStockAvailable(2.9)).toBe(2);
    expect(readStockAvailable(-1)).toBeNull();
    expect(readStockAvailable('8')).toBeNull();
    expect(readStockAvailable(null)).toBeNull();
    expect(readStockAvailable(undefined)).toBeNull();
    expect(readStockAvailable(Number.NaN)).toBeNull();
  });
});

describe('productStockBound', () => {
  it('a selected variant bounds the line with its own number', () => {
    expect(productStockBound({ variants: [{}] }, { stock: 8 })).toBe(8);
    expect(productStockBound({ variants: [{}] }, { stock: 0 })).toBe(0);
  });

  it('an untracked variant (served as 999, or without a number) has no bound', () => {
    expect(productStockBound({ variants: [{}] }, { stock: 999 })).toBeNull();
    expect(productStockBound({ variants: [{}] }, { stock: null })).toBeNull();
    expect(productStockBound({ variants: [{}] }, {})).toBeNull();
  });

  it('a product with variants and none selected has no bound', () => {
    expect(productStockBound({ track_inventory: true, stock_quantity: 40, variants: [{}] }, null)).toBeNull();
  });

  it('a tracked product without variants is bounded by its number, imported products too', () => {
    expect(productStockBound({ track_inventory: true, stock_quantity: 5, variants: [] })).toBe(5);
    expect(productStockBound({ track_inventory: true, stock_quantity: 5 })).toBe(5);
    expect(productStockBound({ track_inventory: true, stock_quantity: 0 })).toBe(0);
  });

  it('untracked or without a number: no bound', () => {
    expect(productStockBound({ track_inventory: false, stock_quantity: 5 })).toBeNull();
    expect(productStockBound({ track_inventory: true, stock_quantity: null })).toBeNull();
    expect(productStockBound({})).toBeNull();
  });
});

describe('stock row of a line', () => {
  it('variant first, then imported product, then product', () => {
    expect(stockRowKey({ productId: 'p1', variantId: 'v1' })).toBe('v:v1');
    expect(stockRowKey({ productId: 'c1', customProductId: 'c1' })).toBe('c:c1');
    expect(stockRowKey({ productId: 'p1' })).toBe('p:p1');
  });

  it('lineStockMax: the row stock minus the same row on the other lines', () => {
    const a = line({ id: 'a', variantId: 'v1', quantity: 3, stockOnHand: 8 });
    const b = line({ id: 'b', variantId: 'v1', quantity: 2, stockOnHand: 8 });
    const other = line({ id: 'c', variantId: 'v2', quantity: 9, stockOnHand: 9 });
    expect(lineStockMax(a, [a, b, other])).toBe(6);
    expect(lineStockMax(b, [a, b, other])).toBe(5);
    expect(lineStockMax(other, [a, b, other])).toBe(9);
    // Never below 0.
    const big = line({ id: 'd', variantId: 'v1', quantity: 20, stockOnHand: 8 });
    expect(lineStockMax(a, [a, big])).toBe(0);
  });

  it('lineStockMax: a server line carries its own answer (no second subtraction)', () => {
    const a = line({ id: 'a', variantId: 'v1', quantity: 3, stockAvailable: 6 });
    const b = line({ id: 'b', variantId: 'v1', quantity: 2, stockAvailable: 5 });
    expect(lineStockMax(a, [a, b])).toBe(6);
    expect(lineStockMax(b, [a, b])).toBe(5);
    expect(lineQuantityCap(a, [a, b])).toEqual({ max: 6, stock: 6 });
  });

  it('lineStockMax: null without a known stock', () => {
    const a = line({ id: 'a', variantId: 'v1', quantity: 3 });
    expect(lineStockMax(a, [a])).toBeNull();
  });
});

describe('lineQuantityCap', () => {
  it('no limit and no stock: no cap (cart unchanged)', () => {
    const a = line({ id: 'a', quantity: 3 });
    expect(lineQuantityCap(a, [a])).toEqual({ max: null, stock: null });
  });

  it('stock only: the stock caps and names itself', () => {
    const a = line({ id: 'a', quantity: 3, stockOnHand: 8 });
    expect(lineQuantityCap(a, [a])).toEqual({ max: 8, stock: 8 });
  });

  it('per-order limit only: as before', () => {
    const a = line({ id: 'a', quantity: 1, maxPerOrder: 2 });
    expect(lineQuantityCap(a, [a])).toEqual({ max: 2, stock: null });
  });

  it('both: the lower one wins; stock is named only when it binds', () => {
    const low = line({ id: 'a', quantity: 1, maxPerOrder: 2, stockOnHand: 8 });
    expect(lineQuantityCap(low, [low])).toEqual({ max: 2, stock: null });
    const high = line({ id: 'a', quantity: 1, maxPerOrder: 9, stockOnHand: 4 });
    expect(lineQuantityCap(high, [high])).toEqual({ max: 4, stock: 4 });
  });
});

describe('guest add', () => {
  it('refuses more than the stock with CART_INSUFFICIENT_STOCK and what is left', () => {
    const inCart = [line({ id: 'a', variantId: 'v1', quantity: 6, stockOnHand: 8 })];
    expect(() => assertGuestStock({ productId: 'p1', variantId: 'v1' }, 2, 8, inCart)).not.toThrow();
    try {
      assertGuestStock({ productId: 'p1', variantId: 'v1' }, 3, 8, inCart);
      throw new Error('expected a refusal');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('CART_INSUFFICIENT_STOCK');
      expect(insufficientStockAvailable(err)).toBe(2);
      expect((err as { params?: unknown }).params).toEqual({ available: 2 });
    }
  });

  it('the first add over the stock is refused too (9 with 8 left)', () => {
    expect(() => assertGuestStock({ productId: 'p1', variantId: 'v1' }, 9, 8, [])).toThrow();
    expect(() => assertGuestStock({ productId: 'p1', variantId: 'v1' }, 8, 8, [])).not.toThrow();
  });

  it('two lines of one variant share the stock; another variant does not', () => {
    const inCart = [
      line({ id: 'a', variantId: 'v1', quantity: 4 }),
      line({ id: 'b', variantId: 'v1', quantity: 3 }),
      line({ id: 'c', variantId: 'v2', quantity: 50 }),
    ];
    expect(() => assertGuestStock({ productId: 'p1', variantId: 'v1' }, 1, 8, inCart)).not.toThrow();
    expect(() => assertGuestStock({ productId: 'p1', variantId: 'v1' }, 2, 8, inCart)).toThrow();
  });

  it('no known stock: never refused', () => {
    expect(() => assertGuestStock({ productId: 'p1' }, 5000, null, [])).not.toThrow();
    expect(() => assertGuestStock({ productId: 'p1' }, 5000, undefined, [])).not.toThrow();
  });

  it('sold out: nothing can be added', () => {
    expect(() => assertGuestStock({ productId: 'p1' }, 1, 0, [])).toThrow();
  });
});

describe('insufficientStockAvailable', () => {
  it('reads the API shape (top-level available) and the local one', () => {
    expect(insufficientStockAvailable({ code: 'CART_INSUFFICIENT_STOCK', available: 3 })).toBe(3);
    expect(insufficientStockAvailable(insufficientStockError(5))).toBe(5);
    expect(insufficientStockAvailable(insufficientStockError(-2))).toBe(0);
  });

  it('is null for any other error', () => {
    expect(insufficientStockAvailable({ code: 'CART_MAX_PER_ORDER', available: 3 })).toBeNull();
    expect(insufficientStockAvailable(new Error('x'))).toBeNull();
    expect(insufficientStockAvailable(null)).toBeNull();
  });
});

describe('the stock number travels with the line', () => {
  it('line metadata carries it only when known', () => {
    const base = { title: 'Hoodie', unitPrice: 10 };
    expect('stockOnHand' in buildLineMetadata(base)).toBe(false);
    expect('stockOnHand' in buildLineMetadata({ ...base, stockOnHand: null })).toBe(false);
    expect(buildLineMetadata({ ...base, stockOnHand: 8 }).stockOnHand).toBe(8);
    expect(buildLineMetadata({ ...base, stockOnHand: 0 }).stockOnHand).toBe(0);
  });

  it('a guest line stores it; lines without it keep their shape', () => {
    const plain = addGuestLine([], 'p1', null, 1, undefined, { title: 'A', price: 1 }, () => 'local_1');
    expect('stockOnHand' in plain[0]!).toBe(false);
    const tracked = addGuestLine([], 'p1', 'v1', 1, undefined, { title: 'A', price: 1, stockOnHand: 8 }, () => 'local_1');
    expect(tracked[0]!.stockOnHand).toBe(8);
    // Adding the same line again refreshes the number.
    const again = addGuestLine(tracked, 'p1', 'v1', 2, undefined, { title: 'A', price: 1, stockOnHand: 7 }, () => 'local_2');
    expect(again).toHaveLength(1);
    expect(again[0]!.quantity).toBe(3);
    expect(again[0]!.stockOnHand).toBe(7);
  });

  it('GET /cart: stock_available is read only when the row is tracked', () => {
    expect(normalizeCartItem({ id: 'l1', product_id: 'p1', quantity: 2, stock_available: 8 }).stockAvailable).toBe(8);
    expect('stockAvailable' in normalizeCartItem({ id: 'l1', product_id: 'p1', quantity: 2 })).toBe(false);
    expect('stockAvailable' in normalizeCartItem({ id: 'l1', product_id: 'p1', quantity: 2, stock_available: null })).toBe(false);
  });
});
