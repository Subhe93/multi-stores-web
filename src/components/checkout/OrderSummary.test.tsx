import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderSummary, shippingValueClass, type OrderSummaryProps } from './OrderSummary';

// Shipping value colour (store-kind audit gap 7): an unknown cost must not
// look free; green only for a real 0 or a free-shipping coupon.

vi.mock('@/hooks/useBuyerType', () => ({ useBuyerType: () => ({ isCompany: false, settings: {} }) }));
vi.mock('@/hooks/useDisplayPrice', () => ({ useDisplayPrice: () => (amount: number) => ({ amount }) }));

const t = (key: string) => key;

function props(over: Partial<OrderSummaryProps> = {}): OrderSummaryProps {
  return {
    items: [{ id: 'l1', title: 'Mug', price: 300, quantity: 1 }],
    subtotal: 300, discount: 0, total: 300, currency: 'SEK',
    coupon: null, couponCode: '', setCouponCode: vi.fn(), couponLoading: false, couponError: '',
    onApplyCoupon: vi.fn(), onRemoveCoupon: vi.fn(),
    shippingCost: null, shippingEstimate: null, shippingLoading: false, shippingError: '',
    effectiveShipping: 0,
    t,
    ...over,
  };
}

describe('shippingValueClass', () => {
  it('is grey while unknown or loading, green only for a real free shipping', () => {
    expect(shippingValueClass({ shippingLoading: false, couponFreeShipping: false, shippingCost: null })).toBe('text-gray-500');
    expect(shippingValueClass({ shippingLoading: true, couponFreeShipping: false, shippingCost: 0 })).toBe('text-gray-500');
    expect(shippingValueClass({ shippingLoading: false, couponFreeShipping: false, shippingCost: 0 })).toContain('text-green-600');
    expect(shippingValueClass({ shippingLoading: false, couponFreeShipping: true, shippingCost: null })).toContain('text-green-600');
    expect(shippingValueClass({ shippingLoading: false, couponFreeShipping: false, shippingCost: 49 })).toContain('text-gray-900');
  });
});

describe('OrderSummary shipping row', () => {
  it('"calculated at checkout" is neutral grey, not green (effectiveShipping 0 is ignored)', () => {
    render(<OrderSummary {...props()} />);
    const el = screen.getByTestId('summary-shipping');
    expect(el.textContent).toBe('cart.calculatedAtCheckout');
    expect(el.className).toContain('text-gray-500');
    expect(el.className).not.toContain('text-green-600');
  });

  it('a quoted 0 and a free-shipping coupon are green', () => {
    const { unmount } = render(<OrderSummary {...props({ shippingCost: 0 })} />);
    expect(screen.getByTestId('summary-shipping').className).toContain('text-green-600');
    unmount();
    render(<OrderSummary {...props({ coupon: { code: 'FRAKT', type: 'percentage', discount: 0, freeShipping: true } })} />);
    const el = screen.getByTestId('summary-shipping');
    expect(el.textContent).toBe('checkout.freeShippingLabel');
    expect(el.className).toContain('text-green-600');
  });

  it('a priced shipping is dark', () => {
    render(<OrderSummary {...props({ shippingCost: 49, effectiveShipping: 49 })} />);
    expect(screen.getByTestId('summary-shipping').className).toContain('text-gray-900');
  });
});
