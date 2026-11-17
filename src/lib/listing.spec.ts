import { describe, expect, it } from 'vitest';
import { toListingProduct, type StorefrontProductRow } from './listing';

// Card projection of the `product-listing` section. The badge shows the
// first promotion; a product without shipping (service / digital product)
// never advertises free shipping.

const BASE: StorefrontProductRow = {
  id: 'p1',
  base_price: '100',
  translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
  images: [{ url: '/mug.png' }],
};
const FREE_SHIPPING = { type: 'FREE_SHIPPING', value: 0, translations: [{ title: 'Free shipping' }] };
const PERCENTAGE = { type: 'PERCENTAGE', value: 10, translations: [{ title: 'Sale' }] };

describe('toListingProduct promotions', () => {
  it('a product that ships keeps its first promotion (missing, null or true flag)', () => {
    const expected = [{ type: 'FREE_SHIPPING', value: 0, translations: [{ title: 'Free shipping' }] }];
    for (const flag of [{}, { requires_shipping: null }, { requires_shipping: true }]) {
      const out = toListingProduct({ ...BASE, ...flag, promotions: [FREE_SHIPPING, PERCENTAGE] });
      expect(out.promotions).toEqual(expected);
    }
  });

  it('a product without shipping skips a free-shipping promotion and shows the next one', () => {
    const out = toListingProduct({ ...BASE, requires_shipping: false, promotions: [FREE_SHIPPING, PERCENTAGE] });
    expect(out.promotions).toEqual([{ type: 'PERCENTAGE', value: 10, translations: [{ title: 'Sale' }] }]);
  });

  it('a product without shipping whose only promotion is free shipping has no badge', () => {
    const out = toListingProduct({ ...BASE, requires_shipping: false, promotions: [FREE_SHIPPING] });
    expect(out.promotions).toBeUndefined();
  });

  it('the projection of a product that ships is the same object shape as before', () => {
    expect(toListingProduct({ ...BASE, promotions: [PERCENTAGE] })).toEqual({
      id: 'p1',
      base_price: 100,
      compare_at_price: undefined,
      created_at: undefined,
      translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
      images: [{ url: '/mug.png' }],
      promotions: [{ type: 'PERCENTAGE', value: 10, translations: [{ title: 'Sale' }] }],
      vendor: undefined,
    });
  });
});
