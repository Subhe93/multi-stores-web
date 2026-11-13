import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPrice } from '@/lib/format';
import StoreCartPage from './page';
import { resetSavedCountryCache } from '@/hooks/useCartQuote';

// Full cart page: real shipping + totals from POST /orders/quote for the
// market's default destination (same figures as checkout / Kustom).

const h = vi.hoisted(() => ({
  cart: {} as Record<string, unknown>,
  token: null as string | null,
  market: null as unknown,
  isCompany: false,
  tax: null as unknown,
  primaryLocale: undefined as string | undefined,
}));

vi.mock('next-intl', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${Object.values(params).join(',')})` : key;
  t.has = () => false;
  return { useTranslations: () => t, useLocale: () => 'sv' };
});
vi.mock('next/navigation', () => ({
  useParams: () => ({ storeSlug: 'namez-se' }),
  usePathname: () => '/cart',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const api = vi.fn();
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => api(...args),
  resolveMediaUrl: (u?: string) => u ?? '',
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => h.cart }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: h.token }),
  readStoredAccessToken: () => null,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => h.market }));
vi.mock('@/hooks/useStoreTax', () => ({ useStoreTax: () => h.tax }));
vi.mock('@/hooks/useStorePrimaryLocale', () => ({ useStorePrimaryLocale: () => h.primaryLocale }));
vi.mock('@/hooks/useBuyerType', () => ({
  useBuyerType: () => ({ isCompany: h.isCompany, settings: {} }),
}));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/hooks/useDisplayPrice', () => ({ useDisplayPrice: () => (amount: number) => ({ amount }) }));
vi.mock('@/components/cart/UnavailableRemovedNotice', () => ({
  UnavailableRemovedNotice: () => null,
  useCartAvailabilityCheck: () => undefined,
}));
vi.mock('@/components/checkout/CouponAutoApplyNotice', () => ({ CouponAutoApplyNotice: () => null }));
vi.mock('@/components/cart/ReverseChargeCartHint', () => ({ ReverseChargeCartHint: () => null }));
vi.mock('@/components/IfApp', () => ({ IfApp: () => null }));

const LINE = { id: 'local_1', productId: 'p1', title: 'Mug', price: 300, quantity: 1 };
const SEK = (n: number) => formatPrice(n, 'SEK', 'sv');
const quoteCalls = () => api.mock.calls.filter((c) => c[0] === '/orders/quote');
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body);
const shipping = () => screen.getByTestId('cart-shipping').textContent;
const total = () => screen.getByTestId('cart-total').textContent;

function quote(over: Record<string, unknown> = {}) {
  return {
    subtotal: 300, shipping_cost: 49, discount_amount: 0, total: 349, currency: 'SEK',
    tax_lines: [], tax_total: 69.8, tax_pricing_mode: 'INCLUSIVE',
    shipping: { available: true, cost: 49, methods: [], method: null, estimated_days: null },
    ...over,
  };
}

function setCart(over: Record<string, unknown> = {}) {
  h.cart = {
    items: [LINE], loading: false, subtotal: 300, total: 300, discount: 0, coupon: null, currency: 'SEK',
    pricesUpdated: false, handoffDropped: 0, migrationDropped: 0, migrationDropError: null, dismissPricesNotice: vi.fn(),
    taxLines: [], taxPricingMode: 'INCLUSIVE', taxEstimated: false, totalWithTax: 300, b2bNet: null, netItems: null,
    itemCount: 1, updateQuantity: vi.fn(), removeItem: vi.fn(), clearBundle: vi.fn(), clearCart: vi.fn(),
    applyCoupon: vi.fn(), removeCoupon: vi.fn(), hasUnavailableItems: false,
    storeId: 's1', marketKey: 'se', marketPreview: false,
    ...over,
  };
}

describe('cart page real shipping', () => {
  beforeEach(() => {
    api.mockReset();
    localStorage.clear();
    h.token = null;
    h.isCompany = false;
    h.tax = null;
    h.primaryLocale = undefined;
    h.market = { key: 'se', countries: ['SE'], currency: 'SEK' };
    resetSavedCountryCache();
    setCart();
  });

  it('below the free-shipping threshold shows the price, the destination and Totalt incl. shipping', async () => {
    api.mockResolvedValue(quote());
    render(<StoreCartPage />);
    expect(shipping()).toBe('…');
    await waitFor(() => expect(shipping()).toBe(SEK(49)));
    expect(total()).toBe(SEK(349));
    expect(screen.getByText(/^cart\.shippingEstimatedFor\(Sverige\)$/)).toBeInTheDocument();
    expect(screen.queryByText('cart.shippingAddedAtCheckout')).toBeNull();

    expect(quoteCalls()).toHaveLength(1);
    expect(bodyOf(quoteCalls()[0]!)).toEqual({
      store_id: 's1', market_key: 'se', lines: [{ quantity: 1, product_id: 'p1' }],
      country_code: 'SE', locale: 'sv',
    });
  });

  it('above the threshold shows Fri frakt and the quote total', async () => {
    setCart({ items: [{ ...LINE, price: 450 }], subtotal: 450, total: 450 });
    api.mockResolvedValue(quote({ subtotal: 450, shipping_cost: 0, total: 450 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe('checkout.freeShippingLabel'));
    expect(total()).toBe(SEK(450));
    // Free for the default destination only: still labelled as an estimate.
    expect(screen.getByTestId('cart-shipping-estimated').textContent).toBe('cart.shippingEstimatedFor(Sverige)');
  });

  it('a failed quote falls back to "calculated at checkout" with the cart totals', async () => {
    api.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe('cart.calculatedAtCheckout'));
    expect(total()).toBe(SEK(300));
    expect(screen.getByText('cart.shippingAddedAtCheckout')).toBeInTheDocument();
  });

  it('shipping unavailable for the destination is treated as unknown', async () => {
    api.mockResolvedValue(quote({ shipping: { available: false, message: 'no' }, shipping_cost: 0, total: 300 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe('cart.calculatedAtCheckout'));
    expect(total()).toBe(SEK(300));
  });

  it('a free-shipping coupon is sent and its quote shows Fri frakt, the quote discount and total', async () => {
    setCart({
      coupon: { code: 'FRAKT', discount: 10, type: 'percentage', freeShipping: true },
      discount: 30, total: 270,
    });
    api.mockResolvedValue(quote({ shipping_cost: 0, discount_amount: 30, total: 270 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe('checkout.freeShippingLabel'));
    expect(bodyOf(quoteCalls()[0]!).coupon_code).toBe('FRAKT');
    expect(screen.getByTestId('cart-discount').textContent).toBe(`-${SEK(30)}`);
    expect(total()).toBe(SEK(270));
  });

  it('a targeted coupon uses the server discount, so the cart equals checkout', async () => {
    // Client estimate says 40, the order path discounts only the targeted line: 10.
    setCart({ coupon: { code: 'MUG10', discount: 10, type: 'percentage' }, discount: 40, total: 260 });
    api.mockResolvedValue(quote({ discount_amount: 10, total: 339 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(total()).toBe(SEK(339)));
    expect(screen.getByTestId('cart-discount').textContent).toBe(`-${SEK(10)}`);
  });

  it('once quoted, the subtotal row comes from the quote too, so the rows add up', async () => {
    // The server re-priced a line (stale browser price): 320, not 300.
    api.mockResolvedValue(quote({ subtotal: 320, shipping_cost: 49, discount_amount: 32, total: 337 }));
    setCart({ coupon: { code: 'TEN', discount: 10, type: 'percentage' }, discount: 30, total: 270 });
    render(<StoreCartPage />);
    // Before the quote: the cart's own figures.
    expect(screen.getByTestId('cart-subtotal').textContent).toBe(SEK(300));
    await waitFor(() => expect(total()).toBe(SEK(337)));
    expect(screen.getByTestId('cart-subtotal').textContent).toBe(SEK(320));
    expect(screen.getByTestId('cart-discount').textContent).toBe(`-${SEK(32)}`);
    expect(shipping()).toBe(SEK(49));
  });

  it('an empty cart sends no request', async () => {
    setCart({ items: [], subtotal: 0, total: 0, itemCount: 0 });
    render(<StoreCartPage />);
    expect(screen.getByText('cart.empty')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 600));
    expect(quoteCalls()).toHaveLength(0);
  });

  it('a logged-in shopper quotes the server cart (no lines) with the session', async () => {
    h.token = 'jwt';
    api.mockResolvedValue(quote());
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe(SEK(49)));
    const call = quoteCalls()[0]!;
    expect(bodyOf(call).lines).toBeUndefined();
    expect((call[1] as { token?: string }).token).toBe('jwt');
  });

  it('without the markets app the destination follows the store currency (SEK -> SE)', async () => {
    h.market = null;
    setCart({ marketKey: undefined });
    api.mockResolvedValue(quote());
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe(SEK(49)));
    const body = bodyOf(quoteCalls()[0]!);
    expect(body.country_code).toBe('SE');
    expect(body.market_key).toBeUndefined();
  });

  it('EXCLUSIVE store: total before tax, the quote tax lines and the grand total', async () => {
    setCart({ taxPricingMode: 'EXCLUSIVE', totalWithTax: null });
    api.mockResolvedValue(quote({
      tax_pricing_mode: 'EXCLUSIVE', total: 436.25, tax_total: 87.25,
      tax_lines: [{ label: 'Moms', rate_bp: 2500, taxable_amount: 349, tax_amount: 87.25 }],
    }));
    render(<StoreCartPage />);
    await waitFor(() => expect(screen.getByTestId('cart-total-incl-tax').textContent).toBe(SEK(436.25)));
    expect(total()).toBe(SEK(349));
  });

  it('company view sends buyer_type and shows the net shipping and the gross total', async () => {
    h.isCompany = true;
    api.mockResolvedValue(quote({
      b2b: { display_mode: 'excl', net_items: 240, net_shipping: 39.2, net_total: 279.2 },
      tax_lines: [{ label: 'Moms', rate_bp: 2500, taxable_amount: 279.2, tax_amount: 69.8 }],
    }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe(SEK(39.2)));
    expect(bodyOf(quoteCalls()[0]!).buyer_type).toBe('COMPANY');
    expect(total()).toBe(SEK(349));
  });

  it('a quoted cart labels shipping and total as estimates until checkout has the address', async () => {
    api.mockResolvedValue(quote());
    render(<StoreCartPage />);
    // Before the quote: the plain label, no estimate note.
    expect(screen.getByTestId('cart-total-label').textContent).toBe('cart.total');
    expect(screen.queryByTestId('cart-total-estimated')).toBeNull();
    await waitFor(() => expect(shipping()).toBe(SEK(49)));
    expect(screen.getByTestId('cart-total-label').textContent).toBe('cart.estimatedTotal');
    expect(screen.getByTestId('cart-total-estimated').textContent).toBe('cart.finalTotalAtCheckout');
  });

  it('a failed quote keeps the plain Total label (shipping is added at checkout)', async () => {
    api.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    render(<StoreCartPage />);
    await waitFor(() => expect(shipping()).toBe('cart.calculatedAtCheckout'));
    expect(screen.getByTestId('cart-total-label').textContent).toBe('cart.total');
    expect(screen.queryByTestId('cart-total-estimated')).toBeNull();
  });

  it('marketplace store (EUR, en, no market): quotes the store tax country, not GB', async () => {
    h.market = null;
    h.tax = { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true, country: 'SE', registrant: 'PLATFORM' };
    h.primaryLocale = 'en';
    setCart({ currency: 'EUR', marketKey: undefined });
    api.mockResolvedValue(quote({ currency: 'EUR' }));
    render(<StoreCartPage />);
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    expect(bodyOf(quoteCalls()[0]!).country_code).toBe('SE');
  });

  it("marketplace store: a logged-in shopper is quoted for the saved address country", async () => {
    h.market = null;
    h.token = 'jwt-saved';
    h.primaryLocale = 'en';
    h.tax = { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true, country: 'SE', registrant: 'PLATFORM' };
    setCart({ currency: 'EUR', marketKey: undefined });
    api.mockImplementation((endpoint: string) =>
      Promise.resolve(endpoint === '/customers/me/addresses'
        ? [{ id: 'a1', country_code: 'DE' }, { id: 'a2', country_code: 'fi', is_default: true }]
        : quote({ currency: 'EUR' })));
    render(<StoreCartPage />);
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    expect(bodyOf(quoteCalls()[0]!).country_code).toBe('FI');
  });

  it('INDEPENDENT store (Namez): the market country like Kustom, no address read, no wait', async () => {
    h.token = 'jwt-namez';
    h.market = { key: 'shop', countries: ['SE', 'DE'], currency: 'EUR' };
    h.tax = { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true, country: 'SE', registrant: 'STORE' };
    setCart({ currency: 'EUR', marketKey: 'shop' });
    api.mockImplementation((endpoint: string) =>
      Promise.resolve(endpoint === '/customers/me/addresses'
        ? [{ id: 'a1', country_code: 'DE', is_default: true }]
        : quote({ currency: 'EUR' })));
    render(<StoreCartPage />);
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    expect(bodyOf(quoteCalls()[0]!).country_code).toBe('SE');
    expect(api.mock.calls.some((c) => c[0] === '/customers/me/addresses')).toBe(false);
  });

  it('coupon below the provider cost: not applicable, no discount row, re-quoted without it, remove offered', async () => {
    const removeCoupon = vi.fn();
    setCart({ coupon: { code: 'BIG30', discount: 30, type: 'percentage' }, discount: 90, total: 210, removeCoupon });
    api.mockImplementation((_e: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body);
      return body.coupon_code
        ? Promise.reject(Object.assign(new Error('raw english'), { status: 400, code: 'ORDER_DISCOUNT_BELOW_PROVIDER_COST' }))
        : Promise.resolve(quote());
    });
    render(<StoreCartPage />);
    await waitFor(() => expect(screen.getByTestId('cart-coupon-rejected')).toBeInTheDocument());
    expect(quoteCalls()).toHaveLength(2);
    expect(bodyOf(quoteCalls()[0]!).coupon_code).toBe('BIG30');
    expect(bodyOf(quoteCalls()[1]!).coupon_code).toBeUndefined();
    expect(screen.getByText('cart.couponNotApplicableToItems(BIG30)')).toBeInTheDocument();
    expect(screen.queryByTestId('cart-discount')).toBeNull();
    expect(total()).toBe(SEK(349));
    expect(shipping()).toBe(SEK(49));
    screen.getByRole('button', { name: 'cart.removeCoupon' }).click();
    expect(removeCoupon).toHaveBeenCalled();
  });

  it('coupon below cost and the retry fails too: no discount, the cart subtotal as total', async () => {
    setCart({ coupon: { code: 'BIG30', discount: 30, type: 'percentage', freeShipping: true }, discount: 90, total: 210 });
    api.mockRejectedValue(Object.assign(new Error('x'), { status: 400, code: 'PROMOTION_COUPON_BELOW_COST' }));
    render(<StoreCartPage />);
    await waitFor(() => expect(screen.getByTestId('cart-coupon-rejected')).toBeInTheDocument());
    expect(screen.queryByTestId('cart-discount')).toBeNull();
    expect(total()).toBe(SEK(300));
    // The coupon's free shipping does not apply either.
    expect(shipping()).toBe('cart.calculatedAtCheckout');
  });

  it('lines unavailable in the market send no request and keep the fallback', async () => {
    setCart({ hasUnavailableItems: true });
    render(<StoreCartPage />);
    expect(shipping()).toBe('cart.calculatedAtCheckout');
    await new Promise((r) => setTimeout(r, 600));
    expect(quoteCalls()).toHaveLength(0);
  });
});
