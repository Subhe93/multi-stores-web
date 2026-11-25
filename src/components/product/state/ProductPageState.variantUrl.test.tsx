import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Variant URLs (M170 B): `initialVariantId` (from `?variant=`) selects the
// variant on the first render, and `syncVariantUrl` keeps the parameter in
// step with the selection through history.replaceState. The page load (mount
// and the personalization URL prefill) never writes the URL.

// What the stubbed personalization app does on mount, like the real hook's
// URL prefill effect: report option picks and the variant they resolve to.
let prefill: { picks: Record<string, string>; variantId: string | undefined } | null = null;
let urlPrefillAliases: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (k: string) => k }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: (input: {
    onPrefillOptions?: (picks: Record<string, string>, variantId: string | undefined) => void;
  }) => {
    useEffect(() => {
      if (prefill) input.onPrefillOptions?.(prefill.picks, prefill.variantId);
      // Mount only, like the real hook.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return {
      appOn: false,
      appSettings: { url_prefill: urlPrefillAliases },
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
    };
  },
}));

import { ProductPageStateProvider, useProductPageState } from './ProductPageState';

const IMG = (name: string) => `https://cdn.test/${name}.jpg`;
const RED = '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11';
const BLUE = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const UNKNOWN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const BASE_URL = '/en/products/mug';

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
    images: [{ id: 'i1', url: IMG('base-1') }, { id: 'i2', url: IMG('base-2') }],
    variants: [
      { id: RED, sku: 'MUG-RED', price: 120, compare_at_price: 150, stock: 5, options: { Color: 'Red' }, images: [{ url: IMG('red-variant') }] },
      { id: BLUE, sku: 'MUG-BLUE', price: 110, stock: 0, options: { Color: 'Blue' } },
    ],
    variant_option_config: [{ name: 'Color', style: 'swatch', imageMap: { Blue: IMG('blue-value') } }],
    ...overrides,
  };
}

type VariantProps = { initialVariantId?: string; syncVariantUrl?: boolean };

function wrapperFor(product: ProductData, props: VariantProps = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK" {...props}>
        {children}
      </ProductPageStateProvider>
    );
  };
}

const render = (props: VariantProps = {}, product = makeProduct()) =>
  renderHook(() => useProductPageState(), { wrapper: wrapperFor(product, props) });

const singleVariantProduct = () =>
  makeProduct({ variants: [{ id: RED, price: 120, stock: 5, options: { Color: 'Red' } }] });

// Calls the page made to history.replaceState, as URLs without the origin.
let replaceState: MockInstance<typeof window.history.replaceState>;
const written = () => replaceState.mock.calls.map((c) => String(c[2]).replace(window.location.origin, ''));

function select(result: { current: ReturnType<typeof useProductPageState> }, color: string | null, id: string | undefined) {
  act(() => {
    result.current.setOptionSelections(color ? { Color: color } : {});
    result.current.setSelectedVariantId(id);
  });
}

/** Sets the landing URL, then starts recording the page's own writes. */
function landOn(url: string) {
  window.history.replaceState(null, '', url);
  replaceState.mockClear();
}

beforeEach(() => {
  prefill = null;
  urlPrefillAliases = {};
  window.history.replaceState(null, '', BASE_URL);
  replaceState = vi.spyOn(window.history, 'replaceState');
});
afterEach(() => {
  replaceState.mockRestore();
  window.history.replaceState(null, '', '/');
});

describe('ProductPageState initialVariantId', () => {
  it('first render shows the price, compare-at, stock, SKU and lead image of that variant', () => {
    const { result } = render({ initialVariantId: RED });
    expect(result.current.selectedVariantId).toBe(RED);
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
    expect(result.current.currentPrice).toBe(120);
    expect(result.current.displayComparePrice).toBe(150);
    expect(result.current.sku).toBe('MUG-RED');
    expect(result.current.maxStock).toBe(5);
    expect(result.current.leadImageUrl).toBe(IMG('red-variant'));
    expect(result.current.needsVariantSelection).toBe(false);
    expect(result.current.isAddDisabled).toBe(false);
    expect(result.current.isOutOfStock).toBe(false);
  });

  it('an out-of-stock variant is preselected and shown as out of stock', () => {
    const { result } = render({ initialVariantId: BLUE });
    expect(result.current.selectedVariantId).toBe(BLUE);
    expect(result.current.currentPrice).toBe(110);
    expect(result.current.leadImageUrl).toBe(IMG('blue-value'));
    expect(result.current.isOutOfStock).toBe(true);
    expect(result.current.isAddDisabled).toBe(true);
  });

  it('without it (and with syncVariantUrl alone) the first render is the same as before', () => {
    const before = render().result.current;
    const synced = render({ syncVariantUrl: true }).result.current;
    for (const state of [before, synced]) {
      expect(state.selectedVariantId).toBeUndefined();
      expect(state.selectedVariant).toBeNull();
      expect(state.optionSelections).toEqual({});
      expect(state.currentPrice).toBe(100);
      expect(state.displayComparePrice).toBeUndefined();
      expect(state.sku).toBeNull();
      expect(state.galleryImages.map((i) => i.url)).toEqual([IMG('base-1'), IMG('base-2')]);
      expect(state.needsVariantSelection).toBe(true);
    }
  });

  it('an id that is not a variant of the product is ignored', () => {
    const { result } = render({ initialVariantId: UNKNOWN });
    expect(result.current.selectedVariantId).toBeUndefined();
    expect(result.current.optionSelections).toEqual({});
    expect(result.current.currentPrice).toBe(100);
  });

  it('a single-variant product is auto-selected as before', () => {
    const { result } = render({ syncVariantUrl: true }, singleVariantProduct());
    expect(result.current.selectedVariantId).toBe(RED);
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
  });
});

