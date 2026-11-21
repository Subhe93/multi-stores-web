import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import { MarketProvider } from '@/hooks/useMarket';
import { NAMEZ_EU as EU, NAMEZ_MARKETS as MARKETS, NAMEZ_SE as SE } from '@/test/regionFixtures';

const state = vi.hoisted(() => ({ items: [] as unknown[], locale: 'en' }));

vi.mock('next-intl', () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
    return String(raw ?? key).replace(/\{(\w+)\}/g, (_, p: string) => String(params?.[p] ?? `{${p}}`));
  },
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ items: state.items }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: null }) }));

import { MarketSuggestBanner } from './MarketSuggestBanner';

const assign = vi.fn();

beforeEach(() => {
  assign.mockClear();
  state.items = [];
  state.locale = 'en';
  document.cookie = 'ms-market-suggest-dismissed=; path=/; max-age=0';
  vi.stubGlobal('location', { ...window.location, pathname: '/products/x', search: '?sort=1', href: 'http://localhost/products/x?sort=1', assign });
});

function renderBanner(country: string | null = 'BE', from = SE, suggestedKey = 'eu') {
  return render(
    <MarketProvider market={from} markets={MARKETS}>
      <MarketSuggestBanner storeSlug="namez-se" suggestedKey={suggestedKey} country={country} />
    </MarketProvider>,
  );
}

describe('MarketSuggestBanner (M155 wording)', () => {
  it('names the visitor\'s country and currency, never a market', () => {
    renderBanner();
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('It looks like you are in Belgium.');
    expect(screen.getByRole('button', { name: 'Shop for Belgium (EUR)' })).toBeInTheDocument();
    expect(banner.textContent).not.toMatch(/market|domain|Europe/i);
  });

  it('the CTA lands on the suggested market with the geo country in rg', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Shop for Belgium (EUR)' }));
    expect(assign).toHaveBeenCalledWith('https://namez.shop/products/x?sort=1&rg=BE');
  });

  it('a geo country the market does not sell to falls back to its first country', () => {
    renderBanner(null);
    expect(screen.getByRole('status')).toHaveTextContent(`It looks like you are in Germany.`);
    fireEvent.click(screen.getByRole('button', { name: /Shop for/ }));
    expect(assign.mock.calls[0]![0]).toContain(`rg=${EU.countries[0]}`);
  });

  it('a geo country no market lists lands in the default market without storing a country', () => {
    renderBanner('NO', EU, 'default');
    expect(screen.getByRole('status')).toHaveTextContent('It looks like you are in Norway.');
    fireEvent.click(screen.getByRole('button', { name: 'Shop for Norway (SEK)' }));
    const url = assign.mock.calls[0]![0] as string;
    expect(url).toContain('namez.se');
    expect(url).not.toContain('rg=');
  });

  it('the landing language comes from the country resolver (current locale only when offered)', () => {
    // EU serves de; the default market (sv, en, ar) does not, so its default sv is used.
    state.locale = 'de';
    renderBanner('NO', EU, 'default');
    fireEvent.click(screen.getByRole('button', { name: /Shop for/ }));
    const url = assign.mock.calls[0]![0] as string;
    expect(url).toBe('https://namez.se/products/x?sort=1');
  });

  it('dismiss sets the cookie and hides the banner', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(document.cookie).toContain('ms-market-suggest-dismissed=1');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
