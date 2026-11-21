import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

// The store layout is THE gate of the focused storefront chrome
// (src/lib/focusedStorefront.ts): with the flag AND a valid external site the
// header and footer slots render the focused pair, whichever chrome the store
// uses (built-in header/footer or published builder HEADER/FOOTER pages).
// Every other store, including a store with a site but WITHOUT the flag,
// renders exactly the chrome it rendered before.
//
// The layout is rendered for real; its children components are replaced by
// markers so the test reads which chrome was chosen and with which props.

const SITE = 'https://mollstrands.example/';

const state = {
  host: 'mollstrands.shopsdoor.com',
  store: {} as Record<string, unknown>,
  publishedHeader: null as unknown,
  publishedFooter: null as unknown,
  suggestedMarket: null as { key: string; country: string } | null,
};

const api = {
  getPublishedHeader: vi.fn(async () => state.publishedHeader),
  getPublishedFooter: vi.fn(async () => state.publishedFooter),
  getMenus: vi.fn(async (): Promise<unknown[]> => [{ key: 'main', items: [] }]),
  getCreatorCategories: vi.fn(async () => [
    { slug: 'kurser', is_active: true, translations: [{ locale: 'sv', name: 'Kurser' }], children: [] },
  ]),
  getLegalPages: vi.fn(async () => [
    { slug: 'privacy', title: 'Integritetspolicy', source: 'template', page_slug: null },
    { slug: 'terms', title: 'Villkor', source: 'template', page_slug: null },
  ]),
};
const providerProps = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'host' ? state.host : null) }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('next-intl/server', () => ({ getMessages: async () => ({}) }));
vi.mock('@/lib/api', () => ({
  storefront: {
    getPublishedHeader: () => api.getPublishedHeader(),
    getPublishedFooter: () => api.getPublishedFooter(),
    getMenus: () => api.getMenus(),
    getCreatorCategories: () => api.getCreatorCategories(),
    getLegalPages: () => api.getLegalPages(),
    getStore: async () => state.store,
  },
  resolveMediaUrl: (u: string) => u,
  LEGAL_SLUGS: ['privacy', 'terms', 'refund', 'shipping'],
}));
vi.mock('@/lib/platform', () => ({ getPlatformName: async () => 'ShopsDoor' }));
vi.mock('@/lib/storeFonts', () => ({ buildGoogleFontsHref: () => null, loadInlineFonts: async () => null, selfHostedFontsHref: () => null }));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => (state.suggestedMarket ? 'se' : undefined),
  getRequestNoindex: async () => false,
  getRequestSuggestedMarket: async () => state.suggestedMarket,
  getRequestPathPrefix: async () => undefined,
  getRequestPathCountry: async () => null,
}));
vi.mock('@/lib/storeGate.server', () => ({
  loadGatedStore: async () => ({ store: state.store, gate: 'live', preview: false }),
}));
vi.mock('@/themes/registry', async () => {
  const { minimalTokens } = await vi.importActual<typeof import('@/themes/minimal/tokens')>('@/themes/minimal/tokens');
  return {
    resolveTheme: () => ({
      key: 'minimal',
      tokens: minimalTokens,
      sections: {},
      Layout: ({ headerSlot, footerSlot, children }: { headerSlot: ReactNode; footerSlot: ReactNode; children: ReactNode }) => (
        <div data-testid="theme-layout">
          {headerSlot}
          <main>{children}</main>
          {footerSlot}
        </div>
      ),
    }),
  };
});

