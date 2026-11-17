import { describe, expect, it } from 'vitest';
import {
  cartRequiresShipping,
  lineRequiresShipping,
  orderLineRequiresShipping,
  orderRequiresShipping,
  orderStatusLabelKey,
  orderTrackerIndex,
  orderTrackerSteps,
  productRequiresShipping,
  promotionsForProduct,
  readRequiresShippingFlag,
  shippableLines,
  shippingQuoteLines,
} from './requiresShipping';

// Products that need no shipping (services / digital products). The rule in
// every reader: only the literal `false` switches shipping off.

interface Line { id: string; requiresShipping?: false }
const SERVICE: Line = { id: 's', requiresShipping: false };
const MUG: Line = { id: 'm' };

describe('flag readers: only the literal false switches shipping off', () => {
  it('product / order / order line (API key)', () => {
    for (const read of [productRequiresShipping, orderRequiresShipping, orderLineRequiresShipping]) {
      expect(read({ requires_shipping: false })).toBe(false);
      expect(read({ requires_shipping: true })).toBe(true);
      expect(read({ requires_shipping: null })).toBe(true);
      expect(read({})).toBe(true);
      expect(read(null)).toBe(true);
      expect(read(undefined)).toBe(true);
      // Not a boolean: an older or foreign payload never hides shipping.
      expect(read({ requires_shipping: 0 as unknown as boolean })).toBe(true);
      expect(read({ requires_shipping: 'false' as unknown as boolean })).toBe(true);
    }
  });

  it('cart line (camelCase key)', () => {
    expect(lineRequiresShipping(SERVICE)).toBe(false);
    expect(lineRequiresShipping(MUG)).toBe(true);
    expect(lineRequiresShipping({ requiresShipping: null })).toBe(true);
    expect(lineRequiresShipping(undefined)).toBe(true);
  });

  it('raw payload value', () => {
    expect(readRequiresShippingFlag(false)).toBe(false);
    for (const v of [true, undefined, null, 0, '', 'false']) expect(readRequiresShippingFlag(v)).toBe(true);
  });
});

describe('cartRequiresShipping', () => {
  it('any line that ships makes the cart ship', () => {
    expect(cartRequiresShipping([MUG])).toBe(true);
    expect(cartRequiresShipping([SERVICE, MUG])).toBe(true);
    expect(cartRequiresShipping([SERVICE, SERVICE])).toBe(false);
  });

  it('an empty cart requires shipping (nothing is hidden)', () => {
    expect(cartRequiresShipping([])).toBe(true);
  });

  it('the quote wins over the lines when present', () => {
    // Stale guest flag: the product ships again.
    expect(cartRequiresShipping([SERVICE], { requires_shipping: true })).toBe(true);
    expect(cartRequiresShipping([SERVICE], {})).toBe(true);
    // The lines did not know yet (older stored line).
    expect(cartRequiresShipping([MUG], { requires_shipping: false })).toBe(false);
    // No quote: the lines decide.
    expect(cartRequiresShipping([SERVICE], null)).toBe(false);
    expect(cartRequiresShipping([SERVICE], undefined)).toBe(false);
  });
});

describe('shippableLines / shippingQuoteLines', () => {
  it('a mixed cart quotes shipping for its shippable lines only', () => {
    expect(shippableLines([SERVICE, MUG])).toEqual([MUG]);
    expect(shippingQuoteLines([SERVICE, MUG])).toEqual([MUG]);
  });

  it('a normal cart keeps every line, in order', () => {
    const lines: Line[] = [{ id: 'a' }, { id: 'b' }];
    expect(shippableLines(lines)).toEqual(lines);
    expect(shippingQuoteLines(lines)).toEqual(lines);
  });

  it('a cart without shipping sends no line', () => {
    expect(shippingQuoteLines([SERVICE])).toEqual([]);
    expect(shippingQuoteLines([MUG], { requires_shipping: false })).toEqual([]);
  });

  it('the quote says it ships but no line is flagged shippable: every line is sent', () => {
    expect(shippingQuoteLines([SERVICE], { requires_shipping: true })).toEqual([SERVICE]);
  });
});

describe('order tracker', () => {
  const NO_SHIP = { requires_shipping: false };

  it('an order that ships keeps the seven steps', () => {
    for (const order of [{}, { requires_shipping: true }, null]) {
      expect(orderTrackerSteps(order)).toEqual([
        'PENDING', 'CONFIRMED', 'PROCESSING', 'MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED',
      ]);
    }
    expect(orderTrackerIndex('SHIPPED', {})).toBe(5);
    expect(orderTrackerIndex('delivered', {})).toBe(6);
    // Unknown status: first step, as before.
    expect(orderTrackerIndex('WHATEVER', {})).toBe(0);
    expect(orderTrackerIndex(undefined, {})).toBe(0);
  });

  it('an order without shipping has four steps', () => {
    expect(orderTrackerSteps(NO_SHIP)).toEqual(['PENDING', 'CONFIRMED', 'PROCESSING', 'DELIVERED']);
    expect(orderTrackerIndex('PENDING', NO_SHIP)).toBe(0);
    expect(orderTrackerIndex('CONFIRMED', NO_SHIP)).toBe(1);
    expect(orderTrackerIndex('PROCESSING', NO_SHIP)).toBe(2);
    expect(orderTrackerIndex('DELIVERED', NO_SHIP)).toBe(3);
  });

  it('a stored production or shipped status shows at the PROCESSING step', () => {
    for (const status of ['MANUFACTURING', 'QUALITY_CHECK', 'SHIPPED']) {
      expect(orderTrackerIndex(status, NO_SHIP)).toBe(2);
    }
    expect(orderTrackerIndex('WHATEVER', NO_SHIP)).toBe(0);
  });

  it('DELIVERED reads "Completed" only on an order without shipping', () => {
    expect(orderStatusLabelKey('DELIVERED', NO_SHIP)).toBe('orderStatus.FULFILLED');
    expect(orderStatusLabelKey('DELIVERED', {})).toBe('orderStatus.DELIVERED');
    expect(orderStatusLabelKey('DELIVERED', { requires_shipping: true })).toBe('orderStatus.DELIVERED');
    expect(orderStatusLabelKey('SHIPPED', NO_SHIP)).toBe('orderStatus.SHIPPED');
    expect(orderStatusLabelKey('CANCELLED', NO_SHIP)).toBe('orderStatus.CANCELLED');
  });
});

describe('promotionsForProduct', () => {
  const promos = [{ id: '1', type: 'FREE_SHIPPING' }, { id: '2', type: 'PERCENTAGE' }];

  it('a product that ships keeps the same array', () => {
    expect(promotionsForProduct({}, promos)).toBe(promos);
    expect(promotionsForProduct({ requires_shipping: true }, promos)).toBe(promos);
  });

  it('a product without shipping never advertises free shipping', () => {
    expect(promotionsForProduct({ requires_shipping: false }, promos)).toEqual([{ id: '2', type: 'PERCENTAGE' }]);
  });

  it('no promotions is an empty list', () => {
    expect(promotionsForProduct({}, undefined)).toEqual([]);
    expect(promotionsForProduct({ requires_shipping: false }, null)).toEqual([]);
  });
});
