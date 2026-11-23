import { describe, expect, it, vi } from 'vitest';

// M166 D2: `/legal/Shipping` -> one 308 to `/legal/shipping`.

const state = { pathPrefix: undefined as string | undefined };

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('@/lib/market.server', () => ({
  getRequestMarket: async () => undefined,
  getRequestNoindex: async () => false,
  getRequestPathPrefix: async () => state.pathPrefix,
}));
vi.mock('@/lib/focusedStorefront.server', () => ({ requestFocusedStorefront: async () => null }));
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  storefront: {
    getStore: async () => ({ language_config: { primary_locale: 'sv' } }),
    getLegalPage: async () => {
      throw new Error('stop-after-redirect-check');
    },
    getLegalPages: async () => [],
  },
}));
vi.mock('@/components/store/StorePageView', () => ({
  fetchStorePage: async () => ({ store: null, v2: null, legacy: null }),
  buildStorePageMetadata: async () => ({}),
  StorePageView: () => null,
}));

import StoreLegalPage from './page';

const run = (slug: string, query: Record<string, string> = {}) =>
  StoreLegalPage({ params: Promise.resolve({ storeSlug: 'namez-se', slug }), searchParams: Promise.resolve(query) });

describe('legal page letter case (M166 D2)', () => {
  it('uppercase -> 308 to the lowercase legal URL, query and prefix kept', async () => {
    await expect(run('Shipping', { x: '1' })).rejects.toThrow('redirect:/legal/shipping?x=1');
    await expect(run('SHIPPING', { lang: 'ar' })).rejects.toThrow('redirect:/ar/legal/shipping');
    state.pathPrefix = '/de-at';
    await expect(run('Privacy', { lang: 'de' })).rejects.toThrow('redirect:/de-at/legal/privacy');
    state.pathPrefix = undefined;
  });

  it('lowercase passes the check; unknown slug stays a 404', async () => {
    await expect(run('shipping')).rejects.not.toThrow(/redirect:/);
    await expect(run('Unknown')).rejects.toThrow('notFound');
  });
});
