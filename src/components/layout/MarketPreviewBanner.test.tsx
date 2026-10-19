import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketProvider } from '@/hooks/useMarket';
import type { MarketRoute } from '@/lib/market';
import { MarketPreviewBanner, MarketPreviewCheckoutNotice } from './MarketPreviewBanner';

// The preview strip exists only on a market-preview host (`market.preview`)
// and cannot be dismissed; the checkout notice explains the disabled button.

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const eu: MarketRoute = {
  key: 'eu',
  name: 'Europe',
  default_locale: 'en',
  locales: ['sv'],
  countries: ['DE'],
  currency: 'EUR',
  is_default: false,
  primary_hostname: null,
  status: 'DRAFT',
  preview: true,
};

function renderIn(market: MarketRoute | null) {
  return render(
    <MarketProvider market={market} markets={[]}>
      <MarketPreviewBanner />
    </MarketProvider>,
  );
}

describe('MarketPreviewBanner', () => {
  it('renders the non-dismissable strip with the market name on a preview host', () => {
    renderIn(eu);
    const banner = screen.getByTestId('market-preview-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('market.preview.banner:{"name":"Europe"}');
    expect(banner.querySelector('button')).toBeNull();
  });

  it('falls back to the key without a name', () => {
    renderIn({ ...eu, name: undefined });
    expect(screen.getByTestId('market-preview-banner')).toHaveTextContent('{"name":"eu"}');
  });

  it('renders nothing on a normal market host or without the app', () => {
    renderIn({ ...eu, status: 'LIVE', preview: undefined });
    expect(screen.queryByTestId('market-preview-banner')).toBeNull();
    renderIn(null);
    expect(screen.queryByTestId('market-preview-banner')).toBeNull();
  });
});

describe('MarketPreviewCheckoutNotice', () => {
  it('explains the disabled checkout', () => {
    render(<MarketPreviewCheckoutNotice className="mt-2" />);
    const note = screen.getByTestId('market-preview-checkout-notice');
    expect(note).toHaveTextContent('market.preview.checkoutDisabled');
    expect(note.className).toContain('mt-2');
  });
});
