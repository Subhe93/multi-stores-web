import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, pendingCouponStorageKey, type CheckoutSettings } from '@/lib/checkoutSettings';
import { GUEST_CART_KEY, GUEST_COUPON_KEY } from '@/lib/guestCart';
import { couponStorageKey } from '@/lib/couponDiscount';

// Coupon correctness (campaign links, logged-in carts, targeted coupons).

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

function Probe() {
  const cart = useCart();
  return (
    <div>
      <span data-testid="loading">{String(cart.loading)}</span>
      <span data-testid="items">{cart.items.length}</span>
      <span data-testid="coupon">{cart.coupon?.code ?? ''}</span>
      <span data-testid="discount">{cart.discount}</span>
      <span data-testid="total">{cart.total}</span>
      <span data-testid="pending">{cart.pendingCouponCode ?? ''}</span>
      <span data-testid="store">{cart.storeId ?? ''}</span>
      <span data-testid="notice">{cart.couponNotice ? `${cart.couponNotice.status}:${cart.couponNotice.code}` : ''}</span>
      <button data-testid="qty2" onClick={() => void cart.updateQuantity(cart.items[0]?.id ?? '', 2).catch(() => {})} />
      <button data-testid="qty1" onClick={() => void cart.updateQuantity(cart.items[0]?.id ?? '', 1).catch(() => {})} />
      <button data-testid="remove" onClick={() => void cart.removeCoupon()} />
      <button data-testid="discard" onClick={() => cart.discardPendingCoupon()} />
      <button data-testid="dismiss" onClick={() => cart.dismissCouponNotice()} />
      <button data-testid="apply" onClick={() => void cart.applyCoupon('TYPED').catch(() => {})} />
    </div>
  );
}

function mount(settings: CheckoutSettings | null, token: string | null = null) {
  return render(
    <CheckoutSettingsProvider value={settings}>
      <CartProvider token={token} storeId="s1">
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>,
  );
}

const ON = normalizeCheckoutSettings({ coupon_autoapply: true, coupon_param: ['coupon', 'coupon1'] });
const LINE = { id: 'local_1', productId: 'p1', title: 'Mug', price: 100, quantity: 1 };
const coded = (code: string, status = 400) => Object.assign(new Error(code), { code, status });
const text = (id: string) => screen.getByTestId(id).textContent;
const validateCalls = () => api.mock.calls.filter((c) => c[0] === '/promotions/validate-coupon');

