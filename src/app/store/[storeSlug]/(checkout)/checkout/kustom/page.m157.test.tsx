import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePathPrefixProvider } from '@/hooks/useStorePathPrefix';

// M157: the order-first Kustom page sends the shopper back to the checkout
// when the request market does not offer Kustom (store payload flag), or
// when the session endpoint refuses it; the M156 prefix is kept.

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: 'orderId=o1' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/de-at/checkout/kustom',
  useParams: () => ({ storeSlug: 'namez-se' }),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, { rich: (key: string) => key, has: () => true });
  return { useLocale: () => 'de', useTranslations: () => t };
});
vi.mock('@/components/cart/FlowMotion', () => ({ useFlowMotion: () => 'none', enter: () => ({}) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: 'jwt', loading: false }) }));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => ({ key: 'eu' }) }));
vi.mock('@/components/checkout/KustomSnippet', () => ({ KustomSnippet: () => <div data-testid="snippet" /> }));
vi.mock('@/components/tracking/clarity', () => ({ navigateRespectingClarity: vi.fn() }));

const apiMock = vi.hoisted(() => ({
  getStore: vi.fn(),
  api: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  api: apiMock.api,
  storefront: { getStore: apiMock.getStore },
}));

import KustomCheckoutPage from './page';

function renderPage(prefix = '/de-at') {
  return render(
    <StorePathPrefixProvider value={prefix}>
      <KustomCheckoutPage />
    </StorePathPrefixProvider>,
  );
}

beforeEach(() => {
  nav.replace.mockClear();
  apiMock.getStore.mockReset();
  apiMock.api.mockReset();
});

describe('/checkout/kustom (M157)', () => {
  it('kustom_enabled:false → replace with the prefixed /checkout, no session request', async () => {
    apiMock.getStore.mockResolvedValue({ id: 's1', kustom_enabled: false });
    renderPage();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/de-at/checkout'));
    expect(apiMock.getStore).toHaveBeenCalledWith('namez-se', { key: 'eu' });
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('kustom_enabled:false without a prefix → /checkout', async () => {
    apiMock.getStore.mockResolvedValue({ id: 's1', kustom_enabled: false });
    renderPage('');
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/checkout'));
  });

  it('regression: Kustom offered → the session is requested and mounted', async () => {
    apiMock.getStore.mockResolvedValue({ id: 's1', kustom_enabled: true });
    apiMock.api.mockResolvedValue({ kustom_order_id: 'k1', html_snippet: '<div/>', status: 'checkout_incomplete' });
    renderPage();
    expect(await screen.findByTestId('snippet')).toBeInTheDocument();
    expect(apiMock.api).toHaveBeenCalledWith('/payments/kustom/session', expect.objectContaining({ method: 'POST' }));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('session refused with MARKET_PAYMENT_METHOD_NOT_ALLOWED → back to /checkout', async () => {
    apiMock.getStore.mockResolvedValue({ id: 's1', kustom_enabled: true });
    apiMock.api.mockRejectedValue(Object.assign(new Error('not here'), { code: 'MARKET_PAYMENT_METHOD_NOT_ALLOWED', status: 400 }));
    renderPage();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/de-at/checkout'));
  });

  it('session refused with KUSTOM_CURRENCY_NOT_ENABLED → friendly message + link to the checkout', async () => {
    apiMock.getStore.mockResolvedValue({ id: 's1', kustom_enabled: true });
    apiMock.api.mockRejectedValue(Object.assign(new Error('Kustom is not set up'), { code: 'KUSTOM_CURRENCY_NOT_ENABLED', status: 400 }));
    renderPage();
    expect(await screen.findByText('checkout.kustomCurrencyNotEnabledNoCard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'checkout.backToCheckout' })).toHaveAttribute('href', '/de-at/checkout');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('a failed store read does not block: the session endpoint decides', async () => {
    apiMock.getStore.mockRejectedValue(new Error('down'));
    apiMock.api.mockResolvedValue({ kustom_order_id: 'k1', html_snippet: '<div/>', status: 'checkout_incomplete' });
    renderPage();
    expect(await screen.findByTestId('snippet')).toBeInTheDocument();
  });
});
