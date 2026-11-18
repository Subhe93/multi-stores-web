import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Item 9 (cart stock): the product page puts the stock of the row it adds on
// the line, so the cart never takes more than there is. The page state of
// products without a per-order limit is otherwise unchanged (no new selector
// bound: `ProductPageState.booking.test.tsx` pins that).

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

describe('ProductPageState stock on the line (item 9)', () => {
  beforeEach(() => {
    addItem.mockClear();
    window.history.replaceState(null, '', '/en/products/course');
  });

  it('untracked product: no stock on the line', () => {
    const { result } = render(simple());
    expect('stockOnHand' in result.current.lineSource).toBe(false);
    const untracked = render(simple({ track_inventory: false, stock_quantity: 3 }));
    expect('stockOnHand' in untracked.result.current.lineSource).toBe(false);
  });

  it('tracked product without variants: its number, selectors unchanged', () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 8 }));
    expect(result.current.lineSource.stockOnHand).toBe(8);
    expect(result.current.maxQuantity).toBeUndefined();
  });

  it('imported product without variants: the base product number', () => {
    const { result } = render(simple({ _type: 'custom_product', track_inventory: true, stock_quantity: 5 }));
    expect(result.current.lineSource.stockOnHand).toBe(5);
  });

  it('variants: the selected variant, nothing before a pick, nothing for an untracked one', () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 40, variants: TWO_DATES }));
    expect('stockOnHand' in result.current.lineSource).toBe(false);
    act(() => result.current.setSelectedVariantId('v1'));
    expect(result.current.lineSource.stockOnHand).toBe(2);
    act(() => result.current.setSelectedVariantId('v2'));
    expect(result.current.lineSource.stockOnHand).toBe(9);

    const untracked = render(simple({ variants: [{ id: 'v9', price: 100, stock: 999, options: { Date: '3 May' } }] }));
    expect('stockOnHand' in untracked.result.current.lineSource).toBe(false);
  });

  it('the add carries the stock in the line metadata', async () => {
    const { result } = render(simple({ track_inventory: true, stock_quantity: 8 }));
    await act(async () => {
      await result.current.handleAddToCart();
    });
    expect(addItem).toHaveBeenCalledTimes(1);
    const metadata = (addItem.mock.calls[0] as unknown[])[4] as { stockOnHand?: number };
    expect(metadata.stockOnHand).toBe(8);
  });
});
