import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

// The store home reads the product list only for its built-in layout; a
// published builder home never showed it, so it no longer fetches it.

const state = { publishedHome: null as unknown };
const getProducts = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []);

vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: async () => ({
      name: 'Namez',
      currency: 'SEK',
      language_config: { primary_locale: 'sv', secondary_locales: ['ar'] },
      theme_key: 'minimal',
    }),
    getCreatorCategories: async () => [],
    getPublishedHome: async () => state.publishedHome,
    getProducts: (...a: unknown[]) => getProducts(...a),
  },
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/lib/market.server', () => ({ getRequestMarket: async () => 'se', getRequestNoindex: async () => false }));
vi.mock('@/lib/focusedStorefront.server', () => ({ redirectFocusedBrowsing: async () => undefined }));
vi.mock('@/lib/preloadSections', () => ({ preloadSectionData: async () => ({}) }));
vi.mock('@/themes/registry', () => ({ resolveTheme: () => ({ key: 'minimal' }) }));
vi.mock('@/themes/SectionRenderer', () => ({ SectionRenderer: (): ReactNode => null }));

import StoreHomePage from './page';

const run = (lang?: string) =>
  StoreHomePage({
    params: Promise.resolve({ storeSlug: 'namez-se' }),
    searchParams: Promise.resolve(lang ? { lang } : {}),
  });

beforeEach(() => {
  state.publishedHome = null;
  getProducts.mockClear();
});

describe('store home product list', () => {
  it('a published builder home does not fetch the list', async () => {
    state.publishedHome = { id: 'h', type: 'HOME', seo: {}, snapshot: { page: { type: 'HOME', translations: [] }, sections: [{ id: 's', section_key: 'hero' }] } };
    await run();
    expect(getProducts).not.toHaveBeenCalled();
  });

  it('the built-in home makes the same request as before', async () => {
    await run('ar');
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith('namez-se', { featured: 'true', locale: 'ar' }, 'se');
  });
});
