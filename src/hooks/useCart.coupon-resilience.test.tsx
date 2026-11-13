import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, COUPON_TRANSIENT_RETRY_MS, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, pendingCouponStorageKey, type CheckoutSettings } from '@/lib/checkoutSettings';
import { GUEST_CART_KEY, GUEST_COUPON_KEY } from '@/lib/guestCart';
import { couponCartKey, couponStorageKey } from '@/lib/couponDiscount';

// Coupon resilience for paid campaign traffic: transient failures never cost
// the shopper a code, stored coupons are re-checked, a legacy shared coupon
// is never shown before this store accepts it, logout drops the customer's
// coupon, auto-apply off stops a captured code, and coupon-less server tax
// figures are never shown next to a discounted total.

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

function Probe() {
  const cart = useCart();
  return (
    <div>
      <span data-testid="items">{cart.items.length}</span>
      <span data-testid="coupon">{cart.coupon?.code ?? ''}</span>
      <span data-testid="discount">{cart.discount}</span>
      <span data-testid="total">{cart.total}</span>
      <span data-testid="pending">{cart.pendingCouponCode ?? ''}</span>
      <span data-testid="notice">{cart.couponNotice ? `${cart.couponNotice.status}:${cart.couponNotice.code}` : ''}</span>
      <span data-testid="withTax">{cart.totalWithTax === null ? 'null' : String(cart.totalWithTax)}</span>
      <span data-testid="taxLines">{cart.taxLines.length}</span>
      <span data-testid="b2b">{cart.b2bNet ? 'yes' : 'no'}</span>
      <button data-testid="qty2" onClick={() => void cart.updateQuantity(cart.items[0]?.id ?? '', 2).catch(() => {})} />
      <button data-testid="apply" onClick={() => void cart.applyCoupon('TYPED').catch(() => {})} />
    </div>
  );
}

function tree(settings: CheckoutSettings | null, token: string | null) {
  return (
    <CheckoutSettingsProvider value={settings}>
      <CartProvider token={token} storeId="s1">
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>
  );
}

const ON = normalizeCheckoutSettings({ coupon_autoapply: true, coupon_param: ['coupon', 'coupon1'] });
const OFF = normalizeCheckoutSettings({ coupon_autoapply: false, coupon_param: ['coupon'] });
const LINE = { id: 'local_1', productId: 'p1', title: 'Mug', price: 100, quantity: 1 };
const coded = (code: string, status = 400) => Object.assign(new Error(code), { code, status });
const ok = (amount: number) => ({ valid: true, type: 'PERCENTAGE', discount_kind: 'percentage', value: 10, discount_amount: amount, free_shipping: false });
const text = (id: string) => screen.getByTestId(id).textContent;
const validateCalls = () => api.mock.calls.filter((c) => c[0] === '/promotions/validate-coupon');

