import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';

// Focused storefront: after "add to cart" the buyer goes to the cart page
// (the cart is a step: several products in one order) unless the store
// explicitly chose `checkout`. A store with a site but without the flag
// keeps its stored behaviour.

const push = vi.fn();
const addItem = vi.fn(() => Promise.resolve());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/sv/products/x' }));
vi.mock('next-intl', () => ({ useLocale: () => 'sv', useTranslations: () => (k: string) => k }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));

import { useAddToCartLine } from './useAddToCartLine';

const SITE = 'https://mollstrands.example/';
const input = { productId: 'p1', variantId: null, quantity: 1, source: { title: 'Kurs', unitPrice: 10 } };

function wrapperFor(settings: CheckoutSettings | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CheckoutSettingsProvider value={settings}>{children}</CheckoutSettingsProvider>;
  };
}

async function addWith(raw: Record<string, unknown>) {
  const { result } = renderHook(() => useAddToCartLine(), { wrapper: wrapperFor(normalizeCheckoutSettings(raw)) });
  await act(async () => {
    await result.current.addLine(input, {});
  });
  return result;
}

describe('useAddToCartLine in a focused storefront', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    addItem.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('default (stay) -> the cart page, no toast', async () => {
    const result = await addWith({ external_site_url: SITE, external_focus: true });
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/sv/cart');
    expect(result.current.justAdded).toBe(false);
  });

  it('cart -> the cart page', async () => {
    await addWith({ external_site_url: SITE, external_focus: true, after_add_to_cart: 'cart' });
    expect(push).toHaveBeenCalledWith('/sv/cart');
  });

  it('an explicit checkout choice is respected', async () => {
    await addWith({ external_site_url: SITE, external_focus: true, after_add_to_cart: 'checkout' });
    expect(push).toHaveBeenCalledWith('/sv/checkout');
  });

  it('the designer path (markAdded) goes to the cart page as well', async () => {
    const { result } = renderHook(() => useAddToCartLine(), {
      wrapper: wrapperFor(normalizeCheckoutSettings({ external_site_url: SITE, external_focus: true })),
    });
    act(() => result.current.markAdded());
    expect(push).toHaveBeenCalledWith('/sv/cart');
  });

  it('a site WITHOUT the flag keeps the toast (stay)', async () => {
    const result = await addWith({ external_site_url: SITE });
    expect(push).not.toHaveBeenCalled();
    expect(result.current.justAdded).toBe(true);
  });
});
