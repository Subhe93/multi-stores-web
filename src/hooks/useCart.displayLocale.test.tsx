import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { CartProvider, useCart } from '@/hooks/useCart';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { GUEST_CART_KEY } from '@/lib/guestCart';
import { resetCartDisplayCache } from '@/lib/cartDisplay';

// M160: a guest cart shared across the locales of a host shows its titles in
// the page locale (display overlay); the stored lines keep their text.

const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => api(...args) }));

const probe: { cart: ReturnType<typeof useCart> | null } = { cart: null };

function Probe() {
  const c = useCart();
  useEffect(() => {
    probe.cart = c;
  });
  return <span data-testid="titles">{c.items.map((i) => `${i.title}|${i.variant ?? ''}`).join(',')}</span>;
}

function tree(opts: { token?: string | null; locale?: string } = {}) {
  return (
    <CheckoutSettingsProvider value={null}>
      <CartProvider token={opts.token ?? null} storeId="s1" storeSlug="s" locale={opts.locale ?? 'de'}>
        <Probe />
      </CartProvider>
    </CheckoutSettingsProvider>
  );
}

const titles = () => screen.getByTestId('titles').textContent;
const frenchLine = {
  id: 'local_1',
  productId: 'p1',
  variantId: 'v1',
  title: 'Cheval de Dalécarlie',
  variant: 'Couleur: Argent',
  price: 100,
  quantity: 1,
};
const displayCalls = () => api.mock.calls.filter(([url]) => String(url).includes('/cart-display'));

describe('useCart guest titles in the page locale (M160)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetCartDisplayCache();
    api.mockReset();
    probe.cart = null;
  });

  it('a legacy line (no displayLocale) gets the German title; localStorage keeps the French one', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([frenchLine]));
    api.mockImplementation((url: string) =>
      url.includes('/cart-display')
        ? Promise.resolve({ items: [{ title: 'Dalapferd', variant: 'Farbe: Silber' }] })
        : Promise.resolve(null),
    );
    render(tree());
    await waitFor(() => expect(titles()).toBe('Dalapferd|Farbe: Silber'));
    expect(displayCalls()).toHaveLength(1);
    const [url, init] = displayCalls()[0] as [string, { method: string; body: string }];
    expect(url).toBe('/storefront/s/cart-display');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ locale: 'de', lines: [{ product_id: 'p1', variant_id: 'v1' }] });
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY)!)[0].title).toBe('Cheval de Dalécarlie');
  });

  it('an API error keeps the stored title', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([frenchLine]));
    api.mockImplementation((url: string) =>
      url.includes('/cart-display') ? Promise.reject(Object.assign(new Error('nf'), { status: 404 })) : Promise.resolve(null),
    );
    render(tree());
    await waitFor(() => expect(displayCalls()).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(titles()).toBe('Cheval de Dalécarlie|Couleur: Argent');
  });

  it('a line captured in the page locale makes no request', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([{ ...frenchLine, title: 'Dalapferd', displayLocale: 'de' }]));
    api.mockResolvedValue(null);
    render(tree());
    await waitFor(() => expect(titles()).toBe('Dalapferd|Couleur: Argent'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(displayCalls()).toHaveLength(0);
  });

  it('a new guest add stores the page locale', async () => {
    api.mockResolvedValue(null);
    render(tree());
    await act(async () => {
      await probe.cart!.addItem('p1', null, 1, undefined, { title: 'Dalapferd', price: 100 });
    });
    await waitFor(() => expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]')[0]?.displayLocale).toBe('de'));
    expect(displayCalls()).toHaveLength(0);
  });

  it('a signed-in cart never calls cart-display', async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify([frenchLine]));
    api.mockImplementation((url: string) =>
      url.startsWith('/cart') ? Promise.resolve({ items: [], coupon: null }) : Promise.resolve(null),
    );
    render(tree({ token: 'jwt' }));
    await waitFor(() => expect(api).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(displayCalls()).toHaveLength(0);
  });
});