describe('useCart coupons', () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
    window.history.replaceState(null, '', '/products/mug?coupon=SPRING');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  // ── Bug 1: soft failures keep the link code pending ──

  it('min amount failure keeps the code pending and retries after the cart changes', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(coded('PROMOTION_COUPON_MIN_AMOUNT'));
    mount(ON);
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    await waitFor(() => expect(text('pending')).toBe('SPRING'));
    expect(text('notice')).toBe('pending:SPRING');
    expect(text('coupon')).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBe('SPRING');

    api.mockResolvedValueOnce({ valid: true, type: 'PERCENTAGE', discount_kind: 'percentage', value: 10, discount_amount: 20, free_shipping: false });
    fireEvent.click(screen.getByTestId('qty2'));
    await waitFor(() => expect(text('notice')).toBe('applied:SPRING'));
    expect(validateCalls()).toHaveLength(2);
    expect(text('coupon')).toBe('SPRING');
    expect(text('pending')).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
  });

  it('older API plain "Minimum ..." message is soft too', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(Object.assign(new Error('Minimum 2 items required'), { status: 400 }));
    mount(ON);
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    await waitFor(() => expect(text('pending')).toBe('SPRING'));
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBe('SPRING');
  });

  it('NOT_APPLICABLE is not retried on the same cart', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValue(coded('PROMOTION_COUPON_NOT_APPLICABLE'));
    mount(ON);
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(validateCalls()).toHaveLength(1);
    expect(text('pending')).toBe('SPRING');
  });

  it('expired / invalid codes are discarded', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(coded('PROMOTION_COUPON_EXPIRED'));
    mount(ON);
    await waitFor(() => expect(text('notice')).toBe('invalid:SPRING'));
    expect(text('pending')).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
  });

  // ── Bug 2: logged-in customers keep the coupon ──

  it('logged-in: stored coupon survives GET /cart and line mutations without a coupon', async () => {
    window.history.replaceState(null, '', '/cart');
    localStorage.setItem(couponStorageKey('s1'), JSON.stringify({ code: 'SAVED', type: 'percentage', discount: 10 }));
    const serverLine = { id: 'c1', productId: 'p1', price: 100, quantity: 1 };
    api.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === '/cart') return Promise.resolve({ items: [serverLine] });
      if (path.startsWith('/cart/items/') && init?.method === 'PUT') return Promise.resolve({ items: [{ ...serverLine, quantity: 2 }] });
      if (path === '/promotions/validate-coupon') return Promise.resolve({ valid: true, type: 'PERCENTAGE', discount_kind: 'percentage', value: 10, discount_amount: 10, free_shipping: false });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => { mount(ON, 'tok'); });
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('coupon')).toBe('SAVED');
    expect(text('discount')).toBe('10');
    fireEvent.click(screen.getByTestId('qty2'));
    await waitFor(() => expect(text('total')).toBe('180'));
    expect(text('coupon')).toBe('SAVED');
    expect(JSON.parse(localStorage.getItem(couponStorageKey('s1')) ?? 'null')?.code).toBe('SAVED');
  });

  it('logged-in: a coupon applied while logged in is stored per store', async () => {
    window.history.replaceState(null, '', '/cart');
    api.mockImplementation((path: string) => {
      if (path === '/cart') return Promise.resolve({ items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }] });
      if (path === '/promotions/validate-coupon') return Promise.resolve({ valid: true, type: 'FIXED_AMOUNT', discount_kind: 'fixed', value: 30, discount_amount: 30, free_shipping: false });
      if (path === '/cart/apply-coupon') return Promise.resolve({ message: 'ok' });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => { mount(null, 'tok'); });
    await waitFor(() => expect(text('items')).toBe('1'));
    fireEvent.click(screen.getByTestId('apply'));
    await waitFor(() => expect(text('coupon')).toBe('TYPED'));
    expect(text('total')).toBe('70');
    expect(JSON.parse(localStorage.getItem(couponStorageKey('s1')) ?? 'null')?.code).toBe('TYPED');
  });

  // ── Bug 3: removing a coupon never touches the lines ──

  it('logged-in removeCoupon keeps the items and clears the stored coupon', async () => {
    window.history.replaceState(null, '', '/cart');
    localStorage.setItem(couponStorageKey('s1'), JSON.stringify({ code: 'SAVED', type: 'fixed', discount: 10 }));
    localStorage.setItem(GUEST_COUPON_KEY, JSON.stringify({ code: 'OLD', type: 'fixed', discount: 10 }));
    api.mockImplementation((path: string) => {
      if (path === '/cart') return Promise.resolve({ items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }] });
      if (path.startsWith('/cart/remove-coupon')) return Promise.resolve({ message: 'Coupon removed' });
      if (path === '/promotions/validate-coupon') return Promise.resolve({ valid: true, type: 'FIXED_AMOUNT', discount_kind: 'fixed', value: 10, discount_amount: 10, free_shipping: false });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => { mount(null, 'tok'); });
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('coupon')).toBe('SAVED');
    fireEvent.click(screen.getByTestId('remove'));
    await waitFor(() => expect(text('coupon')).toBe(''));
    expect(text('items')).toBe('1');
    expect(text('total')).toBe('100');
    expect(localStorage.getItem(couponStorageKey('s1'))).toBeNull();
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });

  // ── Bug 4: targeted coupons ──

  it('sends line_totals and shows the targeted discount, not subtotal × pct', async () => {
    window.history.replaceState(null, '', '/cart');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE, { id: 'local_2', productId: 'p2', title: 'Cap', price: 300, quantity: 1 }]));
    // 10 % on p1 only: the server prices 10, not 40.
    api.mockResolvedValue({ valid: true, type: 'PERCENTAGE', discount_kind: 'percentage', value: 10, discount_amount: 10, free_shipping: false });
    mount(null);
    await waitFor(() => expect(text('items')).toBe('2'));
    fireEvent.click(screen.getByTestId('apply'));
    await waitFor(() => expect(text('coupon')).toBe('TYPED'));
    const body = JSON.parse((validateCalls()[0][1] as { body: string }).body);
    expect(body.line_totals).toEqual([
      { product_id: 'p1', amount: 100 },
      { product_id: 'p2', amount: 300 },
    ]);
    expect(text('discount')).toBe('10');
    expect(text('total')).toBe('390');
  });

  it('re-validates after a cart change and drops a coupon the cart no longer qualifies for (back to pending)', async () => {
    window.history.replaceState(null, '', '/cart');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([{ ...LINE, quantity: 2 }]));
    api.mockResolvedValueOnce({ valid: true, type: 'FIXED_AMOUNT', discount_kind: 'fixed', value: 50, discount_amount: 50, free_shipping: false });
    mount(ON);
    await waitFor(() => expect(text('items')).toBe('1'));
    fireEvent.click(screen.getByTestId('apply'));
    await waitFor(() => expect(text('coupon')).toBe('TYPED'));
    api.mockRejectedValueOnce(coded('PROMOTION_COUPON_MIN_QUANTITY'));
    fireEvent.click(screen.getByTestId('qty1'));
    await waitFor(() => expect(text('coupon')).toBe(''), { timeout: 3000 });
    expect(text('pending')).toBe('TYPED');
    expect(text('notice')).toBe('pending:TYPED');
    expect(text('total')).toBe('100');
  });

  // ── Bug 5: explicit pending API ──

  it('exposes the pending code, storeId and discards it explicitly', async () => {
    mount(ON);
    await waitFor(() => expect(text('pending')).toBe('SPRING'));
    expect(text('store')).toBe('s1');
    // Hiding the notice keeps the code pending.
    fireEvent.click(screen.getByTestId('dismiss'));
    expect(text('notice')).toBe('');
    expect(text('pending')).toBe('SPRING');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBe('SPRING');
    fireEvent.click(screen.getByTestId('discard'));
    expect(text('pending')).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
  });
});
