import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { resetFontFailureBackoff } from '@/lib/storeFonts';

// GDPR: a store's fonts are always served from our own origin. The layout
// is rendered for real with the real font code (src/lib/storeFonts.ts); only
// the network is stubbed. Whether the Google CSS can be inlined or not, the
// HTML never names fonts.googleapis.com or fonts.gstatic.com.

const state = { store: {} as Record<string, unknown> };

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'host' ? 'namez.se' : null) }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('next-intl/server', () => ({ getMessages: async () => ({}) }));
vi.mock('@/lib/api', () => ({
  storefront: {
    getPublishedHeader: async () => null,
    getPublishedFooter: async () => null,
    getMenus: async () => [],
    getCreatorCategories: async () => [],
    getLegalPages: async () => [],
    getStore: async () => state.store,
  },
  resolveMediaUrl: (u: string) => u,
  LEGAL_SLUGS: [],
}));
vi.mock('@/lib/platform', () => ({ getPlatformName: async () => 'ShopsDoor' }));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => undefined,
  getRequestNoindex: async () => false,
  getRequestSuggestedMarket: async () => null,
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
      Layout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
    }),
  };
});
vi.mock('@/themes/SectionRenderer', () => ({ SectionRenderer: () => null }));
vi.mock('@/components/layout/StoreHeader', () => ({ StoreHeader: () => null }));
vi.mock('@/components/layout/StoreFooter', () => ({ StoreFooter: () => null }));
vi.mock('@/components/layout/FocusedHeader', () => ({ FocusedHeader: () => null }));
vi.mock('@/components/layout/FocusedFooter', () => ({ FocusedFooter: () => null }));
vi.mock('@/components/providers/StoreProviders', () => ({
  StoreProviders: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
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

import StoreLayout from './layout';

// Google-shaped CSS2 answer: per requested family and weight, a latin and an
// arabic subset face on fonts.gstatic.com.
function googleCss(url: string): string {
  const families = [...new URL(url).searchParams.getAll('family')].map((f) => f.split(':')[0]!);
  return families
    .flatMap((family) => {
      const slug = family.toLowerCase().replace(/\s+/g, '');
      return [400, 500, 600, 700].flatMap((w) => [
        `/* arabic */\n@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-weight: ${w};\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/${slug}/v1/arabic-${w}.woff2) format('woff2');\n  unicode-range: U+0600-06FF, U+0750-077F;\n}`,
        `/* latin */\n@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-weight: ${w};\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/${slug}/v1/latin-${w}.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153;\n}`,
      ]);
    })
    .join('\n');
}

const fetchOk = vi.fn(async (url: string) => new Response(googleCss(url), { status: 200 }));
// Google slow or unreachable (the cold-cache timeout that produced the
// Google <link> on namez.se).
const fetchDown = vi.fn(async () => {
  throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
});

const namezStore = {
  id: 'namez',
  name: 'Namez',
  slug: 'namez-se',
  language_config: { primary_locale: 'sv', secondary_locales: ['en'] },
  apps: {},
  // Namez after the dashboard theme save (colour / product values are not
  // read by the font code).
  theme_customizations: {
    colors: {},
    listing: {},
    product: {},
    typography: { fontFamily: { body: 'Noto Sans', heading: 'Noto Sans' } },
  },
};
const arabicStore = {
  id: 'ar',
  name: 'متجر',
  slug: 'ar-store',
  language_config: { primary_locale: 'ar', secondary_locales: [] },
  apps: {},
  theme_customizations: {
    typography: {
      fontFamily: { body: 'Noto Sans Arabic', heading: 'Noto Naskh Arabic' },
      fontFamilyArabic: { body: 'Noto Sans Arabic', heading: 'Noto Naskh Arabic' },
    },
  },
};
const newrojStore = {
  id: 'newroj',
  name: 'NEWROJ',
  slug: 'newroj',
  language_config: { primary_locale: 'en', secondary_locales: ['ar'] },
  apps: {},
  theme: { typography: { button: { fontFamily: 'Inter' } } },
  theme_customizations: {
    typography: {
      fontFamily: { heading: 'Playfair Display', body: 'Inter' },
      fontFamilyArabic: { heading: 'Noto Naskh Arabic' },
    },
  },
};

async function renderHtml(store: Record<string, unknown>): Promise<string> {
  state.store = store;
  const tree = await StoreLayout({
    children: <div data-testid="page" />,
    params: Promise.resolve({ storeSlug: String(store.slug) }),
  });
  render(tree);
  return document.documentElement.outerHTML;
}

const GOOGLE = /fonts\.(googleapis|gstatic)\.com/;
const fontLinks = () =>
  [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')].map((l) => l.getAttribute('href'));
const preloads = () => [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href'));

beforeEach(() => {
  resetFontFailureBackoff();
  fetchOk.mockClear();
  fetchDown.mockClear();
  document.head.innerHTML = '';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ['Namez (Noto Sans)', namezStore, ['Noto Sans']],
  ['Arabic store (Noto Sans Arabic / Noto Naskh Arabic)', arabicStore, ['Noto Sans Arabic', 'Noto Naskh Arabic']],
  ['NEWROJ (Playfair Display / Inter)', newrojStore, ['Playfair Display', 'Inter']],
])('store fonts are served from our own origin: %s', (_name, store, families) => {
  it('Google CSS inlined: every font URL is /fonts-cdn, no Google origin, no link', async () => {
    vi.stubGlobal('fetch', fetchOk);
    const html = await renderHtml(store);
    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(html).not.toMatch(GOOGLE);
    for (const family of families) {
      const slug = family.toLowerCase().replace(/\s+/g, '');
      expect(html).toContain(`font-family:'${family}'`);
      expect(html).toContain(`url(/fonts-cdn/s/${slug}/v1/`);
    }
    expect(html).toContain('font-display:swap');
    expect(fontLinks()).toEqual([]);
    expect(preloads().length).toBeGreaterThan(0);
    expect(preloads().every((h) => h?.startsWith('/fonts-cdn/s/'))).toBe(true);
  });

  it('Google unreachable: one same-origin /fonts-cdn/css2 stylesheet, never a Google link', async () => {
    vi.stubGlobal('fetch', fetchDown);
    const html = await renderHtml(store);
    expect(html).not.toMatch(GOOGLE);
    const links = fontLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatch(/^\/fonts-cdn\/css2\?family=/);
    for (const family of families) {
      expect(links[0]).toContain(`family=${family.replace(/ /g, '+')}:wght@400;500;600;700`);
    }
    expect(links[0]).toMatch(/&display=swap$/);
  });
});

describe('Namez exactly', () => {
  it('fallback stylesheet is the Noto Sans 400-700 CSS from our origin', async () => {
    vi.stubGlobal('fetch', fetchDown);
    await renderHtml(namezStore);
    expect(fontLinks()).toEqual(['/fonts-cdn/css2?family=Noto+Sans:wght@400;500;600;700&display=swap']);
  });
});
