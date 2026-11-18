import { describe, expect, it } from 'vitest';
import { cardStock } from './stock';

const v = (stock: number | null | undefined, is_active: boolean | null = true) => ({ stock, is_active });

describe('cardStock', () => {
  it('says nothing about an untracked simple product', () => {
    expect(cardStock({ id: 'p' })).toBeNull();
    expect(cardStock({ id: 'p', track_inventory: false, stock_quantity: 0 })).toBeNull();
    expect(cardStock({ id: 'p', track_inventory: true })).toBeNull();
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: null })).toBeNull();
  });

  it('reads a tracked simple product', () => {
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: 0 })).toEqual({ soldOut: true, count: null });
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: -2 })).toEqual({ soldOut: true, count: null });
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: 2 })).toEqual({ soldOut: false, count: 2 });
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: 10 })).toEqual({ soldOut: false, count: 10 });
  });

  it('never reports a number above the cap', () => {
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: 11 })).toEqual({ soldOut: false, count: null });
    expect(cardStock({ id: 'p', variants: [v(6), v(5)] })).toEqual({ soldOut: false, count: null });
  });

  it('lets the variants decide when there are any', () => {
    // Product-level fields are ignored once variants exist.
    expect(cardStock({ id: 'p', track_inventory: true, stock_quantity: 0, variants: [v(4)] })).toEqual({
      soldOut: false,
      count: 4,
    });
    expect(cardStock({ id: 'p', variants: [v(1), v(2), v(0)] })).toEqual({ soldOut: false, count: 3 });
    expect(cardStock({ id: 'p', variants: [v(0), v(0)] })).toEqual({ soldOut: true, count: null });
  });

  it('ignores inactive variants', () => {
    expect(cardStock({ id: 'p', variants: [v(0), v(5, false)] })).toEqual({ soldOut: true, count: null });
    expect(cardStock({ id: 'p', variants: [v(2), v(50, false)] })).toEqual({ soldOut: false, count: 2 });
    expect(cardStock({ id: 'p', variants: [v(3, false)] })).toEqual({ soldOut: true, count: null });
  });

  it('gives no count when an active variant is untracked (999 sentinel)', () => {
    expect(cardStock({ id: 'p', variants: [v(1), v(999)] })).toEqual({ soldOut: false, count: null });
    expect(cardStock({ id: 'p', variants: [v(0), v(999)] })).toEqual({ soldOut: false, count: null });
    // An untracked variant that is switched off does not hide the number.
    expect(cardStock({ id: 'p', variants: [v(2), v(999, false)] })).toEqual({ soldOut: false, count: 2 });
  });

  it('says nothing when a variant stock is unknown', () => {
    expect(cardStock({ id: 'p', variants: [v(2), v(undefined)] })).toBeNull();
    expect(cardStock({ id: 'p', variants: [v(null)] })).toBeNull();
  });
});
