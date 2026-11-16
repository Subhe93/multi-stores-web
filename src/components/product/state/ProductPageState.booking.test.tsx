import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Headless booking B2/B3 on the shared product page state: sold-out simple
// products, stock and `max_per_order` bounds on the selectors, bundles that
// do not fit the limit, the `?qty=N` pre-fill, and the proof that products
// without these settings keep the exact previous state.

const addItem = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (k: string) => k }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: () => ({
    appOn: false,
    appSettings: {},
    market: null,
    storeSlug: 'demo',
    fields: {
      fields: [],
      values: {},
      onChange: () => undefined,
      validateAll: () => ({ ok: true }),
      buildPayload: () => ({ fields: {}, display: [] }),
      applyServerError: () => null,
      errors: {},
      showAllErrors: false,
    },
    advanced: null,
    cardsConfig: undefined,
    priceDelta: 0,
    deltaInCart: false,
  }),
}));

import { ProductPageStateProvider, useProductPageState } from './ProductPageState';

type Bundles = NonNullable<ProductData['bundles']>;

function simple(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Course', slug: 'course' }],
    images: [],
    variants: [],
    ...overrides,
  };
}

const BUNDLES: Bundles = [
  {
    id: 'b1',
    status: 'ACTIVE',
    translations: [{ locale: 'en', name: 'Bundle' }],
    offers: [
      { id: 'o2', quantity: 2, discount_type: 'PERCENTAGE', discount_value: 5, sort_order: 0, translations: [{ locale: 'en', title: 'Buy 2' }] },
      { id: 'o4', quantity: 4, discount_type: 'PERCENTAGE', discount_value: 10, sort_order: 1, translations: [{ locale: 'en', title: 'Buy 4' }] },
      // ITEM: buy 2 get 1 = 3 units in the cart.
      { id: 'o21', quantity: 2, discount_type: 'ITEM', discount_value: 1, sort_order: 2, translations: [{ locale: 'en', title: '2+1' }] },
    ],
  },
];

function wrapperFor(product: ProductData) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
        {children}
      </ProductPageStateProvider>
    );
  };
}

function render(product: ProductData) {
  return renderHook(() => useProductPageState(), { wrapper: wrapperFor(product) });
}

const TWO_DATES = [
  { id: 'v1', price: 100, stock: 2, options: { Date: '1 May' } },
  { id: 'v2', price: 100, stock: 9, options: { Date: '2 May' } },
];

