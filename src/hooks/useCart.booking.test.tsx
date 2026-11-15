import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { CartProvider, normalizeCartItem, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { GUEST_CART_KEY } from '@/lib/guestCart';

// Headless booking on the cart: the guest per-order limit (B2), the cart
// line limit key from GET /cart, and participant data leaving the browser
// after a placed order (GD2: `clearCart`, which every confirmation page runs).

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

const probe: { cart: ReturnType<typeof useCart> | null } = { cart: null };

function Probe() {
  const c = useCart();
  useEffect(() => {
    probe.cart = c;
  });
  return <span data-testid="items">{c.items.map((i) => `${i.productId}x${i.quantity}`).join(',')}</span>;
}

function tree() {
  return (
    <CheckoutSettingsProvider value={null}>
      <CartProvider token={null} storeId="s1">
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>
  );
}

const text = () => screen.getByTestId('items').textContent;
const stored = () => localStorage.getItem(GUEST_CART_KEY) ?? '';

describe('useCart booking (guest)', () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
    probe.cart = null;
  });

  it('refuses a guest add past max_per_order with CART_MAX_PER_ORDER', async () => {
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('p1', null, 2, undefined, { title: 'Course', price: 100, maxPerOrder: 3 });
    });
    expect(text()).toBe('p1x2');
    let caught: unknown;
    await act(async () => {
      await probe.cart!.addItem('p1', null, 2, undefined, { title: 'Course', price: 100, maxPerOrder: 3 }).catch((err: unknown) => {
        caught = err;
      });
    });
    expect(caught).toMatchObject({ code: 'CART_MAX_PER_ORDER', params: { max: 3 } });
    expect(text()).toBe('p1x2');
    // Exactly up to the limit still works.
    await act(async () => {
      await probe.cart!.addItem('p1', null, 1, undefined, { title: 'Course', price: 100, maxPerOrder: 3 });
    });
    expect(text()).toBe('p1x3');
  });

  it('a guest quantity raise past the limit is refused; lowering works', async () => {
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify([{ id: 'local_1', productId: 'p1', title: 'Course', price: 100, quantity: 2, maxPerOrder: 2 }]),
    );
    render(tree());
    await waitFor(() => expect(text()).toBe('p1x2'));
    let caught: unknown;
    await act(async () => {
      await probe.cart!.updateQuantity('local_1', 3).catch((err: unknown) => {
        caught = err;
      });
    });
    expect(caught).toMatchObject({ code: 'CART_MAX_PER_ORDER' });
    expect(text()).toBe('p1x2');
    await act(async () => {
      await probe.cart!.updateQuantity('local_1', 1);
    });
    expect(text()).toBe('p1x1');
  });

  it('products without a limit add and raise as before', async () => {
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('p1', null, 50, undefined, { title: 'Mug', price: 10 });
    });
    const id = probe.cart!.items[0]!.id;
    await act(async () => {
      await probe.cart!.updateQuantity(id, 500);
    });
    expect(text()).toBe('p1x500');
    expect(stored()).not.toContain('maxPerOrder');
  });

  it('GD2: clearCart after an order leaves no participant values in localStorage', async () => {
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('p1', null, 1, { f_pnr: '19900101-1234', f_name: 'Anna' }, { title: 'Course', price: 100 });
    });
    await waitFor(() => expect(stored()).toContain('19900101-1234'));
    await act(async () => {
      await probe.cart!.clearCart();
    });
    expect(text()).toBe('');
    expect(stored()).toBe('[]');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key) ?? '').not.toContain('19900101-1234');
    }
  });
});

describe('normalizeCartItem max_per_order', () => {
  it('reads the limit only when the server sends one', () => {
    expect(normalizeCartItem({ id: 'a', product_id: 'p1', quantity: 1, max_per_order: 2 }).maxPerOrder).toBe(2);
    expect('maxPerOrder' in normalizeCartItem({ id: 'a', product_id: 'p1', quantity: 1 })).toBe(false);
    expect('maxPerOrder' in normalizeCartItem({ id: 'a', product_id: 'p1', quantity: 1, max_per_order: null })).toBe(false);
  });
});
