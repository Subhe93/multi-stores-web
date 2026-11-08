import { describe, expect, it } from 'vitest';
import {
  lineMatchesUnavailable,
  normalizeUnavailable,
  readUnavailableError,
  unavailableLines,
  withoutUnavailable,
} from './cartUnavailable';

const lines = [
  { id: 'a', productId: 'p1' },
  { id: 'b', productId: 'p2', variantId: 'v1' },
  { id: 'c', productId: 'p2', variantId: 'v2' },
  { id: 'd', productId: 'c1', customProductId: 'c1' },
];

describe('normalizeUnavailable', () => {
  it('keeps entries with at least one id', () => {
    expect(normalizeUnavailable([{ product_id: 'p1' }, {}, null, 'x', { variant_id: '' }, { custom_product_id: 'c1' }]))
      .toEqual([{ product_id: 'p1' }, { custom_product_id: 'c1' }]);
    expect(normalizeUnavailable(undefined)).toEqual([]);
  });
});

describe('readUnavailableError', () => {
  it('reads only CART_ITEMS_UNAVAILABLE', () => {
    expect(readUnavailableError({ code: 'CART_ITEMS_UNAVAILABLE', unavailable: [{ product_id: 'p1' }] }))
      .toEqual([{ product_id: 'p1' }]);
    expect(readUnavailableError({ code: 'CART_ITEMS_UNAVAILABLE' })).toEqual([]);
    expect(readUnavailableError({ code: 'STORE_NOT_LIVE', unavailable: [{ product_id: 'p1' }] })).toBeNull();
    expect(readUnavailableError(null)).toBeNull();
  });
});

describe('lineMatchesUnavailable', () => {
  it('a product entry takes every line of the product', () => {
    expect(unavailableLines(lines, [{ product_id: 'p2' }]).map((l) => l.id)).toEqual(['b', 'c']);
  });
  it('a variant entry takes only that variant', () => {
    expect(unavailableLines(lines, [{ product_id: 'p2', variant_id: 'v2' }]).map((l) => l.id)).toEqual(['c']);
    expect(unavailableLines(lines, [{ variant_id: 'v1' }]).map((l) => l.id)).toEqual(['b']);
    expect(lineMatchesUnavailable(lines[1]!, { product_id: 'p9', variant_id: 'v1' })).toBe(false);
  });
  it('custom products match on their own id only', () => {
    expect(unavailableLines(lines, [{ custom_product_id: 'c1' }]).map((l) => l.id)).toEqual(['d']);
    expect(unavailableLines(lines, [{ product_id: 'c1' }])).toEqual([]);
  });
  it('withoutUnavailable drops the named lines', () => {
    expect(withoutUnavailable(lines, [{ product_id: 'p1' }, { custom_product_id: 'c1' }]).map((l) => l.id)).toEqual(['b', 'c']);
    expect(withoutUnavailable(lines, [])).toHaveLength(4);
  });
});
