import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAMEZ_EU, NAMEZ_SE } from './localePaths.fixtures';
import type { SectionInstance } from '@/themes/types';

// Server wiring of M164 part 2: the rewriter is the identity (and reads
// nothing) without a market, on a market preview and on a focused store;
// with a market it reads the sitemap data once, lazily.

const state = {
  market: { key: 'eu' } as { key: string; preview?: true } | undefined,
  focused: false,
  sitemapFails: false,
};

const getSitemapData = vi.fn(async () => {
  if (state.sitemapFails) throw new Error('api down');
  return {
    products: [
      {
        slug: 'personal-3d-standing-name-sign',
        slugs: {
          sv: 'personlig-3d-staende-namnskylt',
          en: 'personal-3d-standing-name-sign',
          de: 'personalisiertes-freistehendes-3d-namensschild',
        },
      },
    ],
  };
});

vi.mock('server-only', () => ({}));
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }));
vi.mock('./api', () => ({ storefront: { getSitemapData: (...a: unknown[]) => getSitemapData(...(a as [])) } }));
vi.mock('./market.server', () => ({
  getRequestMarket: async () => state.market,
  getRequestNoindex: async () => false,
}));
vi.mock('./focusedStorefront.server', () => ({
  requestFocusedStorefront: async () => (state.focused ? { url: 'https://site.example' } : null),
}));

const { productLinkRewriter } = await import('./productLinkCanonical.server');

const marketStore = {
  language_config: { primary_locale: 'en', secondary_locales: NAMEZ_EU.locales },
  market: NAMEZ_EU,
  markets: [NAMEZ_SE, NAMEZ_EU],
};
const section = (url: string): SectionInstance => ({
  id: 's',
  section_key: 'hero-slider',
  sort_order: 0,
  settings: { url },
  translations: [],
});

beforeEach(() => {
  getSitemapData.mockClear();
  state.market = { key: 'eu' };
  state.focused = false;
  state.sitemapFails = false;
});

describe('productLinkRewriter', () => {
  it('no market: identity, no read (single- and multi-locale stores)', async () => {
    state.market = undefined;
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    for (const store of [{ language_config: { primary_locale: 'sv', secondary_locales: ['en'] } }, null]) {
      const rw = await productLinkRewriter('anna', store, 'en');
      expect(await rw.sections(sections)).toBe(sections);
      expect(await rw.html('<a href="/products/personlig-3d-staende-namnskylt">x</a>')).toBe(
        '<a href="/products/personlig-3d-staende-namnskylt">x</a>',
      );
    }
    expect(getSitemapData).not.toHaveBeenCalled();
  });

  it('market preview and focused store: identity, no read', async () => {
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    state.market = { key: 'eu', preview: true };
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
    state.market = { key: 'eu' };
    state.focused = true;
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
    expect(getSitemapData).not.toHaveBeenCalled();
  });

  it('market store: no candidate -> no read; candidate -> rewritten', async () => {
    const rw = await productLinkRewriter('namez-se', marketStore, 'de');
    const plain = [section('/collections/x')];
    expect(await rw.sections(plain)).toBe(plain);
    expect(getSitemapData).not.toHaveBeenCalled();
    const out = await rw.sections([section('/de-de/products/personlig-3d-staende-namnskylt')]);
    expect(out[0].settings.url).toBe('/de-de/products/personalisiertes-freistehendes-3d-namensschild');
    expect(getSitemapData).toHaveBeenCalledWith('namez-se', { key: 'eu' });
  });

  it('read failure: links render as typed', async () => {
    state.sitemapFails = true;
    const sections = [section('/products/personlig-3d-staende-namnskylt')];
    expect(await (await productLinkRewriter('namez-se', marketStore, 'de')).sections(sections)).toBe(sections);
  });
});
