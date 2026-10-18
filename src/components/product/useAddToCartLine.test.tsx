import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';

// After "add to cart" (M5 W2-A): `stay` (the default) shows the confirmation
// toast exactly as before; `cart` / `checkout` navigate instead, for both the
// personalization path (addLine) and the designer path (markAdded from
// onDone('added')), which share markAdded.

const push = vi.fn();
const addItem = vi.fn(() => Promise.resolve());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/ar/products/x' }));
vi.mock('next-intl', () => ({ useLocale: () => 'ar', useTranslations: () => (k: string) => k }));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));

import { useAddToCartLine } from './useAddToCartLine';

function wrapperFor(settings: CheckoutSettings | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CheckoutSettingsProvider value={settings}>{children}</CheckoutSettingsProvider>;
  };
}

const input = { productId: 'p1', variantId: null, quantity: 1, source: { title: 'Mug', unitPrice: 10 } };

describe('useAddToCartLine after_add_to_cart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockClear();
    addItem.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('G0: no settings (or stay) → toast, no navigation', async () => {
    const { result } = renderHook(() => useAddToCartLine(), { wrapper: wrapperFor(null) });
    await act(async () => {
      await result.current.addLine(input, {});
    });
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(result.current.justAdded).toBe(true);
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.justAdded).toBe(false);
  });

  it('cart → pushes the locale-prefixed cart path and skips the toast', async () => {
    const settings = normalizeCheckoutSettings({ after_add_to_cart: 'cart' });
    const { result } = renderHook(() => useAddToCartLine(), { wrapper: wrapperFor(settings) });
    await act(async () => {
      await result.current.addLine(input, {});
    });
    expect(push).toHaveBeenCalledWith('/ar/cart');
    expect(result.current.justAdded).toBe(false);
  });

  it('checkout → pushes the checkout path; the designer path (markAdded) too', async () => {
    const settings = normalizeCheckoutSettings({ after_add_to_cart: 'checkout' });
    const { result } = renderHook(() => useAddToCartLine(), { wrapper: wrapperFor(settings) });
    act(() => result.current.markAdded());
    expect(push).toHaveBeenCalledWith('/ar/checkout');
    expect(result.current.justAdded).toBe(false);
  });
});
