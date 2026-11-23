import { beforeEach, describe, expect, it, vi } from 'vitest';

// M166 D2: a store page requested in another letter case / Unicode form
// answers one 308 to the stored slug (query and prefix kept); the stored
// form renders as before.

const state = {
  v2: null as { slug?: string } | null,
  legacy: null as { slug: string; status: string } | null,
  pathPrefix: undefined as string | undefined,
};
const focused = vi.fn(async () => undefined);

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock('@/lib/market.server', () => ({ getRequestPathPrefix: async () => state.pathPrefix }));
vi.mock('@/lib/focusedStorefront.server', () => ({ redirectFocusedBrowsing: (...a: unknown[]) => focused(...(a as [])) }));
vi.mock('@/components/store/StorePageView', () => ({
  fetchStorePage: async () => ({ store: null, v2: state.v2, legacy: state.legacy }),
  buildStorePageMetadata: async () => ({}),
  StorePageView: () => null,
}));

import StoreStaticPage from './page';

const run = (pageSlug: string, query: Record<string, string> = {}) =>
  StoreStaticPage({ params: Promise.resolve({ storeSlug: 'namez-se', pageSlug }), searchParams: Promise.resolve(query) });

beforeEach(() => {
  state.v2 = { slug: 'kontakta-oss' };
  state.legacy = null;
  state.pathPrefix = undefined;
  focused.mockClear();
});

describe('store page letter case (M166 D2)', () => {
  it('uppercase -> one 308 to the stored slug, query kept', async () => {
    await expect(run('Kontakta-Oss', { x: '1' })).rejects.toThrow('redirect:/kontakta-oss?x=1');
    expect(focused).not.toHaveBeenCalled();
  });

  it('legacy locale folder (?lang=ar) and market prefix are kept', async () => {
    await expect(run('Kontakta-Oss', { lang: 'ar' })).rejects.toThrow('redirect:/ar/kontakta-oss');
    state.pathPrefix = '/de-de';
    await expect(run('Kontakta-Oss', { lang: 'de' })).rejects.toThrow('redirect:/de-de/kontakta-oss');
  });

  it('the stored form renders (no redirect, no loop)', async () => {
    await expect(run('kontakta-oss')).resolves.toBeTruthy();
    expect(focused).toHaveBeenCalledTimes(1);
  });

  it('non-ASCII slug: NFD request -> stored NFC once; the encoded stored form renders', async () => {
    state.v2 = { slug: 'kläder' };
    const nfd = encodeURIComponent('kläder');
    await expect(run(nfd)).rejects.toThrow(`redirect:/${encodeURIComponent('kläder').toLowerCase()}`);
    await expect(run(encodeURIComponent('kläder'))).resolves.toBeTruthy();
  });

  it('a stored slug holding %xx is never a redirect target', async () => {
    state.v2 = { slug: 'a%20b' };
    await expect(run('A%2520B')).resolves.toBeTruthy();
  });

  it('legacy static page slug is used too', async () => {
    state.v2 = null;
    state.legacy = { slug: 'om-oss', status: 'PUBLISHED' };
    await expect(run('Om-Oss')).rejects.toThrow('redirect:/om-oss');
  });

  it('unknown page: no redirect (404 path unchanged)', async () => {
    state.v2 = null;
    await expect(run('Okand')).resolves.toBeTruthy();
  });
});
