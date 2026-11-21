import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePathPrefixProvider } from '@/hooks/useStorePathPrefix';

// M157: the Kustom-first checkout reacts to the coded refusals of the
// session create / update (market without Kustom, currency Kustom cannot
// take); links and redirects keep the M156 locale-path prefix.

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/de-at/checkout',
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

const hook = vi.hoisted(() => ({
  state: {
    html: null as string | null,
    loading: false,
    updating: false,
    failed: true,
    unavailableBlocked: false,
    syncFailed: false,
    refusal: null,
    failedCode: null as string | null,
    totals: null,
    totalsBuyer: null,
    session: null,
    retry: () => {},
  },
}));
vi.mock('@/hooks/useKustomCheckout', () => ({ useKustomCheckout: () => hook.state }));
vi.mock('@/hooks/useFocusedStorefront', () => ({ useContinueShoppingLink: (href: string) => ({ href }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: null, user: null, loading: false, refresh: async () => null }) }));
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({
    items: [{ id: 'l1', productId: 'p1', quantity: 1, price: 10, title: 'Shirt' }],
    subtotal: 10, total: 10, coupon: null, discount: 0, currency: 'EUR', loading: false,
    taxLines: [], taxPricingMode: 'INCLUSIVE', taxEstimated: false, b2bNet: null, netItems: null,
    updateQuantity: vi.fn(), removeItem: vi.fn(), applyCoupon: vi.fn(), removeCoupon: vi.fn(),
    hasUnavailableItems: false, removeUnavailableLines: vi.fn(),
  }),
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => ({ key: 'eu' }) }));
vi.mock('@/hooks/useBuyerType', () => ({ useBuyerType: () => ({ enabled: false, isCompany: false, settings: {} }) }));
vi.mock('@/components/cart/UnavailableInMarket', () => ({ RemoveUnavailableHint: () => null }));
vi.mock('@/components/cart/UnavailableRemovedNotice', () => ({ UnavailableRemovedNotice: () => null, useCartAvailabilityCheck: () => {} }));
vi.mock('@/components/cart/InvalidPersonalizationHint', () => ({ InvalidPersonalizationHint: () => null, hasInvalidPersonalization: () => false }));
vi.mock('@/components/checkout/KustomSnippet', () => ({ KustomSnippet: () => <div data-testid="snippet" /> }));
vi.mock('@/components/checkout/OrderSummary', () => ({ OrderSummary: () => null }));
vi.mock('@/components/checkout/VatNumberField', () => ({ VatNumberField: () => null }));
vi.mock('@/lib/trackEvents', () => ({ rememberPurchaseSnapshot: vi.fn() }));

import { KustomCheckout } from './KustomCheckout';

function renderCheckout(props: { classicAvailable: boolean; cardAvailable?: boolean }, prefix = '/de-at') {
  return render(
    <StorePathPrefixProvider value={prefix}>
      <KustomCheckout storeSlug="namez-se" {...props} />
    </StorePathPrefixProvider>,
  );
}

beforeEach(() => {
  nav.replace.mockClear();
  nav.search = '';
  hook.state = { ...hook.state, failed: true, syncFailed: false, failedCode: null, refusal: null };
});

describe('KustomCheckout (M157)', () => {
  it('KUSTOM_CURRENCY_NOT_ENABLED with card: friendly message + "Pay by card" (prefixed), no retry', () => {
    hook.state.failedCode = 'KUSTOM_CURRENCY_NOT_ENABLED';
    renderCheckout({ classicAvailable: true, cardAvailable: true });
    expect(screen.getByText('checkout.kustomCurrencyNotEnabled')).toBeInTheDocument();
    const button = screen.getByRole('link', { name: 'checkout.payByCardInstead' });
    expect(button).toHaveAttribute('href', '/de-at/checkout?method=classic');
    expect(screen.queryByRole('button', { name: 'checkout.retry' })).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('KUSTOM_CURRENCY_NOT_ENABLED without any classic method: message only', () => {
    hook.state.failedCode = 'KUSTOM_CURRENCY_NOT_ENABLED';
    renderCheckout({ classicAvailable: false, cardAvailable: false });
    expect(screen.getByText('checkout.kustomCurrencyNotEnabledNoCard')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'checkout.payByCardInstead' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'checkout.payOtherWay' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'checkout.retry' })).toBeNull();
  });

  it('KUSTOM_CURRENCY_NOT_ENABLED with COD only: the "pay another way" button', () => {
    hook.state.failedCode = 'KUSTOM_CURRENCY_NOT_ENABLED';
    renderCheckout({ classicAvailable: true, cardAvailable: false });
    expect(screen.queryByRole('link', { name: 'checkout.payByCardInstead' })).toBeNull();
    // One in the summary aside, one as the primary action.
    expect(screen.getAllByRole('link', { name: 'checkout.payOtherWay' }).length).toBe(2);
  });

  it('MARKET_PAYMENT_METHOD_NOT_ALLOWED with a classic method: redirects with the M156 prefix', async () => {
    hook.state.failedCode = 'MARKET_PAYMENT_METHOD_NOT_ALLOWED';
    renderCheckout({ classicAvailable: true, cardAvailable: true });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/de-at/checkout?method=classic'));
  });

  it('MARKET_PAYMENT_METHOD_NOT_ALLOWED without a prefix', async () => {
    hook.state.failedCode = 'MARKET_PAYMENT_METHOD_NOT_ALLOWED';
    renderCheckout({ classicAvailable: true, cardAvailable: true }, '');
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/checkout?method=classic'));
  });

  it('MARKET_PAYMENT_METHOD_NOT_ALLOWED with nothing else: message, no redirect', () => {
    hook.state.failedCode = 'MARKET_PAYMENT_METHOD_NOT_ALLOWED';
    renderCheckout({ classicAvailable: false });
    expect(screen.getByText('errors.MARKET_PAYMENT_METHOD_NOT_ALLOWED')).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('a failed update (sync) with the code also redirects', async () => {
    hook.state = { ...hook.state, failed: false, syncFailed: true, html: '<div/>', failedCode: 'MARKET_PAYMENT_METHOD_NOT_ALLOWED' };
    renderCheckout({ classicAvailable: true, cardAvailable: true });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/de-at/checkout?method=classic'));
  });

  it('regression: another failure keeps the generic message, retry and "pay another way"', () => {
    hook.state.failedCode = 'SOMETHING_ELSE';
    renderCheckout({ classicAvailable: true, cardAvailable: true });
    expect(screen.getByText('checkout.kustomSessionFailed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'checkout.retry' })).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('validation reason payment_method_unavailable has a message', () => {
    hook.state = { ...hook.state, failed: false, html: '<div/>' };
    nav.search = 'error=kustom_validation&reason=payment_method_unavailable';
    renderCheckout({ classicAvailable: true, cardAvailable: true });
    expect(screen.getByText('checkout.kustomValidationReasons.paymentMethodUnavailable')).toBeInTheDocument();
  });
});
