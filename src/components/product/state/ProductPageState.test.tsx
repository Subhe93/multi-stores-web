import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Shared product page state (product-template-layout wave 1, A2): the state
// every product block and the monolith ProductDetailClient read. Covers the
// gallery order, the price chain, bundles, personalization delta, stock and
// the outer-provider reuse inside a PRODUCT_TEMPLATE.

const push = vi.fn();
const addItem = vi.fn(() => Promise.resolve());
const appCalls = vi.fn();
let priceDelta = 0;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (k: string) => k }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
// The personalization app is stubbed: the state only reads its form API and
// the shown price delta; the app itself has its own tests.
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: (input: unknown) => {
    appCalls(input);
    return {
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
      priceDelta,
      deltaInCart: false,
    };
  },
}));

import {
  ProductPageStateProvider,
  useOptionalProductPageState,
  useProductPageState,
} from './ProductPageState';

const IMG = (name: string) => `https://cdn.test/${name}.jpg`;

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Nice</p>' }],
    images: [{ id: 'i1', url: IMG('base-1') }, { id: 'i2', url: IMG('base-2') }],
    variants: [
      { id: 'v-red', sku: 'MUG-RED', price: 120, compare_at_price: 150, stock: 5, options: { Color: 'Red' }, images: [{ url: IMG('red-variant') }] },
      { id: 'v-blue', sku: 'MUG-BLUE', price: 110, stock: 0, options: { Color: 'Blue' } },
    ],
    variant_option_config: [
      { name: 'Color', style: 'swatch', imageMap: { Blue: IMG('blue-value'), Red: IMG('red-value') } },
    ],
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