describe('ProductPageState booking bounds (B2/B3)', () => {
  beforeEach(() => {
    addItem.mockClear();
    window.history.replaceState(null, '', '/en/products/course');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('no settings: no bound, not sold out, same bundles, quantity 1 (unchanged behaviour)', () => {
    const product = simple({ bundles: BUNDLES });
    const { result } = render(product);
    expect(result.current.maxStock).toBeUndefined();
    expect(result.current.maxQuantity).toBeUndefined();
    expect(result.current.maxPerOrder).toBeNull();
    expect(result.current.isOutOfStock).toBe(false);
    expect(result.current.simpleSoldOut).toBe(false);
    expect(result.current.isAddBlocked).toBe(false);
    expect(result.current.bundles).toBe(product.bundles);
    expect(result.current.quantity).toBe(1);
    expect('maxPerOrder' in result.current.lineSource).toBe(false);
  });

  it('untracked stock 0 is not sold out (stock does not bound it)', () => {
    const { result } = render(simple({ track_inventory: false, stock_quantity: 0 }));
    expect(result.current.isOutOfStock).toBe(false);
    expect(result.current.maxQuantity).toBeUndefined();
  });

  it('without max_per_order a tracked simple product keeps the previous behaviour (no stock bound, not sold out)', () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 0 }));
    expect(result.current.simpleSoldOut).toBe(false);
    expect(result.current.isOutOfStock).toBe(false);
    expect(result.current.isAddBlocked).toBe(false);
    expect(result.current.maxStock).toBeUndefined();
    expect(result.current.maxQuantity).toBeUndefined();
    const { result: low } = render(simple({ track_inventory: true, stock_quantity: 2 }));
    expect(low.current.maxQuantity).toBeUndefined();
  });

  it('a tracked simple product at 0 is sold out and cannot be added (booking product)', async () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 0, max_per_order: 2 }));
    expect(result.current.simpleSoldOut).toBe(true);
    expect(result.current.isOutOfStock).toBe(true);
    expect(result.current.isAddBlocked).toBe(true);
    expect(result.current.isAddDisabled).toBe(true);
    expect(result.current.designerBlockedReason).toBe('product.outOfStock');
    await act(async () => {
      await result.current.handleAddToCart();
    });
    expect(addItem).not.toHaveBeenCalled();
  });

  it('a tracked simple product caps the selector at its stock (booking product)', () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 4, max_per_order: 9 }));
    expect(result.current.maxStock).toBe(4);
    expect(result.current.maxQuantity).toBe(4);
    expect(result.current.isAddBlocked).toBe(false);
  });

  it('max_per_order caps the selector below stock and goes on the line', () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 10, max_per_order: 2 }));
    expect(result.current.maxQuantity).toBe(2);
    expect(result.current.lineSource.maxPerOrder).toBe(2);
  });

  it('max_per_order caps a variant product too (lower variant stock wins)', () => {
    const { result } = render(simple({ max_per_order: 3, variants: [TWO_DATES[0]!] }));
    expect(result.current.maxQuantity).toBe(2);
  });

  it('hides bundle offers putting more units in the cart than the limit', () => {
    const { result } = render(simple({ max_per_order: 2, bundles: BUNDLES }));
    expect(result.current.bundles?.[0]?.offers.map((o) => o.id)).toEqual(['o2']);
    const { result: none } = render(simple({ max_per_order: 1, bundles: BUNDLES }));
    expect(none.current.bundles).toEqual([]);
  });

  it('?qty=3 pre-fills 3 and never adds to the cart', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=3');
    const { result } = render(simple());
    expect(result.current.quantity).toBe(3);
    expect(addItem).not.toHaveBeenCalled();
  });

  it('?qty=99 is clamped to the per-order limit and to stock', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=99');
    const { result } = render(simple({ max_per_order: 4 }));
    expect(result.current.quantity).toBe(4);
    const { result: stock } = render(simple({ track_inventory: true, stock_quantity: 2, max_per_order: 4 }));
    expect(stock.current.quantity).toBe(2);
  });

  it('?qty then a bundle pick: the quantity becomes a multiple of the bundle', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=3');
    const { result } = render(simple({ bundles: BUNDLES }));
    expect(result.current.quantity).toBe(3);
    act(() => result.current.handleSelectBundle('o2'));
    expect(result.current.quantity % 2).toBe(0);
    expect(result.current.quantity).toBe(2);
  });

  it('?qty=abc is ignored', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=abc');
    const { result } = render(simple({ max_per_order: 4 }));
    expect(result.current.quantity).toBe(1);
  });

  it('a link quantity is clamped again once a variant with lower stock is picked', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=5');
    const { result } = render(simple({ variants: TWO_DATES }));
    expect(result.current.quantity).toBe(5);
    act(() => result.current.setSelectedVariantId('v1'));
    expect(result.current.quantity).toBe(2);
  });

  it('without ?qty a variant switch keeps the quantity (no new clamp)', () => {
    const { result } = render(simple({ variants: TWO_DATES }));
    act(() => result.current.setSelectedVariantId('v2'));
    act(() => result.current.setQuantity(5));
    act(() => result.current.setSelectedVariantId('v1'));
    expect(result.current.quantity).toBe(5);
  });

  it('server render shows 1 even with ?qty (pre-fill is client-only)', () => {
    window.history.replaceState(null, '', '/en/products/course?qty=3');
    function Qty() {
      return <span data-q={useProductPageState().quantity} />;
    }
    const html = renderToString(
      <ProductPageStateProvider product={simple()} locale="en" primaryLocale="en" currency="SEK">
        <Qty />
      </ProductPageStateProvider>,
    );
    expect(html).toContain('data-q="1"');
  });
});

describe('quantity limit message', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/en/products/course');
  });

  it('appears only when the picker reaches the per-order limit', () => {
    const { result } = render(simple({ max_per_order: 2 }));
    expect(result.current.quantityLimitMessage).toBeNull();
    act(() => result.current.handleQuantityChange(2));
    expect(result.current.quantityLimitMessage).toBe('product.maxQuantityReached');
    act(() => result.current.handleQuantityChange(1));
    expect(result.current.quantityLimitMessage).toBeNull();
  });

  it('is never set for a product without a limit or for a sold-out one', () => {
    const plain = render(simple({ track_inventory: true, stock_quantity: 1 }));
    expect(plain.result.current.quantityLimitMessage).toBeNull();
    const soldOut = render(simple({ max_per_order: 2, track_inventory: true, stock_quantity: 0 }));
    expect(soldOut.result.current.quantityLimitMessage).toBeNull();
  });
});