// Chrome components → markers.
vi.mock('@/components/layout/StoreHeader', () => ({
  StoreHeader: (p: { collections?: unknown[] }) => (
    <div data-testid="builtin-header" data-collections={String(p.collections?.length ?? 0)} />
  ),
}));
vi.mock('@/components/layout/StoreFooter', () => ({ StoreFooter: () => <div data-testid="builtin-footer" /> }));
vi.mock('@/components/layout/FocusedHeader', () => ({
  FocusedHeader: (p: { storeName: string }) => <div data-testid="focused-header" data-name={p.storeName} />,
}));
vi.mock('@/components/layout/FocusedFooter', () => ({
  FocusedFooter: (p: {
    legalPages?: { slug: string }[];
    cookiePolicyHref?: string | null;
    logoUrl?: string;
    menuLinks?: { label: string; url: string }[];
  }) => (
    <div
      data-testid="focused-footer"
      data-legal={(p.legalPages ?? []).map((l) => l.slug).join(',')}
      data-cookie={p.cookiePolicyHref ?? ''}
      data-logo={p.logoUrl ?? ''}
      data-menu={(p.menuLinks ?? []).map((l) => `${l.label}=${l.url}`).join('|')}
    />
  ),
}));
vi.mock('@/themes/SectionRenderer', () => ({
  SectionRenderer: (p: { sections: { section_key: string }[] }) => (
    <div data-testid="published-chrome" data-keys={p.sections.map((s) => s.section_key).join(',')} />
  ),
}));
vi.mock('@/components/providers/StoreProviders', () => ({
  StoreProviders: ({ children, ...props }: { children: ReactNode }) => {
    providerProps(props);
    return <>{children}</>;
  },
}));
vi.mock('@/components/layout/MarketSuggestBanner', () => ({ MarketSuggestBanner: () => <div data-testid="market-suggest" /> }));
vi.mock('@/components/layout/MarketPreviewBanner', () => ({ MarketPreviewBanner: () => null }));
vi.mock('@/components/region/RegionPicker', () => ({ RegionPicker: () => <div data-testid="region-picker" /> }));
vi.mock('@/components/layout/BuyerTypeToggle', () => ({ BuyerTypeToggle: () => <div data-testid="buyer-toggle" /> }));
vi.mock('@/components/IfApp', () => ({ IfApp: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/edit-hint/EditHintBoot', () => ({ EditHintBoot: () => null }));
vi.mock('@/components/layout/StoreGatePage', () => ({ StoreGatePage: () => <div data-testid="gate-page" /> }));
vi.mock('@/components/layout/StorePreviewBar', () => ({ StorePreviewBar: () => null }));
vi.mock('@/components/layout/StorePreviewUnlock', () => ({ StorePreviewReset: () => null }));
vi.mock('@/components/tracking/StoreTracking', () => ({ StoreTracking: () => null }));
vi.mock('@/components/tracking/CookieSettingsLink', () => ({
  CookieSettingsLink: () => <button data-testid="cookie-settings" type="button" />,
}));
vi.mock('@/components/StoreCustomCss', () => ({ StoreCustomCss: () => null }));

import StoreLayout from './layout';

const baseStore = (checkout?: Record<string, unknown>) => ({
  id: 's1',
  name: 'Möllstrands',
  store_type: 'INDEPENDENT',
  language_config: { primary_locale: 'sv', secondary_locales: [] },
  pages: [{ slug: 'om-oss', translations: [{ locale: 'sv', title: 'Om oss' }] }],
  cookie_page_slug: 'om-cookies',
  apps: {},
  ...(checkout ? { checkout } : {}),
});

const HEADER_PAGE = {
  id: 'h1',
  snapshot: { sections: [{ id: 'a', section_key: 'announcement-bar' }, { id: 'b', section_key: 'header-bar' }, { id: 'c', section_key: 'mobile-bottom-nav' }] },
};
const HEADER_WITHOUT_BAR = { id: 'h2', snapshot: { sections: [{ id: 'a', section_key: 'announcement-bar' }] } };
const SE = { key: 'se', default_locale: 'sv', locales: [], countries: ['SE'], currency: 'SEK', is_default: true, primary_hostname: 'namez.se', status: 'LIVE' };
const EU = { key: 'eu', default_locale: 'en', locales: ['de'], countries: ['DE', 'BE'], currency: 'EUR', is_default: false, primary_hostname: 'namez.shop', status: 'LIVE' };
const FOOTER_PAGE = { id: 'f1', snapshot: { sections: [{ id: 'd', section_key: 'footer-columns' }, { id: 'e', section_key: 'newsletter-signup' }] } };

async function renderLayout() {
  const tree = await StoreLayout({
    children: <div data-testid="page" />,
    params: Promise.resolve({ storeSlug: 'mollstrands' }),
  });
  return render(tree);
}

const q = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`);
const lastProviderCheckout = () =>
  (providerProps.mock.calls[providerProps.mock.calls.length - 1]![0] as { checkout: Record<string, unknown> }).checkout;

beforeEach(() => {
  state.host = 'mollstrands.shopsdoor.com';
  state.store = baseStore();
  state.publishedHeader = null;
  state.publishedFooter = null;
  state.suggestedMarket = null;
  for (const fn of Object.values(api)) fn.mockClear();
  providerProps.mockClear();
});
afterEach(cleanup);

describe('store layout: chrome gate of the focused storefront', () => {
  it('a store without any setting renders the built-in header and footer', async () => {
    const { container } = await renderLayout();
    expect(q(container, 'builtin-header')).not.toBeNull();
    expect(q(container, 'builtin-footer')).not.toBeNull();
    expect(q(container, 'focused-header')).toBeNull();
    expect(q(container, 'focused-footer')).toBeNull();
    expect(q(container, 'page')).not.toBeNull();
  });

  it('a store with a site but WITHOUT the flag renders the normal header and footer, unchanged', async () => {
    const plain = await renderLayout();
    const plainHtml = plain.container.innerHTML;
    plain.unmount();

    state.store = baseStore({ external_site_url: SITE, return_mode: 'auto', back_label: { sv: 'Tillbaka' } });
    const { container } = await renderLayout();
    expect(q(container, 'builtin-header')).not.toBeNull();
    expect(q(container, 'builtin-header')?.getAttribute('data-collections')).toBe('1');
    expect(q(container, 'builtin-footer')).not.toBeNull();
    expect(q(container, 'focused-header')).toBeNull();
    expect(q(container, 'focused-footer')).toBeNull();
    // Byte-identical markup to the store without the setting.
    expect(container.innerHTML).toBe(plainHtml);
    expect(api.getPublishedHeader).toHaveBeenCalled();
    expect(api.getMenus).toHaveBeenCalled();
    expect(api.getCreatorCategories).toHaveBeenCalled();
    expect(lastProviderCheckout()).not.toHaveProperty('external_focus');
  });

  it('a site without the flag keeps its published builder HEADER / FOOTER pages', async () => {
    state.store = baseStore({ external_site_url: SITE });
    state.publishedHeader = HEADER_PAGE;
    state.publishedFooter = FOOTER_PAGE;
    const { container } = await renderLayout();
    const chrome = [...container.querySelectorAll('[data-testid="published-chrome"]')].map((el) => el.getAttribute('data-keys'));
    expect(chrome).toEqual(['announcement-bar,header-bar,mobile-bottom-nav', 'footer-columns,newsletter-signup']);
    expect(q(container, 'focused-header')).toBeNull();
  });

  it('focused: the built-in header and footer are replaced by the focused pair', async () => {
    state.store = baseStore({ external_site_url: SITE, external_focus: true });
    const { container } = await renderLayout();
    const header = container.querySelector('#store-nav-header');
    const footer = container.querySelector('#store-nav-footer');
    expect(header?.querySelector('[data-testid="focused-header"]')?.getAttribute('data-name')).toBe('Möllstrands');
    expect(header?.children).toHaveLength(1);
    expect(q(container, 'builtin-header')).toBeNull();
    expect(q(container, 'builtin-footer')).toBeNull();
    // Footer: legal links + cookie page; the cookie settings link is part of
    // the focused footer itself (no separate row after it). No `footer` menu
    // in this store: no menu links.
    const focusedFooter = footer?.querySelector('[data-testid="focused-footer"]');
    expect(focusedFooter?.getAttribute('data-legal')).toBe('privacy,terms');
    expect(focusedFooter?.getAttribute('data-cookie')).toBe('/om-cookies');
    expect(focusedFooter?.getAttribute('data-menu')).toBe('');
    expect(footer?.children).toHaveLength(1);
    expect(footer?.querySelector('[data-testid="cookie-settings"]')).toBeNull();
    expect(q(container, 'page')).not.toBeNull();
    expect(lastProviderCheckout()).toMatchObject({ external_site_url: SITE, external_focus: true });
  });

  it('focused: a published builder HEADER / FOOTER page is replaced too (no menu, announcement bar or bottom nav)', async () => {
    state.store = baseStore({ external_site_url: SITE, external_focus: true });
    state.publishedHeader = HEADER_PAGE;
    state.publishedFooter = FOOTER_PAGE;
    const { container } = await renderLayout();
    expect(q(container, 'published-chrome')).toBeNull();
    expect(q(container, 'focused-header')).not.toBeNull();
    expect(q(container, 'focused-footer')).not.toBeNull();
    // The published chrome and the collections are not even read; the menus
    // are (the `footer` menu feeds the focused footer's links).
    expect(api.getPublishedHeader).not.toHaveBeenCalled();
    expect(api.getPublishedFooter).not.toHaveBeenCalled();
    expect(api.getCreatorCategories).not.toHaveBeenCalled();
  });

  it('focused: the store\'s `footer` menu (labels for the locale) and the logo go to the focused footer', async () => {
    state.store = { ...baseStore({ external_site_url: SITE, external_focus: true }), logo_url: '/uploads/logo.svg' };
    api.getMenus.mockResolvedValueOnce([
      { key: 'header', items: [{ id: 'h1', label: 'Kurser', url: '/collections/kurser' }] },
      {
        key: 'footer',
        items: [
          { id: 'f1', label: 'Terms', label_i18n: { sv: 'Köpvillkor' }, url: 'https://mollstrands.example/kopvillkor/' },
          { id: 'f2', label: 'Kontakt', url: 'https://mollstrands.example/kontakt/' },
        ],
      },
    ]);
    const { container } = await renderLayout();
    const focusedFooter = q(container, 'focused-footer');
    expect(focusedFooter?.getAttribute('data-menu')).toBe(
      'Köpvillkor=https://mollstrands.example/kopvillkor/|Kontakt=https://mollstrands.example/kontakt/',
    );
    expect(focusedFooter?.getAttribute('data-logo')).toBe('/uploads/logo.svg');
  });

  it('focused: an unreadable menu list falls back to the legal pages (no menu links)', async () => {
    state.store = baseStore({ external_site_url: SITE, external_focus: true });
    api.getMenus.mockRejectedValueOnce(new Error('down'));
    const { container } = await renderLayout();
    const focusedFooter = q(container, 'focused-footer');
    expect(focusedFooter?.getAttribute('data-menu')).toBe('');
    expect(focusedFooter?.getAttribute('data-legal')).toBe('privacy,terms');
  });

  it('focused: no market suggestion banner, region picker or buyer toggle', async () => {
    state.suggestedMarket = { key: 'no', country: 'NO' };
    state.publishedHeader = HEADER_WITHOUT_BAR;

    state.store = { ...baseStore({ external_site_url: SITE }), market: SE, markets: [SE, EU], apps: { b2b: { settings: {} } } };
    const normal = await renderLayout();
    expect(q(normal.container, 'market-suggest')).not.toBeNull();
    expect(q(normal.container, 'region-picker')).not.toBeNull();
    normal.unmount();

    state.store = {
      ...baseStore({ external_site_url: SITE, external_focus: true }),
      market: SE,
      markets: [SE, EU],
      apps: { b2b: { settings: {} } },
    };
    const { container } = await renderLayout();
    expect(q(container, 'focused-header')).not.toBeNull();
    expect(q(container, 'market-suggest')).toBeNull();
    expect(q(container, 'region-picker')).toBeNull();
    expect(q(container, 'buyer-toggle')).toBeNull();
  });

  it('M155: the strip under a published header carries the picker only without a header-bar that shows it', async () => {
    const multi = { ...baseStore(), market: SE, markets: [SE, EU] };

    // A header-bar with the language control renders the picker itself.
    state.store = multi;
    state.publishedHeader = HEADER_PAGE;
    let r = await renderLayout();
    expect(q(r.container, 'region-picker')).toBeNull();
    r.unmount();

    // header-bar with the control switched off: the strip picker.
    state.publishedHeader = {
      id: 'h3',
      snapshot: { sections: [{ id: 'b', section_key: 'header-bar', settings: { show_locale: false } }] },
    };
    r = await renderLayout();
    expect(q(r.container, 'region-picker')).not.toBeNull();
    r.unmount();

    // No header-bar at all: the strip picker.
    state.publishedHeader = HEADER_WITHOUT_BAR;
    r = await renderLayout();
    expect(q(r.container, 'region-picker')).not.toBeNull();
    r.unmount();

    // One market: no picker and no strip.
    state.store = { ...baseStore(), market: SE, markets: [SE] };
    r = await renderLayout();
    expect(q(r.container, 'region-picker')).toBeNull();
  });

  it('focused but the external site is the host being served: the normal chrome (loop guard)', async () => {
    state.store = baseStore({ external_site_url: SITE, external_focus: true });
    state.host = 'www.mollstrands.example';
    const { container } = await renderLayout();
    expect(q(container, 'builtin-header')).not.toBeNull();
    expect(q(container, 'focused-header')).toBeNull();
    // The client tree gets the same verdict: the flag is not passed on.
    expect(lastProviderCheckout()).not.toHaveProperty('external_focus');
    expect(lastProviderCheckout()).toMatchObject({ external_site_url: SITE });
  });

  it('a flag without a valid site is ignored', async () => {
    state.store = baseStore({ external_site_url: 'http://mollstrands.example', external_focus: true });
    const { container } = await renderLayout();
    expect(q(container, 'builtin-header')).not.toBeNull();
    expect(q(container, 'focused-header')).toBeNull();
  });

  it('focused: the WebSite JSON-LD advertises no search on the (redirected) listing', async () => {
    const searchAction = (c: HTMLElement) =>
      [...c.querySelectorAll('script[type="application/ld+json"]')].some((s) => (s.textContent ?? '').includes('SearchAction'));
    const normal = await renderLayout();
    expect(searchAction(normal.container)).toBe(true);
    normal.unmount();
    state.store = baseStore({ external_site_url: SITE, external_focus: true });
    const { container } = await renderLayout();
    expect(searchAction(container)).toBe(false);
  });
});
