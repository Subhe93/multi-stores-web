import { beforeEach, describe, expect, it, vi } from 'vitest';

// Icons metadata: the platform icon is a plain `icons` field of the root
// layout (not the `app/favicon.ico` file convention, which Next adds to every
// page), so a store with its own favicon replaces the whole set and a store
// without one inherits the platform icons.

const state = { store: {} as Record<string, unknown> };

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next-intl', () => ({ NextIntlClientProvider: () => null }));
vi.mock('next-intl/server', () => ({ getMessages: async () => ({}) }));
vi.mock('@/lib/api', () => ({
  storefront: { getStore: async () => state.store },
  resolveMediaUrl: (u: string) => `https://api.example${u}`,
  LEGAL_SLUGS: [],
}));
vi.mock('@/lib/platform', () => ({ getPlatformName: async () => 'ShopsDoor' }));
vi.mock('@/lib/storeFonts', () => ({ buildGoogleFontsHref: () => null, loadInlineFonts: async () => null, selfHostedFontsHref: () => null }));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => undefined,
  getRequestNoindex: async () => false,
  getRequestSuggestedMarket: async () => null,
}));
vi.mock('@/lib/storeGate.server', () => ({
  loadGatedStore: async () => ({ store: state.store, gate: 'live', preview: false }),
}));
vi.mock('@/themes/registry', () => ({
  resolveTheme: () => ({ key: 'minimal', tokens: {}, sections: {}, Layout: () => null }),
}));
vi.mock('@/themes/SectionRenderer', () => ({ SectionRenderer: () => null }));
vi.mock('@/components/layout/StoreHeader', () => ({ StoreHeader: () => null }));
vi.mock('@/components/layout/StoreFooter', () => ({ StoreFooter: () => null }));
vi.mock('@/components/layout/FocusedHeader', () => ({ FocusedHeader: () => null }));
vi.mock('@/components/layout/FocusedFooter', () => ({ FocusedFooter: () => null }));
vi.mock('@/components/providers/StoreProviders', () => ({ StoreProviders: () => null }));
vi.mock('@/components/layout/MarketSuggestBanner', () => ({ MarketSuggestBanner: () => null }));
vi.mock('@/components/layout/MarketPreviewBanner', () => ({ MarketPreviewBanner: () => null }));
vi.mock('@/components/layout/CountrySwitcher', () => ({ CountrySwitcher: () => null }));
vi.mock('@/components/layout/BuyerTypeToggle', () => ({ BuyerTypeToggle: () => null }));
vi.mock('@/components/IfApp', () => ({ IfApp: () => null }));
vi.mock('@/components/edit-hint/EditHintBoot', () => ({ EditHintBoot: () => null }));
vi.mock('@/components/layout/StoreGatePage', () => ({ StoreGatePage: () => null }));
vi.mock('@/components/layout/StorePreviewBar', () => ({ StorePreviewBar: () => null }));
vi.mock('@/components/layout/StorePreviewUnlock', () => ({ StorePreviewReset: () => null }));
vi.mock('@/components/tracking/StoreTracking', () => ({ StoreTracking: () => null }));
vi.mock('@/components/tracking/CookieSettingsLink', () => ({ CookieSettingsLink: () => null }));
vi.mock('@/components/StoreCustomCss', () => ({ StoreCustomCss: () => null }));
vi.mock('../../fonts/inter', () => ({ inter: { className: 'inter' } }));

import { generateMetadata as storeMetadata } from './layout';
import { generateMetadata as rootMetadata } from '../../layout';

const params = Promise.resolve({ storeSlug: 'newroj' });

describe('icons metadata', () => {
  beforeEach(() => {
    state.store = { name: 'Newroj', slug: 'newroj' };
  });

  it('platform: /favicon.ico first, then the two brand icons', async () => {
    const meta = await rootMetadata();
    expect(meta.icons).toEqual({
      icon: [
        { url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32 48x48' },
        { url: '/brand/app-icon.svg' },
      ],
      apple: '/brand/apple-icon.png',
    });
  });

  it('store with a favicon: only its own icon', async () => {
    state.store = { ...state.store, favicon_url: '/uploads/fav.png' };
    const meta = await storeMetadata({ params });
    expect(meta.icons).toEqual({ icon: 'https://api.example/uploads/fav.png' });
  });

  // An `icons: undefined` field would not inherit the platform set: Next
  // resolves it to no icon link at all (seen in a production build). The
  // store names the platform favicon itself, the one link it always had.
  it('store without a favicon: the platform /favicon.ico link, as before', async () => {
    const meta = await storeMetadata({ params });
    expect(meta.title).toBe('Newroj');
    expect(meta.icons).toEqual({
      icon: [{ url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32 48x48' }],
    });
  });

  it('store that is not LIVE: no override', async () => {
    state.store = { ...state.store, coming_soon: true, favicon_url: '/uploads/fav.png' };
    const meta = await storeMetadata({ params });
    expect(meta.icons).toBeUndefined();
  });

  it('no app/favicon.ico file convention is left', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    expect(existsSync(join(process.cwd(), 'src', 'app', 'favicon.ico'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'public', 'favicon.ico'))).toBe(true);
  });
});
