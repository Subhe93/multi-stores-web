import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { SectionRenderProps } from '@/themes/types';
import { formatPrice } from '@/lib/format';

// Product-page coupon banner (campaign link / applied coupon): display rules,
// pending-first order with fallback to the applied coupon, the request
// figures, linear estimate while a re-query is pending, variant and quantity
// changes, errors (nothing shown) and the price block's show_coupon setting.

const apiMock = vi.fn<(endpoint: string, options?: { body?: string; signal?: AbortSignal }) => Promise<unknown>>();
const removeCoupon = vi.fn(() => Promise.resolve());
const discardPendingCoupon = vi.fn();
let cartValue: Record<string, unknown> = {};
let companyView = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k} ${JSON.stringify(values)}` : k),
    { rich: (k: string, values?: Record<string, unknown>) => `${k} ${String(values?.code ?? '')}` },
  );
  return { useLocale: () => 'en', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => cartValue }));
vi.mock('@/hooks/useDisplayPrice', () => ({
  // b2b company view: a net display (gross / 1.25) like useDisplayPrice gives.
  useDisplayPrice: () => (amount: number) => ({ amount: companyView ? Math.round((amount / 1.25) * 100) / 100 : amount }),
}));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: (endpoint: string, options?: { body?: string; signal?: AbortSignal }) => apiMock(endpoint, options) };
});
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

import { ProductCouponBanner, COUPON_PREVIEW_DEBOUNCE_MS } from './ProductCouponBanner';
import { COUPON_PREVIEW_RETRY_MS } from '@/lib/couponPreview';
import { ProductPageStateProvider, useProductPageState, type ProductPageState } from './state/ProductPageState';
import { ProductPriceBlock } from '@/themes/minimal/sections/product/blocks/ProductPriceBlock.client';

const SEK = (n: number) => formatPrice(n, 'SEK', 'en');

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
    images: [],
    variants: [],
    ...overrides,
  };
}

// The latest shared state, captured after each render for the test's clicks.
const holder: { state: ProductPageState | null } = { state: null };
function Capture() {
  const state = useProductPageState();
  useEffect(() => {
    holder.state = state;
  });
  return null;
}

function renderBanner(product: ProductData = makeProduct(), extra?: ReactNode) {
  return render(
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <Capture />
      {extra ?? <ProductCouponBanner />}
    </ProductPageStateProvider>,
  );
}

function preview(over: Record<string, unknown> = {}) {
  return {
    code: 'SUMMER20',
    discount_kind: 'percentage',
    percent: 20,
    amount: null,
    free_shipping: false,
    applies: true,
    min_amount: null,
    min_quantity: null,
    min_met: true,
    discount_amount: 20,
    ...over,
  };
}

function apiError(status: number, code?: string) {
  return Object.assign(new Error('x'), { status, code });
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(COUPON_PREVIEW_DEBOUNCE_MS + 10); });
/** Runs every transient-error retry of the banner. */
const retryAll = () =>
  act(async () => { await vi.advanceTimersByTimeAsync(COUPON_PREVIEW_RETRY_MS.reduce((a, b) => a + b, 0) + 100); });
const lastBody = () => JSON.parse(String(apiMock.mock.calls[apiMock.mock.calls.length - 1][1]?.body)) as Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  apiMock.mockReset();
  removeCoupon.mockClear();
  discardPendingCoupon.mockClear();
  companyView = false;
  holder.state = null;
  cartValue = {
    items: [
      { productId: 'other', price: 25, quantity: 2 },
      // Hidden in the market: excluded from subtotal and count.
      { productId: 'gone', price: 999, quantity: 5, unavailableInMarket: true },
    ],
    coupon: null,
    pendingCouponCode: 'SUMMER20',
    storeId: 'store-1',
    marketKey: undefined,
    marketPreview: false,
    removeCoupon,
    discardPendingCoupon,
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProductCouponBanner', () => {
  it('percentage + applies + min met: discounted line price, regular struck through, cart figures sent', async () => {
    apiMock.mockResolvedValue(preview({ discount_amount: 20 }));
    renderBanner();
    expect(screen.queryByTestId('coupon-banner')).toBeNull();
    await flush();

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock.mock.calls[0][0]).toBe('/promotions/coupon-preview');
    expect(lastBody()).toEqual({
      coupon_code: 'SUMMER20',
      store_id: 'store-1',
      product_id: 'p1',
      line_amount: 100,
      cart_subtotal: 150,
      item_count: 3,
      // The units behind line_amount (provider-cost floor, never estimated).
      quantity: 1,
    });
    const banner = screen.getByTestId('coupon-banner');
    expect(banner.getAttribute('role')).toBe('status');
    // A link code not applied to the cart yet: neutral wording, never "active".
    expect(banner.textContent).toContain('product.couponPendingCheckout SUMMER20');
    expect(banner.textContent).not.toContain('product.couponActive');
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(JSON.stringify({ price: SEK(80) }));
    expect(banner.querySelector('.line-through')?.textContent).toBe(SEK(100));
  });

  it('an applied coupon reads as active', async () => {
    cartValue = { ...cartValue, pendingCouponCode: null, coupon: { code: 'SUMMER20', discount: 20, type: 'percentage' } };
    apiMock.mockResolvedValue(preview({ discount_amount: 20 }));
    renderBanner();
    await flush();
    expect(screen.getByTestId('coupon-banner').textContent).toContain('product.couponActive SUMMER20');
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(JSON.stringify({ price: SEK(80) }));
  });

  it('sends the market fields like the cart', async () => {
    cartValue = { ...cartValue, marketKey: 'de', marketPreview: true };
    apiMock.mockResolvedValue(preview());
    renderBanner();
    await flush();
    expect(lastBody()).toMatchObject({ market: 'de', preview: true });
  });

  it('minimum not met: condition text, no price', async () => {
    apiMock.mockResolvedValue(preview({ min_amount: 500, min_quantity: 4, min_met: false, discount_amount: null }));
    renderBanner();
    await flush();
    const banner = screen.getByTestId('coupon-banner');
    expect(banner.textContent).toContain(`product.couponMinAmount ${JSON.stringify({ amount: SEK(500) })}`);
    expect(banner.textContent).toContain('product.couponMinQuantity {"count":4}');
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
  });

  it('fixed: amount off the order, no per-item price', async () => {
    apiMock.mockResolvedValue(preview({ discount_kind: 'fixed', percent: null, amount: 50, discount_amount: 50 }));
    renderBanner();
    await flush();
    expect(screen.getByTestId('coupon-banner').textContent).toContain(`product.couponFixedOff ${JSON.stringify({ amount: SEK(50) })}`);
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
  });

  it('free shipping: mentions free shipping', async () => {
    apiMock.mockResolvedValue(preview({ discount_kind: null, percent: null, free_shipping: true, discount_amount: null }));
    renderBanner();
    await flush();
    expect(screen.getByTestId('coupon-banner').textContent).toContain('product.couponFreeShipping');
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
  });

  it('below_cost (marketplace provider-cost floor): muted note, no price, no green banner', async () => {
    apiMock.mockResolvedValue(preview({ applies: false, below_cost: true, discount_amount: null }));
    renderBanner();
    await flush();
    expect(screen.queryByTestId('coupon-banner')).toBeNull();
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
    expect(screen.queryByTestId('coupon-banner-na')).toBeNull();
    expect(screen.getByTestId('coupon-banner-below-cost').textContent).toBe('product.couponBelowCost {"code":"SUMMER20"}');
  });

  it('applies:false: muted one-line note only', async () => {
    apiMock.mockResolvedValue(preview({ applies: false, discount_amount: null }));
    renderBanner();
    await flush();
    expect(screen.queryByTestId('coupon-banner')).toBeNull();
    expect(screen.getByTestId('coupon-banner-na').textContent).toBe('product.couponNotApplicable {"code":"SUMMER20"}');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('invalid pending code: nothing when there is no applied coupon', async () => {
    apiMock.mockRejectedValue(apiError(400, 'PROMOTION_COUPON_INVALID'));
    const { container } = renderBanner();
    await flush();
    await flush();
    expect(container.textContent).toBe('');
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it('invalid pending code falls back to the applied coupon; X removes the applied coupon', async () => {
    cartValue = { ...cartValue, pendingCouponCode: 'DEAD', coupon: { code: 'APPLIED10', discount: 10, type: 'percentage' } };
    apiMock.mockImplementation((_e, o) => {
      const body = JSON.parse(String(o?.body));
      return body.coupon_code === 'DEAD'
        ? Promise.reject(apiError(400, 'PROMOTION_COUPON_INVALID'))
        : Promise.resolve(preview({ code: 'APPLIED10', percent: 10, discount_amount: 10 }));
    });
    renderBanner();
    await flush();
    await flush();
    expect(apiMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body)).coupon_code)).toEqual(['DEAD', 'APPLIED10']);
    expect(screen.getByTestId('coupon-banner').textContent).toContain('APPLIED10');
    fireEvent.click(screen.getByRole('button', { name: 'cart.removeCoupon' }));
    expect(removeCoupon).toHaveBeenCalledTimes(1);
    expect(discardPendingCoupon).not.toHaveBeenCalled();
  });

  it('previews the pending code first even with an applied coupon; X discards the pending code', async () => {
    cartValue = { ...cartValue, coupon: { code: 'APPLIED10', discount: 10, type: 'percentage' } };
    apiMock.mockResolvedValue(preview());
    renderBanner();
    await flush();
    expect(lastBody().coupon_code).toBe('SUMMER20');
    fireEvent.click(screen.getByRole('button', { name: 'cart.removeCoupon' }));
    expect(discardPendingCoupon).toHaveBeenCalledTimes(1);
    expect(removeCoupon).not.toHaveBeenCalled();
  });

  it('rate limit / network error that outlasts the retries: shows nothing (never a guessed price), even with a cached preview', async () => {
    apiMock.mockResolvedValueOnce(preview());
    const first = renderBanner();
    await flush();
    expect(screen.getByTestId('coupon-banner')).toBeTruthy();
    first.unmount();

    apiMock.mockRejectedValue(apiError(429));
    renderBanner();
    // The cached static fields render at once, but a pending code shows no
    // discounted price from the cache alone (no server answer yet)...
    expect(screen.getByTestId('coupon-banner')).toBeTruthy();
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
    await flush();
    await retryAll();
    // ...and once every retry failed too, the banner is hidden.
    expect(apiMock).toHaveBeenCalledTimes(2 + COUPON_PREVIEW_RETRY_MS.length);
    expect(screen.queryByTestId('coupon-banner')).toBeNull();

    cleanup();
    apiMock.mockReset();
    apiMock.mockRejectedValue(new TypeError('Failed to fetch'));
    sessionStorage.clear();
    const { container } = renderBanner();
    await flush();
    await retryAll();
    expect(apiMock).toHaveBeenCalledTimes(1 + COUPON_PREVIEW_RETRY_MS.length);
    expect(container.textContent).toBe('');
  });

  it('a 429 followed by a successful retry shows the discounted price', async () => {
    apiMock.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(preview({ discount_amount: 20 }));
    renderBanner();
    await flush();
    // Nothing known yet (no cache): nothing shown while the retry waits.
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('coupon-banner')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_PREVIEW_RETRY_MS[0] + 10); });
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('coupon-banner').textContent).toContain('product.couponPendingCheckout SUMMER20');
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(JSON.stringify({ price: SEK(80) }));
  });

  it('a cached static block plus a 429 keeps the code line, without a price, while retrying', async () => {
    apiMock.mockResolvedValueOnce(preview());
    const first = renderBanner();
    await flush();
    first.unmount();

    apiMock.mockRejectedValueOnce(apiError(429)).mockRejectedValueOnce(apiError(503));
    renderBanner();
    await flush();
    // First retry pending: the cached line stays, no price for a pending code.
    expect(screen.getByTestId('coupon-banner').textContent).toContain('product.couponPendingCheckout SUMMER20');
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_PREVIEW_RETRY_MS[0] + 10); });
    // A 5xx is transient too: still the line, still no price.
    expect(screen.getByTestId('coupon-banner').textContent).toContain('SUMMER20');
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
    apiMock.mockResolvedValueOnce(preview({ discount_amount: 20 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_PREVIEW_RETRY_MS[1] + 10); });
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(JSON.stringify({ price: SEK(80) }));
  });

  it('a non-transient error (400 other than invalid) is not retried', async () => {
    apiMock.mockRejectedValue(apiError(400, 'MARKET_NOT_AVAILABLE'));
    const { container } = renderBanner();
    await flush();
    await retryAll();
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
  });

  it('quantity change: linear estimate at once, then the server amount for the new figures', async () => {
    apiMock.mockResolvedValueOnce(preview({ discount_amount: 20 }));
    renderBanner();
    await flush();

    apiMock.mockResolvedValueOnce(preview({ discount_amount: 39.99 }));
    act(() => holder.state!.handleQuantityChange(2));
    // Before the debounce: 20 scaled to the 200 line = 40 off.
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(SEK(160));
    expect(screen.getByTestId('coupon-banner').querySelector('.line-through')?.textContent).toBe(SEK(200));
    await flush();
    expect(lastBody()).toMatchObject({ line_amount: 200, cart_subtotal: 250, item_count: 4 });
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(SEK(160.01));
  });

  it('rapid quantity changes: one request for the final figures (stale ones never sent)', async () => {
    apiMock.mockResolvedValue(preview());
    renderBanner();
    await flush();
    apiMock.mockClear();
    act(() => holder.state!.handleQuantityChange(2));
    act(() => holder.state!.handleQuantityChange(3));
    act(() => holder.state!.handleQuantityChange(4));
    await flush();
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(lastBody()).toMatchObject({ line_amount: 400, item_count: 6 });
  });

  it('variant change: the variant price is the line amount', async () => {
    const product = makeProduct({
      variants: [
        { id: 'v-a', price: 120, stock: 5, options: { Size: 'S' } },
        { id: 'v-b', price: 150, stock: 5, options: { Size: 'L' } },
      ],
    });
    apiMock.mockResolvedValue(preview({ discount_amount: 24 }));
    renderBanner(product);
    await flush();
    act(() => {
      holder.state!.setOptionSelections({ Size: 'L' });
      holder.state!.setSelectedVariantId('v-b');
    });
    apiMock.mockResolvedValueOnce(preview({ discount_amount: 30 }));
    await flush();
    expect(lastBody()).toMatchObject({ product_id: 'p1', line_amount: 150, cart_subtotal: 200 });
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(SEK(120));
  });

  it('min becomes met after a quantity change: the price appears', async () => {
    apiMock.mockResolvedValueOnce(preview({ min_quantity: 4, min_met: false, discount_amount: null }));
    renderBanner();
    await flush();
    expect(screen.queryByTestId('coupon-banner-price')).toBeNull();
    apiMock.mockResolvedValueOnce(preview({ min_quantity: 4, min_met: true, discount_amount: 40 }));
    act(() => holder.state!.handleQuantityChange(2));
    await flush();
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(SEK(160));
  });

  it('b2b company view: prices go through the same display helper as the price', async () => {
    companyView = true;
    apiMock.mockResolvedValue(preview({ discount_amount: 20 }));
    renderBanner();
    await flush();
    expect(screen.getByTestId('coupon-banner-price').textContent).toContain(SEK(64));
    expect(screen.getByTestId('coupon-banner').querySelector('.line-through')?.textContent).toBe(SEK(80));
  });

  it('nothing without a pending or applied code (no request)', async () => {
    cartValue = { ...cartValue, pendingCouponCode: null, coupon: null };
    const { container } = renderBanner();
    await flush();
    expect(container.textContent).toBe('');
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe('product-price block show_coupon', () => {
  const blockProps = (settings: Record<string, unknown>) =>
    ({ settings, locale: 'en', product: { id: 'p1' } }) as unknown as SectionRenderProps;

  it('shows the banner by default and hides it with show_coupon: false', async () => {
    apiMock.mockResolvedValue(preview());
    const shown = renderBanner(makeProduct(), <ProductPriceBlock {...blockProps({})} />);
    await flush();
    expect(screen.getByTestId('coupon-banner')).toBeTruthy();
    shown.unmount();

    renderBanner(makeProduct(), <ProductPriceBlock {...blockProps({ show_coupon: false })} />);
    await flush();
    expect(screen.queryByTestId('coupon-banner')).toBeNull();
  });
});
