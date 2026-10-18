import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, pendingCouponStorageKey, type CheckoutSettings } from '@/lib/checkoutSettings';
import { GUEST_CART_KEY } from '@/lib/guestCart';

// Coupon auto-apply (M5 W2-A): a campaign link `?coupon1=CODE` on any store
// page is captured, stripped from the URL, remembered per store and applied
// through the regular coupon flow once the cart has a line. Stores on the
// defaults never read the URL (G0).

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

function Probe() {
  const { coupon, couponNotice, items, loading } = useCart();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="items">{items.length}</span>
      <span data-testid="coupon">{coupon?.code ?? ''}</span>
      <span data-testid="notice">{couponNotice ? `${couponNotice.status}:${couponNotice.code}` : ''}</span>
    </div>
  );
}

function mount(settings: CheckoutSettings | null) {
  return render(
    <CheckoutSettingsProvider value={settings}>
      <CartProvider token={null} storeId="s1">
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>,
  );
}

const ON = normalizeCheckoutSettings({ coupon_autoapply: true, coupon_param: ['coupon', 'coupon1'] });
const LINE = { id: 'local_1', productId: 'p1', title: 'Mug', price: 100, quantity: 1 };

describe('CartProvider coupon auto-apply', () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
    window.history.replaceState(null, '', '/products/mug?utm=x&coupon1=SPRING');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('G0: defaults → the URL is untouched and nothing is applied', async () => {
    mount(null);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(window.location.search).toBe('?utm=x&coupon1=SPRING');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
    expect(screen.getByTestId('notice').textContent).toBe('');
    expect(api).not.toHaveBeenCalled();
  });

  it('empty cart: captured + stripped, kept pending until a line exists', async () => {
    mount(ON);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(window.location.search).toBe('?utm=x');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBe('SPRING');
    expect(screen.getByTestId('notice').textContent).toBe('pending:SPRING');
    expect(api).not.toHaveBeenCalled();
  });

  it('cart with a line: validated through the existing flow and applied (guest)', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockResolvedValueOnce({ valid: true, type: 'PERCENTAGE', value: 10, discount_amount: 10, free_shipping: false });
    mount(ON);
    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('applied:SPRING'));
    expect(api).toHaveBeenCalledTimes(1);
    const [path, init] = api.mock.calls[0] as [string, { body: string }];
    expect(path).toBe('/promotions/validate-coupon');
    expect(JSON.parse(init.body)).toMatchObject({ coupon_code: 'SPRING', store_id: 's1', subtotal: 100, item_count: 1 });
    expect(screen.getByTestId('coupon').textContent).toBe('SPRING');
    // Consumed: not retried on the next page load.
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
  });

  it('an invalid code shows the error notice once and is dropped', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(new Error('COUPON_INVALID'));
    mount(ON);
    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('invalid:SPRING'));
    expect(screen.getByTestId('coupon').textContent).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('a code remembered from an earlier page load is applied without the param', async () => {
    window.history.replaceState(null, '', '/cart');
    localStorage.setItem(pendingCouponStorageKey('s1'), 'LATER');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockResolvedValueOnce({ valid: true, type: 'FIXED', value: 5, discount_amount: 5, free_shipping: false });
    mount(ON);
    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('applied:LATER'));
    expect(screen.getByTestId('coupon').textContent).toBe('LATER');
  });

  it('logged-in: the server cart is also told (POST /cart/apply-coupon)', async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith('/cart?') || path === '/cart') return Promise.resolve({ items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }], coupon: null });
      if (path === '/promotions/validate-coupon') return Promise.resolve({ valid: true, type: 'PERCENTAGE', value: 10, discount_amount: 10, free_shipping: false });
      if (path === '/cart/apply-coupon') return Promise.resolve({});
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => {
      render(
        <CheckoutSettingsProvider value={ON}>
          <CartProvider token="tok" storeId="s1">
            <Probe />
          </CartProvider>
        </CheckoutSettingsProvider>,
      );
    });
    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('applied:SPRING'));
    expect(api.mock.calls.map((c) => c[0])).toContain('/cart/apply-coupon');
  });
});
