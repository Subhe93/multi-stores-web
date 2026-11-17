import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';
import { ExternalReturnPanel } from './ExternalReturnPanel';
import { OrderReceipt } from './OrderReceipt';

// Headless booking P3: the "back to <site>" panel and the receipt's
// shopping link. Stores without an external site must render as before.

vi.mock('next-intl', () => ({
  useLocale: () => 'sv',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/checkout/confirmation' }));
vi.mock('@/hooks/useStorePrimaryLocale', () => ({ useStorePrimaryLocale: () => 'sv' }));

const settled = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve());
vi.mock('@/lib/trackEvents', () => ({ whenPurchaseSettled: (id: string) => settled(id) }));

const SITE = 'https://primatrafikskola.se/';

function withSettings(settings: CheckoutSettings | null, node: React.ReactNode) {
  return <CheckoutSettingsProvider value={settings}>{node}</CheckoutSettingsProvider>;
}

const assign = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  settled.mockClear();
  assign.mockClear();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExternalReturnPanel', () => {
  it('renders nothing without an external site', () => {
    const { container } = render(withSettings(null, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(container).toBeEmptyDOMElement();
  });

  it('button mode: a noreferrer link with the order number, no countdown', () => {
    const settings = normalizeCheckoutSettings({
      external_site_url: SITE,
      return_url: 'https://primatrafikskola.se/tack?order={order_number}',
    });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-AB-12" orderId="o1" />));
    const link = screen.getByRole('link', { name: /checkout.returnToSite:primatrafikskola.se/ });
    expect(link).toHaveAttribute('href', 'https://primatrafikskola.se/tack?order=ORD-AB-12');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(screen.queryByText('checkout.stayOnPage')).toBeNull();
  });

  it('uses the merchant label for the locale', () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, back_label: { sv: 'Tillbaka till skolan' } });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('link', { name: /Tillbaka till skolan/ })).toHaveAttribute('href', SITE);
  });

  it('auto mode: redirects after the countdown and the purchase tags', async () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, return_mode: 'auto' });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('status')).toHaveTextContent('checkout.redirectingToSite:primatrafikskola.se|8');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(assign).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(settled).toHaveBeenCalledWith('o1');
    expect(assign).toHaveBeenCalledWith(SITE);
  });

  it('auto mode: "stay on this page" cancels the redirect', async () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, return_mode: 'auto' });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    act(() => {
      screen.getByRole('button', { name: 'checkout.stayOnPage' }).click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('OrderReceipt shopping link', () => {
  it('without an external site: unchanged link, even when the order is settled', () => {
    const { container } = render(
      withSettings(null, <OrderReceipt order={null} orderId="o1" externalReturn={{ orderNumber: 'ORD-1', orderId: 'o1' }} />),
    );
    const baseline = render(withSettings(null, <OrderReceipt order={null} orderId="o1" />)).container;
    expect(container.innerHTML).toBe(baseline.innerHTML);
    const link = screen.getAllByRole('link', { name: /checkout.backToShopping/ })[0]!;
    expect(link).toHaveAttribute('href', '/products');
    expect(link).not.toHaveAttribute('rel');
  });

  it('with a site, not settled: the shopping link goes to the site', () => {
    render(withSettings(normalizeCheckoutSettings({ external_site_url: SITE }), <OrderReceipt order={null} orderId="o1" />));
    const link = screen.getByRole('link', { name: /checkout.backToShopping/ });
    expect(link).toHaveAttribute('href', SITE);
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('with a site and a settled order: the panel replaces the shopping link', () => {
    render(
      withSettings(
        normalizeCheckoutSettings({ external_site_url: SITE }),
        <OrderReceipt order={null} orderId="o1" externalReturn={{ orderNumber: 'ORD-1', orderId: 'o1' }} />,
      ),
    );
    expect(screen.queryByRole('link', { name: /checkout.backToShopping/ })).toBeNull();
    expect(screen.getByRole('link', { name: /checkout.returnToSite/ })).toHaveAttribute('href', SITE);
  });
});

describe('ExternalReturnPanel return_label', () => {
  it('wins over back_label for the locale', () => {
    const settings = normalizeCheckoutSettings({
      external_site_url: SITE,
      back_label: { sv: 'Tillbaka till skolan' },
      return_label: { sv: 'Till bokningsbekräftelsen' },
    });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('link', { name: /Till bokningsbekräftelsen/ })).toHaveAttribute('href', SITE);
    expect(screen.queryByRole('link', { name: /Tillbaka till skolan/ })).toBeNull();
  });

  it('falls back to back_label when it has no entry for the locale', () => {
    const settings = normalizeCheckoutSettings({
      external_site_url: SITE,
      back_label: { sv: 'Tillbaka till skolan' },
      return_label: { en: 'To your booking' },
    });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('link', { name: /Tillbaka till skolan/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /To your booking/ })).toBeNull();
  });

  it('falls back to the translated default without any label for the locale', () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, return_label: { en: 'To your booking' } });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('link', { name: /checkout.returnToSite:primatrafikskola.se/ })).toBeInTheDocument();
  });

  it('the countdown text is unchanged by the label', () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, return_mode: 'auto', return_label: { sv: 'Till bokningen' } });
    render(withSettings(settings, <ExternalReturnPanel orderNumber="ORD-1" orderId="o1" />));
    expect(screen.getByRole('status')).toHaveTextContent('checkout.redirectingToSite:primatrafikskola.se|8');
  });

  it('the receipt shopping link keeps using its own text', () => {
    const settings = normalizeCheckoutSettings({ external_site_url: SITE, return_label: { sv: 'Till bokningen' } });
    render(withSettings(settings, <OrderReceipt order={null} orderId="o1" />));
    expect(screen.getByRole('link', { name: /checkout.backToShopping/ })).toHaveAttribute('href', SITE);
    expect(screen.queryByRole('link', { name: /Till bokningen/ })).toBeNull();
  });
});
