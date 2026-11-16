import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focused storefront, server side: the redirect helper the browsing pages
// call first thing, and the "back to site" link of the store 404. The
// decision itself is the pure `focusRedirectTarget` (focusedStorefront.spec);
// this file covers what the helper feeds it and that it fails safe.

const SITE = 'https://mollstrands.example/';

const state = {
  host: 'mollstrands.shopsdoor.com' as string | null,
  store: {} as Record<string, unknown>,
  gate: 'live' as 'live' | 'coming_soon' | 'paused',
  preview: false,
  storeFails: false,
  legal: [] as Array<{ slug: string; page_slug: string | null }>,
  legalFails: false,
};

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
const redirect = vi.fn((url: string) => {
  throw new RedirectSignal(url);
});
const getLegalPages = vi.fn(async () => {
  if (state.legalFails) throw new Error('legal list down');
  return state.legal;
});
const getStore = vi.fn(async () => {
  if (state.storeFails) throw new Error('api down');
  return state.store;
});

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'host' ? state.host : null) }),
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));
vi.mock('./api', () => ({
  storefront: { getLegalPages: () => getLegalPages(), getStore: () => getStore() },
}));
vi.mock('./market.server', () => ({ getRequestMarket: async () => undefined }));
vi.mock('./storeGate.server', () => ({
  loadGatedStore: async () => {
    if (state.storeFails) throw new Error('api down');
    return { store: state.store, gate: state.gate, preview: state.preview };
  },
}));

import { focusedBackToSite, redirectFocusedBrowsing, requestFocusedStorefront } from './focusedStorefront.server';

const focusedStore = (over: Record<string, unknown> = {}) => ({
  checkout: { external_site_url: SITE, external_focus: true },
  language_config: { primary_locale: 'sv' },
  ...over,
});

/** The URL the helper redirected to, or null when it returned normally. */
async function redirectOf(path: string): Promise<string | null> {
  try {
    await redirectFocusedBrowsing('mollstrands', path);
    return null;
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
}

beforeEach(() => {
  state.host = 'mollstrands.shopsdoor.com';
  state.store = focusedStore();
  state.gate = 'live';
  state.preview = false;
  state.storeFails = false;
  state.legal = [];
  state.legalFails = false;
  redirect.mockClear();
  getLegalPages.mockClear();
  getStore.mockClear();
});

describe('redirectFocusedBrowsing', () => {
  it('redirects the browsing pages of a focused store to the external site', async () => {
    for (const path of ['/', '/collections', '/products', '/om-oss']) {
      expect(await redirectOf(path)).toBe(SITE);
    }
  });

  it('home / collections / listing make no extra read (no legal list)', async () => {
    await redirectOf('/');
    await redirectOf('/collections');
    await redirectOf('/products');
    expect(getLegalPages).not.toHaveBeenCalled();
  });

  it('returns for a store without the flag, without reading anything else', async () => {
    state.store = { checkout: { external_site_url: SITE } };
    expect(await redirectOf('/')).toBeNull();
    expect(await redirectOf('/om-oss')).toBeNull();
    state.store = {};
    expect(await redirectOf('/')).toBeNull();
    expect(getLegalPages).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps the cookie page and the pages that serve a legal slug', async () => {
    state.store = focusedStore({ cookie_page_slug: 'om-kakor' });
    state.legal = [
      { slug: 'privacy', page_slug: 'integritet' },
      { slug: 'terms', page_slug: null },
    ];
    expect(await redirectOf('/om-kakor')).toBeNull();
    expect(await redirectOf('/integritet')).toBeNull();
    expect(await redirectOf('/om-oss')).toBe(SITE);
  });

  it('keeps a content page when the legal list cannot be read', async () => {
    state.legalFails = true;
    expect(await redirectOf('/om-oss')).toBeNull();
    // The other browsing pages do not depend on it.
    expect(await redirectOf('/')).toBe(SITE);
  });

  it('never redirects a store that is not LIVE, nor the owner preview', async () => {
    state.gate = 'coming_soon';
    expect(await redirectOf('/')).toBeNull();
    state.gate = 'paused';
    expect(await redirectOf('/collections')).toBeNull();
    state.gate = 'live';
    state.preview = true;
    expect(await redirectOf('/')).toBeNull();
    expect(await redirectOf('/om-oss')).toBeNull();
  });

  it('never redirects towards the host being served (loop guard)', async () => {
    state.host = 'mollstrands.example';
    expect(await redirectOf('/')).toBeNull();
    state.host = 'www.mollstrands.example';
    expect(await redirectOf('/products')).toBeNull();
  });

  it('returns normally when the store cannot be read (the page answers)', async () => {
    state.storeFails = true;
    expect(await redirectOf('/')).toBeNull();
  });
});

describe('requestFocusedStorefront / focusedBackToSite', () => {
  it('judges the raw checkout block for the request host', async () => {
    expect(await requestFocusedStorefront({ external_site_url: SITE, external_focus: true })).toEqual({
      siteUrl: SITE,
      siteHost: 'mollstrands.example',
    });
    expect(await requestFocusedStorefront({ external_site_url: SITE })).toBeNull();
    expect(await requestFocusedStorefront(undefined)).toBeNull();
    state.host = 'mollstrands.example';
    expect(await requestFocusedStorefront({ external_site_url: SITE, external_focus: true })).toBeNull();
  });

  it('builds the 404 link: merchant label for the locale, else "Back to <host>"', async () => {
    expect(await focusedBackToSite('mollstrands', null)).toEqual({
      href: SITE,
      label: 'returnToSite:mollstrands.example',
    });
    state.store = focusedStore({
      checkout: { external_site_url: SITE, external_focus: true, back_label: { sv: 'Tillbaka till Möllstrands' } },
    });
    expect(await focusedBackToSite('mollstrands', null)).toEqual({ href: SITE, label: 'Tillbaka till Möllstrands' });
    // Another locale in the URL: the Swedish label is not used.
    expect((await focusedBackToSite('mollstrands', 'en'))?.label).toBe('returnToSite:mollstrands.example');
  });

  it('is null for a store without the flag or an unreadable store', async () => {
    state.store = { checkout: { external_site_url: SITE } };
    expect(await focusedBackToSite('mollstrands', null)).toBeNull();
    state.storeFails = true;
    expect(await focusedBackToSite('mollstrands', null)).toBeNull();
  });
});