describe('ProductPageState syncVariantUrl', () => {
  it('mount never touches the URL, with or without a preselected variant', () => {
    render({ syncVariantUrl: true });
    render({ syncVariantUrl: true, initialVariantId: RED });
    expect(written()).toEqual([]);
  });

  it('an invalid ?variant= stays in the address bar until the shopper picks something', () => {
    landOn(`${BASE_URL}?variant=zzz&utm_source=g`);
    const { result } = render({ syncVariantUrl: true });
    expect(written()).toEqual([]);
    expect(window.location.search).toBe('?variant=zzz&utm_source=g');
    select(result, 'Red', RED);
    expect(window.location.search).toBe(`?variant=${RED}&utm_source=g`);
  });

  it('writes the id on a complete selection, replaces it on a switch, keeps other parameters and the hash', () => {
    landOn(`${BASE_URL}?utm_source=g&design=abc#reviews`);
    const { result } = render({ syncVariantUrl: true });
    select(result, 'Red', RED);
    select(result, 'Blue', BLUE);
    expect(written()).toEqual([
      `${BASE_URL}?utm_source=g&design=abc&variant=${RED}#reviews`,
      `${BASE_URL}?utm_source=g&design=abc&variant=${BLUE}#reviews`,
    ]);
    // replaceState with a null state: no navigation, no new history entry.
    expect(replaceState.mock.calls.every((c) => c[0] === null)).toBe(true);
  });

  it('removes the parameter when the selection becomes incomplete', () => {
    landOn(`${BASE_URL}?variant=${RED}&utm=1`);
    const { result } = render({ syncVariantUrl: true, initialVariantId: RED });
    select(result, null, undefined);
    expect(written()).toEqual([`${BASE_URL}?utm=1`]);
    // Picking the same variant again writes it back.
    select(result, 'Red', RED);
    expect(window.location.search).toBe(`?utm=1&variant=${RED}`);
  });

  it('a partial pick that resolves no variant writes nothing', () => {
    const { result } = render({ syncVariantUrl: true });
    act(() => result.current.setOptionSelections({ Color: 'Red' }));
    expect(written()).toEqual([]);
  });

  it('never writes without syncVariantUrl (quick-add dialog, builder preview)', () => {
    const { result } = render({ initialVariantId: RED });
    select(result, 'Blue', BLUE);
    select(result, null, undefined);
    expect(written()).toEqual([]);
    expect(window.location.search).toBe('');
  });

  it('never writes for a single-variant product', () => {
    const { result } = render({ syncVariantUrl: true }, singleVariantProduct());
    select(result, null, undefined);
    select(result, 'Red', RED);
    expect(written()).toEqual([]);
  });

  it('a prefill alias named variant turns the sync off', () => {
    urlPrefillAliases = { variant: 'option:Color' };
    const { result } = render({ syncVariantUrl: true });
    select(result, 'Red', RED);
    select(result, null, undefined);
    expect(written()).toEqual([]);
  });

  it('another prefill alias leaves the sync on', () => {
    urlPrefillAliases = { color: 'option:Color' };
    const { result } = render({ syncVariantUrl: true });
    select(result, 'Red', RED);
    expect(written()).toEqual([`${BASE_URL}?variant=${RED}`]);
  });
});

describe('ProductPageState variant URL and the personalization URL prefill', () => {
  it('a ?color= prefill that resolves a variant on load selects it without writing the URL', () => {
    landOn(`${BASE_URL}?color=red`);
    prefill = { picks: { Color: 'Red' }, variantId: RED };
    const { result } = render({ syncVariantUrl: true });
    expect(result.current.selectedVariantId).toBe(RED);
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
    expect(written()).toEqual([]);
    expect(window.location.search).toBe('?color=red');
    // The shopper's own pick afterwards is written.
    select(result, 'Blue', BLUE);
    expect(written()).toEqual([`${BASE_URL}?color=red&variant=${BLUE}`]);
  });

  it('a partial prefill (no variant resolved) keeps its picks and writes nothing', () => {
    prefill = { picks: { Color: 'Red' }, variantId: undefined };
    const { result } = render({ syncVariantUrl: true });
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
    expect(result.current.selectedVariantId).toBeUndefined();
    expect(written()).toEqual([]);
  });

  it('?variant= wins: the option picks of the prefill are ignored', () => {
    prefill = { picks: { Color: 'Blue' }, variantId: BLUE };
    const { result } = render({ syncVariantUrl: true, initialVariantId: RED });
    expect(result.current.selectedVariantId).toBe(RED);
    expect(result.current.optionSelections).toEqual({ Color: 'Red' });
    expect(result.current.currentPrice).toBe(120);
    expect(written()).toEqual([]);
  });

  it('an ignored initialVariantId does not block the prefill', () => {
    prefill = { picks: { Color: 'Blue' }, variantId: BLUE };
    const { result } = render({ syncVariantUrl: true, initialVariantId: UNKNOWN });
    expect(result.current.selectedVariantId).toBe(BLUE);
    expect(written()).toEqual([]);
  });

  it('without syncVariantUrl the prefill behaves as before', () => {
    prefill = { picks: { Color: 'Blue' }, variantId: BLUE };
    const { result } = render();
    expect(result.current.selectedVariantId).toBe(BLUE);
    expect(result.current.optionSelections).toEqual({ Color: 'Blue' });
    expect(written()).toEqual([]);
  });
});