describe('useCart coupon resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
    window.history.replaceState(null, '', '/cart');
  });
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  // ── Transient failures are retried on a timer ──

  it('auto-apply: a network drop keeps the link code and retries without a cart change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState(null, '', '/products/mug?coupon=SPRING');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(tree(ON, null));
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });
    // Not discarded, no "invalid" notice.
    expect(text('pending')).toBe('SPRING');
    expect(text('notice')).toBe('pending:SPRING');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBe('SPRING');

    api.mockResolvedValueOnce(ok(10));
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_TRANSIENT_RETRY_MS[0] + 10); });
    await waitFor(() => expect(text('notice')).toBe('applied:SPRING'));
    expect(validateCalls()).toHaveLength(2);
    expect(text('coupon')).toBe('SPRING');
    expect(text('total')).toBe('90');
  });

  it('auto-apply: a rate limit (429) is retried after the throttle window, not only on a cart change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState(null, '', '/products/mug?coupon=SPRING');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429 }));
    api.mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429 }));
    render(tree(ON, null));
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_TRANSIENT_RETRY_MS[0] + 10); });
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    // Nothing more until the next (longer) delay has passed.
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(validateCalls()).toHaveLength(2);
    api.mockResolvedValueOnce(ok(10));
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_TRANSIENT_RETRY_MS[1]); });
    await waitFor(() => expect(text('coupon')).toBe('SPRING'));
    expect(validateCalls()).toHaveLength(3);
  });

  it('re-validation: a proxy error page keeps the applied coupon and retries', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    api.mockResolvedValueOnce(ok(10));
    render(tree(null, null));
    await waitFor(() => expect(text('items')).toBe('1'));
    fireEvent.click(screen.getByTestId('apply'));
    await waitFor(() => expect(text('coupon')).toBe('TYPED'));

    // Quantity change: the re-check hits a 502 HTML page (no status known).
    api.mockRejectedValueOnce(new SyntaxError("Unexpected token '<'"));
    fireEvent.click(screen.getByTestId('qty2'));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    await act(async () => { await Promise.resolve(); });
    expect(text('coupon')).toBe('TYPED');
    expect(text('notice')).toBe('');
    expect(text('discount')).toBe('20');

    api.mockResolvedValueOnce(ok(20));
    await act(async () => { await vi.advanceTimersByTimeAsync(COUPON_TRANSIENT_RETRY_MS[0] + 700); });
    await waitFor(() => expect(validateCalls()).toHaveLength(3));
    expect(text('coupon')).toBe('TYPED');
    expect(JSON.parse(localStorage.getItem(couponStorageKey('s1')) ?? 'null')?.cartKey).toBe(
      couponCartKey([{ ...LINE, quantity: 2 }]),
    );
  });

  it('a targeted answer is kept as targeted even when every cart line is targeted', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    // Amount equals the whole-cart amount: inference alone would say untargeted.
    api.mockResolvedValueOnce({ ...ok(10), targeted: true, product_ids: ['p1', 'p9'] });
    render(tree(null, null));
    await waitFor(() => expect(text('items')).toBe('1'));
    fireEvent.click(screen.getByTestId('apply'));
    await waitFor(() => expect(text('coupon')).toBe('TYPED'));
    const stored = JSON.parse(localStorage.getItem(couponStorageKey('s1')) ?? 'null');
    expect(stored).toMatchObject({ targeted: true, productIds: ['p1', 'p9'] });
  });

  // ── Stored coupons are re-checked once per load ──

  it('a stored coupon whose cart signature matches is still re-validated (expired since)', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    localStorage.setItem(
      couponStorageKey('s1'),
      JSON.stringify({ code: 'OLD', type: 'percentage', discount: 50, discountAmount: 50, cartKey: couponCartKey([LINE]) }),
    );
    api.mockRejectedValueOnce(coded('PROMOTION_COUPON_EXPIRED'));
    render(tree(null, null));
    await waitFor(() => expect(validateCalls()).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(text('coupon')).toBe(''));
    expect(text('notice')).toBe('invalid:OLD');
    expect(text('total')).toBe('100');
    expect(localStorage.getItem(couponStorageKey('s1'))).toBeNull();
  });

  it('a stored server amount is never shown as-is (hand-edited figure)', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    localStorage.setItem(
      couponStorageKey('s1'),
      JSON.stringify({ code: 'TEN', type: 'percentage', discount: 10, discountAmount: 99, cartKey: couponCartKey([LINE]) }),
    );
    api.mockResolvedValueOnce(ok(10));
    render(tree(null, null));
    await waitFor(() => expect(text('items')).toBe('1'));
    // The live estimate, not the stored 99.
    expect(text('discount')).toBe('10');
    await waitFor(() => expect(validateCalls()).toHaveLength(1), { timeout: 3000 });
    expect(text('discount')).toBe('10');
  });

  // ── Legacy shared `guest_coupon` key ──

  it("another store's legacy coupon is never shown and goes silently", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    localStorage.setItem(GUEST_COUPON_KEY, JSON.stringify({ code: 'STOREA', type: 'percentage', discount: 30 }));
    api.mockRejectedValueOnce(coded('PROMOTION_COUPON_INVALID'));
    render(tree(null, null));
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('coupon')).toBe('');
    expect(text('discount')).toBe('0');
    await waitFor(() => expect(validateCalls()).toHaveLength(1), { timeout: 3000 });
    await act(async () => { await Promise.resolve(); });
    expect(text('coupon')).toBe('');
    expect(text('notice')).toBe('');
    expect(text('pending')).toBe('');
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });

  it("this store's legacy coupon is applied once validated and moved to the per-store key", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    localStorage.setItem(GUEST_COUPON_KEY, JSON.stringify({ code: 'MINE', type: 'percentage', discount: 10 }));
    api.mockResolvedValueOnce(ok(10));
    render(tree(null, null));
    await waitFor(() => expect(text('coupon')).toBe('MINE'), { timeout: 3000 });
    expect(text('discount')).toBe('10');
    expect(JSON.parse(localStorage.getItem(couponStorageKey('s1')) ?? 'null')?.code).toBe('MINE');
    expect(localStorage.getItem(GUEST_COUPON_KEY)).toBeNull();
  });

  // ── Logout / auto-apply off ──

  it('logout drops the departed customer coupon', async () => {
    localStorage.setItem(couponStorageKey('s1'), JSON.stringify({ code: 'STAFF50', type: 'percentage', discount: 50 }));
    api.mockImplementation((path: string) => {
      if (path === '/cart') return Promise.resolve({ items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }] });
      if (path === '/promotions/validate-coupon') return Promise.resolve(ok(50));
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(tree(null, 'tok')); });
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('coupon')).toBe('STAFF50');
    await act(async () => { view.rerender(tree(null, null)); });
    await waitFor(() => expect(text('coupon')).toBe(''));
    expect(localStorage.getItem(couponStorageKey('s1'))).toBeNull();
  });

  it('auto-apply turned off: a code captured earlier is dropped, not applied', async () => {
    localStorage.setItem(pendingCouponStorageKey('s1'), 'LEAKED');
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([LINE]));
    render(tree(OFF, null));
    await waitFor(() => expect(text('items')).toBe('1'));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(text('pending')).toBe('');
    expect(localStorage.getItem(pendingCouponStorageKey('s1'))).toBeNull();
    expect(validateCalls()).toHaveLength(0);
  });

  // ── Server tax figures are coupon-less ──

  it('logged-in EXCLUSIVE cart with a coupon: no coupon-less tax total or b2b block', async () => {
    localStorage.setItem(couponStorageKey('s1'), JSON.stringify({ code: 'TEN', type: 'percentage', discount: 10 }));
    api.mockImplementation((path: string) => {
      if (path === '/cart') {
        return Promise.resolve({
          items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }],
          tax_pricing_mode: 'EXCLUSIVE',
          tax_lines: [{ label: 'VAT', rate_bp: 2500, taxable_amount: 100, tax_amount: 25 }],
          tax_total: 25,
          total_with_tax: 125,
          tax_estimated: false,
          b2b: { net_items: 100, net_shipping: 0, net_total: 100 },
        });
      }
      if (path === '/promotions/validate-coupon') return Promise.resolve(ok(10));
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => { render(tree(null, 'tok')); });
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('discount')).toBe('10');
    expect(text('total')).toBe('90');
    // 125 is the server's coupon-less figure: not shown next to a 90 total.
    expect(text('withTax')).toBe('null');
    expect(text('taxLines')).toBe('0');
    expect(text('b2b')).toBe('no');
  });

  it('logged-in EXCLUSIVE cart without a coupon keeps the server tax figures', async () => {
    api.mockImplementation((path: string) => {
      if (path === '/cart') {
        return Promise.resolve({
          items: [{ id: 'c1', productId: 'p1', price: 100, quantity: 1 }],
          tax_pricing_mode: 'EXCLUSIVE',
          tax_lines: [{ label: 'VAT', rate_bp: 2500, taxable_amount: 100, tax_amount: 25 }],
          tax_total: 25,
          total_with_tax: 125,
          tax_estimated: false,
          b2b: { net_items: 100, net_shipping: 0, net_total: 100 },
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    await act(async () => { render(tree(null, 'tok')); });
    await waitFor(() => expect(text('items')).toBe('1'));
    expect(text('withTax')).toBe('125');
    expect(text('taxLines')).toBe('1');
    expect(text('b2b')).toBe('yes');
  });
});
