import { describe, expect, it } from 'vitest';
import {
  assertGuestAdd,
  clampQty,
  effectiveMax,
  lineMaxQty,
  readMaxPerOrder,
  readQtyParam,
  simpleProductStock,
} from './productQuantity';

describe('productQuantity (headless booking B2/B3)', () => {
  it('readMaxPerOrder: positive integers only', () => {
    expect(readMaxPerOrder(3)).toBe(3);
    expect(readMaxPerOrder(null)).toBeNull();
    expect(readMaxPerOrder(undefined)).toBeNull();
    expect(readMaxPerOrder(0)).toBeNull();
    expect(readMaxPerOrder(2.5)).toBeNull();
    expect(readMaxPerOrder('3')).toBeNull();
  });

  it('effectiveMax: smaller bound, rounded to the step; null without bounds', () => {
    expect(effectiveMax(null, null)).toBeNull();
    expect(effectiveMax(undefined, null)).toBeNull();
    expect(effectiveMax(5, null)).toBe(5);
    expect(effectiveMax(null, 2)).toBe(2);
    expect(effectiveMax(5, 2)).toBe(2);
    expect(effectiveMax(1, 4)).toBe(1);
    expect(effectiveMax(10, 7, 3)).toBe(6);
    expect(effectiveMax(-2, 3)).toBe(0);
  });

  it('simpleProductStock: only tracked products without variants', () => {
    expect(simpleProductStock({ track_inventory: true, stock_quantity: 4 })).toBe(4);
    expect(simpleProductStock({ track_inventory: true, stock_quantity: 0, variants: [] })).toBe(0);
    expect(simpleProductStock({ track_inventory: false, stock_quantity: 0 })).toBeNull();
    expect(simpleProductStock({ track_inventory: true, stock_quantity: null })).toBeNull();
    expect(simpleProductStock({ stock_quantity: 0 })).toBeNull();
    expect(simpleProductStock({ track_inventory: true, stock_quantity: 0, variants: [{}] })).toBeNull();
    expect(simpleProductStock({ track_inventory: true, stock_quantity: 0, _type: 'custom_product' })).toBeNull();
  });

  it('lineMaxQty: the limit minus the product units on other own lines', () => {
    const a = { id: 'a', productId: 'p1', quantity: 1, maxPerOrder: 3 };
    const b = { id: 'b', productId: 'p1', quantity: 1, maxPerOrder: 3 };
    const other = { id: 'c', productId: 'p2', quantity: 5 };
    const custom = { id: 'd', productId: 'p1', customProductId: 'p1', quantity: 9 };
    expect(lineMaxQty(a, [a, b, other, custom])).toBe(2);
    expect(lineMaxQty(other, [a, b, other])).toBeNull();
    expect(lineMaxQty({ ...a, quantity: 4 }, [{ ...a, quantity: 4 }, b])).toBe(2);
  });

  it('assertGuestAdd: refuses past the limit with CART_MAX_PER_ORDER; no limit never throws', () => {
    const lines = [{ id: 'a', productId: 'p1', quantity: 2 }];
    expect(() => assertGuestAdd('p1', 1, 3, lines)).not.toThrow();
    let caught: unknown;
    try {
      assertGuestAdd('p1', 2, 3, lines);
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ code: 'CART_MAX_PER_ORDER', status: 400, params: { max: 3, product_id: 'p1' } });
    expect(() => assertGuestAdd('p1', 99, undefined, lines)).not.toThrow();
    expect(() => assertGuestAdd('p1', 99, null, lines)).not.toThrow();
    expect(() => assertGuestAdd('p1', 99, 1, lines, true)).not.toThrow();
  });

  it('readQtyParam: plain positive integers only', () => {
    expect(readQtyParam('?qty=3')).toBe(3);
    expect(readQtyParam('?a=1&qty=12')).toBe(12);
    expect(readQtyParam(new URLSearchParams('qty=2'))).toBe(2);
    expect(readQtyParam('?qty=abc')).toBeNull();
    expect(readQtyParam('?qty=0')).toBeNull();
    expect(readQtyParam('?qty=-1')).toBeNull();
    expect(readQtyParam('?qty=2.5')).toBeNull();
    expect(readQtyParam('?qty=')).toBeNull();
    expect(readQtyParam('')).toBeNull();
    expect(readQtyParam(null)).toBeNull();
    expect(readQtyParam('?qty=99999999999999999999')).toBeNull();
    expect(readQtyParam('?qty=50000')).toBe(9999);
  });

  it('clampQty: within [min, max] on step multiples', () => {
    expect(clampQty(3, { max: 5 })).toBe(3);
    expect(clampQty(99, { max: 5 })).toBe(5);
    expect(clampQty(99, {})).toBe(99);
    expect(clampQty(7, { min: 3, step: 3, max: 10 })).toBe(6);
    expect(clampQty(4, { max: 0 })).toBe(1);
  });
});
