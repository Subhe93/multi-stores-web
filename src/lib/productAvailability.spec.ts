import { describe, expect, it } from 'vitest';
import { productAvailability } from './productAvailability';

describe('productAvailability', () => {
  it('a simple product without stock tracking is in stock', () => {
    expect(productAvailability({ track_inventory: false, stock_quantity: null, variants: [] })).toBe('InStock');
    expect(productAvailability({})).toBe('InStock');
  });

  it('a tracked simple product follows its stock number (missing = unlimited)', () => {
    expect(productAvailability({ track_inventory: true, stock_quantity: 0 })).toBe('OutOfStock');
    expect(productAvailability({ track_inventory: true, stock_quantity: -2 })).toBe('OutOfStock');
    expect(productAvailability({ track_inventory: true, stock_quantity: 3 })).toBe('InStock');
    expect(productAvailability({ track_inventory: true, stock_quantity: null })).toBe('InStock');
  });

  it('a product with variants is out of stock only when every variant is', () => {
    expect(productAvailability({ variants: [{ stock: 0 }, { stock: 0 }] })).toBe('OutOfStock');
    expect(productAvailability({ variants: [{ stock: 0 }, { stock: 999 }] })).toBe('InStock');
    expect(productAvailability({ variants: [{ stock: null }] })).toBe('InStock');
  });
});
