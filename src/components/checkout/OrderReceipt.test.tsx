import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';
import { OrderReceipt, type OrderReceiptOrder } from './OrderReceipt';

// "Store without customer accounts": the receipt keeps its lines and totals
// but drops the "view order" link. Every other store renders as before.

vi.mock('next-intl', () => ({
  useLocale: () => 'sv',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/checkout/confirmation' }));
vi.mock('@/hooks/useStorePrimaryLocale', () => ({ useStorePrimaryLocale: () => 'sv' }));
vi.mock('@/lib/trackEvents', () => ({ whenPurchaseSettled: () => Promise.resolve() }));

const SITE = 'https://primatrafikskola.se/';

function withSettings(settings: CheckoutSettings | null, node: React.ReactNode) {
  return <CheckoutSettingsProvider value={settings}>{node}</CheckoutSettingsProvider>;
}

const ORDER: OrderReceiptOrder = {
  id: 'o1',
  order_number: 'ORD-1',
  subtotal: 100,
  shipping_cost: 0,
  discount_amount: 0,
  total: 100,
  currency: 'SEK',
  items: [{ id: 'i1', quantity: 2, unit_price: 50, product: { translations: [{ locale: 'sv', title: 'Riskettan' }] } }],
};

describe('OrderReceipt "view order" link', () => {
  it('is shown by default', () => {
    render(withSettings(null, <OrderReceipt order={ORDER} orderId="o1" />));
    expect(screen.getByRole('link', { name: /checkout.viewOrder/ })).toHaveAttribute('href', expect.stringContaining('/account/orders/o1'));
  });

  it('a store with other settings only keeps the link', () => {
    render(withSettings(normalizeCheckoutSettings({ external_site_url: SITE, phone_required: true }), <OrderReceipt order={ORDER} orderId="o1" />));
    expect(screen.getByRole('link', { name: /checkout.viewOrder/ })).toBeInTheDocument();
  });

  it('is hidden for a store without customer accounts; the receipt stays', () => {
    render(withSettings(normalizeCheckoutSettings({ no_customer_accounts: true }), <OrderReceipt order={ORDER} orderId="o1" />));
    expect(screen.queryByRole('link', { name: /checkout.viewOrder/ })).toBeNull();
    expect(screen.getByText('Riskettan')).toBeInTheDocument();
    expect(screen.getByText('checkout.orderSummary')).toBeInTheDocument();
    expect(screen.getByText('cart.total')).toBeInTheDocument();
    // Without an external site the shopping link is untouched.
    const shopping = screen.getByRole('link', { name: /checkout.backToShopping/ });
    expect(shopping).toHaveAttribute('href', '/products');
    expect(shopping).not.toHaveAttribute('rel');
  });

  it('hidden with the flag, the return panel still renders on a settled order', () => {
    render(
      withSettings(
        normalizeCheckoutSettings({ external_site_url: SITE, no_customer_accounts: true, return_label: { sv: 'Till bokningen' } }),
        <OrderReceipt order={ORDER} orderId="o1" externalReturn={{ orderNumber: 'ORD-1', orderId: 'o1' }} />,
      ),
    );
    expect(screen.queryByRole('link', { name: /checkout.viewOrder/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Till bokningen/ })).toHaveAttribute('href', SITE);
  });

  it('showOrderLink={false} still hides it without the flag', () => {
    render(withSettings(null, <OrderReceipt order={ORDER} orderId="o1" showOrderLink={false} />));
    expect(screen.queryByRole('link', { name: /checkout.viewOrder/ })).toBeNull();
    expect(screen.getByText('Riskettan')).toBeInTheDocument();
  });

  it('the flag changes nothing but the link', () => {
    const plain = render(withSettings(null, <OrderReceipt order={ORDER} orderId="o1" showOrderLink={false} />)).container.innerHTML;
    const flagged = render(
      withSettings(normalizeCheckoutSettings({ no_customer_accounts: true }), <OrderReceipt order={ORDER} orderId="o1" />),
    ).container.innerHTML;
    expect(flagged).toBe(plain);
  });
});

// Order of services / digital products only: no shipping row on the receipt.
describe('OrderReceipt shipping row', () => {
  it('an order that ships (or from an older API) keeps the row', () => {
    render(withSettings(null, <OrderReceipt order={ORDER} orderId="o1" />));
    expect(screen.getByText('cart.shipping')).toBeInTheDocument();
  });

  it('requires_shipping true or null renders the same markup as no key', () => {
    const plain = render(withSettings(null, <OrderReceipt order={ORDER} orderId="o1" />)).container.innerHTML;
    for (const value of [true, null]) {
      const flagged = render(
        withSettings(null, <OrderReceipt order={{ ...ORDER, requires_shipping: value }} orderId="o1" />),
      ).container.innerHTML;
      expect(flagged).toBe(plain);
    }
  });

  it('requires_shipping false: no shipping row, the totals stay', () => {
    render(withSettings(null, <OrderReceipt order={{ ...ORDER, requires_shipping: false }} orderId="o1" />));
    expect(screen.queryByText('cart.shipping')).toBeNull();
    expect(screen.queryByText('checkout.pickUpInStore')).toBeNull();
    expect(screen.getByText('cart.subtotal')).toBeInTheDocument();
    expect(screen.getByText('cart.total')).toBeInTheDocument();
    expect(screen.getByText('Riskettan')).toBeInTheDocument();
  });

  it('requires_shipping false on a company order: no net shipping row either', () => {
    const company: OrderReceiptOrder = {
      ...ORDER, requires_shipping: false, customer_type: 'COMPANY', company_name: 'Acme AB',
      tax_pricing_mode: 'INCLUSIVE', tax_amount: 20,
    };
    render(withSettings(null, <OrderReceipt order={company} orderId="o1" />));
    expect(screen.getByText('b2b.subtotalExclVat')).toBeInTheDocument();
    expect(screen.queryByText('cart.shipping')).toBeNull();
  });
});