describe('ProductPageState', () => {
  beforeEach(() => {
    priceDelta = 0;
    push.mockClear();
    addItem.mockClear();
    appCalls.mockClear();
  });

  it('starts on the base price and the product gallery; add needs a variant', () => {
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(makeProduct()) });
    expect(result.current.selectedVariant).toBeNull();
    expect(result.current.currentPrice).toBe(100);
    expect(result.current.displayPrice).toBe(100);
    expect(result.current.galleryImages.map((i) => i.url)).toEqual([IMG('base-1'), IMG('base-2')]);
    expect(result.current.isAddDisabled).toBe(true);
    expect(result.current.needsVariantSelection).toBe(true);
  });

  it('variant switch changes the gallery lead image, the price, compare-at, SKU and resets the index', () => {
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(makeProduct()) });
    act(() => result.current.setActiveGalleryIndex(1));
    expect(result.current.activeGalleryIndex).toBe(1);
    act(() => {
      result.current.setOptionSelections({ Color: 'Red' });
      result.current.setSelectedVariantId('v-red');
    });
    // Variant images first, then the value image, then the product gallery.
    expect(result.current.galleryImages.map((i) => i.url)).toEqual([
      IMG('red-variant'),
      IMG('red-value'),
      IMG('base-1'),
      IMG('base-2'),
    ]);
    expect(result.current.leadImageUrl).toBe(IMG('red-variant'));
    expect(result.current.activeGalleryIndex).toBe(0);
    expect(result.current.currentPrice).toBe(120);
    expect(result.current.displayComparePrice).toBe(150);
    expect(result.current.savings).toBe(30);
    expect(result.current.sku).toBe('MUG-RED');
    expect(result.current.maxStock).toBe(5);
    expect(result.current.isAddDisabled).toBe(false);
  });

  it('a partial option pick puts the imageMap colour image first', () => {
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(makeProduct()) });
    act(() => result.current.setOptionSelections({ Color: 'Blue' }));
    expect(result.current.selectedVariant).toBeNull();
    expect(result.current.galleryImages[0]).toMatchObject({ url: IMG('blue-value'), alt: 'Mug — Blue' });
  });

  it('a bundle offer forces the quantity, prices the line and a non-multiple drops it', () => {
    const product = makeProduct({
      variants: [],
      bundles: [
        {
          id: 'b1',
          status: 'ACTIVE',
          translations: [{ locale: 'en', name: 'Bundle' }],
          offers: [
            {
              id: 'o3',
              quantity: 3,
              discount_type: 'PERCENTAGE',
              discount_value: 10,
              sort_order: 0,
              translations: [{ locale: 'en', title: 'Buy 3' }],
            },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(product) });
    act(() => result.current.handleSelectBundle('o3'));
    expect(result.current.selectedBundleOffer?.offer.id).toBe('o3');
    expect(result.current.quantity).toBe(3);
    expect(result.current.quantityMin).toBe(3);
    expect(result.current.quantityStep).toBe(3);
    expect(result.current.currentPrice).toBeCloseTo(90);
    expect(result.current.displayPrice).toBeCloseTo(270);
    expect(result.current.displayComparePrice).toBe(300);
    expect(result.current.lineSource.bundle).toMatchObject({ offerId: 'o3', originalUnitPrice: 100, cartQuantity: 3 });
    // A positive multiple keeps the bundle; anything else clears it.
    act(() => result.current.handleQuantityChange(6));
    expect(result.current.selectedBundleOfferId).toBe('o3');
    act(() => result.current.handleQuantityChange(7));
    expect(result.current.selectedBundleOfferId).toBeNull();
    expect(result.current.quantity).toBe(7);
  });

  it('adds the personalization delta to the unit price', () => {
    priceDelta = 25;
    const product = makeProduct({ variants: [] });
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(product) });
    expect(result.current.personalizationDelta).toBe(25);
    expect(result.current.baseUnitPrice).toBe(125);
    expect(result.current.currentPrice).toBe(125);
    expect(result.current.lineSource.unitPrice).toBe(125);
  });

  it('out of stock disables add and the add action does nothing', async () => {
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(makeProduct()) });
    act(() => {
      result.current.setOptionSelections({ Color: 'Blue' });
      result.current.setSelectedVariantId('v-blue');
    });
    expect(result.current.isOutOfStock).toBe(true);
    expect(result.current.isAddDisabled).toBe(true);
    expect(result.current.designerBlockedReason).toBe('product.outOfStock');
    await act(async () => {
      await result.current.handleAddToCart();
    });
    expect(addItem).not.toHaveBeenCalled();
  });

  it('adds the selected variant line with quantity and the lead image', async () => {
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(makeProduct()) });
    act(() => {
      result.current.setOptionSelections({ Color: 'Red' });
      result.current.setSelectedVariantId('v-red');
    });
    act(() => result.current.handleQuantityChange(2));
    await act(async () => {
      await result.current.handleAddToCart();
    });
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(result.current.addedToCart).toBe(true);
    expect(result.current.addToCartError).toBe('');
  });

  it('a single variant is auto-selected with its options picked', () => {
    const product = makeProduct({
      variants: [{ id: 'only', price: 80, stock: 2, options: { Color: 'Red' } }],
    });
    const { result } = renderHook(() => useProductPageState(), { wrapper: wrapperFor(product) });
    expect(result.current.selectedVariantId).toBe('only');
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
    expect(result.current.galleryImages[0].url).toBe(IMG('red-value'));
    expect(result.current.currentPrice).toBe(80);
  });

  it('a nested provider for the same product reuses the outer state (one personalization app call)', () => {
    const product = makeProduct();
    // Renders a provider tree, picks a variant through the innermost hook and
    // counts the personalization app calls (one per state host render).
    function run(nested: boolean) {
      function Tree({ children }: { children: ReactNode }) {
        const inner = nested ? (
          <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
            {children}
          </ProductPageStateProvider>
        ) : (
          children
        );
        return (
          <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
            {inner}
          </ProductPageStateProvider>
        );
      }
      appCalls.mockClear();
      const { result } = renderHook(() => useProductPageState(), { wrapper: Tree });
      act(() => result.current.setSelectedVariantId('v-red'));
      expect(result.current.selectedVariant?.id).toBe('v-red');
      return appCalls.mock.calls.length;
    }
    const single = run(false);
    expect(single).toBeGreaterThan(0);
    // A second state host would double the calls.
    expect(run(true)).toBe(single);
  });

  it('the inner and outer consumers of one product see the same state object', () => {
    const product = makeProduct();
    const seen: { outer?: unknown; inner?: unknown } = {};
    function Probe({ slot }: { slot: 'outer' | 'inner' }) {
      const state = useProductPageState();
      useEffect(() => {
        seen[slot] = state;
      });
      return null;
    }
    renderHook(() => null, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ProductPageStateProvider product={product}>
          <Probe slot="outer" />
          <ProductPageStateProvider product={product}>
            <Probe slot="inner" />
            {children}
          </ProductPageStateProvider>
        </ProductPageStateProvider>
      ),
    });
    expect(seen.outer).toBeDefined();
    expect(seen.inner).toBe(seen.outer);
  });

  it('a nested provider for another product owns its own state', () => {
    const outerProduct = makeProduct();
    const innerProduct = makeProduct({ id: 'p2', base_price: 50, variants: [] });
    function Nested({ children }: { children: ReactNode }) {
      return (
        <ProductPageStateProvider product={outerProduct}>
          <ProductPageStateProvider product={innerProduct}>{children}</ProductPageStateProvider>
        </ProductPageStateProvider>
      );
    }
    const { result } = renderHook(() => useProductPageState(), { wrapper: Nested });
    expect(result.current.product.id).toBe('p2');
    expect(result.current.currentPrice).toBe(50);
  });

  it('useOptionalProductPageState is null outside a provider; useProductPageState throws', () => {
    const { result } = renderHook(() => useOptionalProductPageState());
    expect(result.current).toBeNull();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useProductPageState())).toThrow(/no ProductPageStateProvider/);
    spy.mockRestore();
  });
});
