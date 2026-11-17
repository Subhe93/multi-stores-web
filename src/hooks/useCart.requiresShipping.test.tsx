import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { CartProvider, normalizeCartItem, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { GUEST_CART_KEY, guestLineToServerBody } from '@/lib/guestCart';
import { toKustomCartLines } from '@/hooks/useKustomCheckout';

// Products that need no shipping (services / digital products): the cart line
// carries `requiresShipping: false`, from GET /cart (`requires_shipping`) or
// from the add-to-cart metadata of a guest. The key exists only when false,
// and it is never sent to the server.

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

function tree(token: string | null = null) {
  return (
    <CheckoutSettingsProvider value={null}>
      <CartProvider token={token} storeId="s1">
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>
  );
}

const text = () => screen.getByTestId('items').textContent;
const stored = () => JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? '[]') as Record<string, unknown>[];

describe('normalizeCartItem requires_shipping (server line)', () => {
  it('keeps the flag only for the literal false', () => {
    expect(normalizeCartItem({ id: 'a', product_id: 'p1', quantity: 1, requires_shipping: false }).requiresShipping).toBe(false);
    expect(normalizeCartItem({ id: 'a', product_id: 'p1', quantity: 1, requiresShipping: false }).requiresShipping).toBe(false);
  });

  it('a line that ships (or an older API) has no key at all', () => {
    for (const raw of [
      { id: 'a', product_id: 'p1', quantity: 1 },
      { id: 'a', product_id: 'p1', quantity: 1, requires_shipping: true },
      { id: 'a', product_id: 'p1', quantity: 1, requires_shipping: null },
      { id: 'a', product_id: 'p1', quantity: 1, requires_shipping: 0 },
    ]) {
      expect('requiresShipping' in normalizeCartItem(raw)).toBe(false);
    }
  });
});

describe('useCart requiresShipping', () => {
  beforeEach(() => {
    localStorage.clear();
    api.mockReset();
    probe.cart = null;
  });

  it('guest: the add metadata puts the flag on the stored line', async () => {
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('svc', null, 1, undefined, { title: 'Lesson', price: 100, requiresShipping: false });
    });
    expect(text()).toBe('svcx1');
    expect(probe.cart!.items[0]!.requiresShipping).toBe(false);
    expect(stored()[0]!.requiresShipping).toBe(false);
  });

  it('guest: a product that ships stores no key (line shape unchanged)', async () => {
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('mug', null, 1, undefined, { title: 'Mug', price: 100 });
    });
    expect(text()).toBe('mugx1');
    expect('requiresShipping' in probe.cart!.items[0]!).toBe(false);
    expect('requiresShipping' in stored()[0]!).toBe(false);
  });

  it('guest: a stored line keeps its flag across a reload', async () => {
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify([{ id: 'local_1', productId: 'svc', title: 'Lesson', price: 100, quantity: 1, requiresShipping: false }]),
    );
    render(tree());
    await waitFor(() => expect(text()).toBe('svcx1'));
    expect(probe.cart!.items[0]!.requiresShipping).toBe(false);
  });

  it('logged in: the flag comes from the GET /cart line', async () => {
    api.mockImplementation((path: string) =>
      path.startsWith('/cart')
        ? Promise.resolve({
            items: [
              { id: 'c1', product_id: 'svc', quantity: 1, price: 100, requires_shipping: false },
              { id: 'c2', product_id: 'mug', quantity: 2, price: 50 },
            ],
            requires_shipping: true,
          })
        : Promise.resolve({}),
    );
    render(tree('jwt'));
    await waitFor(() => expect(text()).toBe('svcx1,mugx2'));
    const [service, mug] = probe.cart!.items;
    expect(service!.requiresShipping).toBe(false);
    expect('requiresShipping' in mug!).toBe(false);
  });

  it('the flag is never sent to the server (quote lines, cart migration)', () => {
    const line = { id: 'local_1', productId: 'svc', price: 100, quantity: 1, requiresShipping: false as const };
    expect(toKustomCartLines([line])).toEqual([{ product_id: 'svc', quantity: 1 }]);
    const body = guestLineToServerBody(line);
    expect(JSON.stringify(body)).not.toMatch(/requires/i);
  });
});
