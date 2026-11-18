import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { store: {} as Record<string, unknown>, fail: false };

vi.mock('@/lib/api', () => ({
  storefront: {
    getStore: async () => {
      if (state.fail) throw new Error('down');
      return state.store;
    },
  },
  resolveMediaUrl: (u?: string | null) => (u ? (u.startsWith('http') ? u : `https://api.example${u}`) : ''),
}));

import { GET } from './route';

const call = () =>
  GET(new Request('http://newroj.localhost/favicon.ico'), { params: Promise.resolve({ storeSlug: 'newroj' }) });

describe('store /favicon.ico route', () => {
  beforeEach(() => {
    state.store = {};
    state.fail = false;
  });

  it('store with a favicon: 307 to its own file', async () => {
    state.store = { favicon_url: '/uploads/fav.png' };
    const res = await call();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://api.example/uploads/fav.png');
  });

  it('store without a favicon: the platform file', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/x-icon');
    const bytes = new Uint8Array(await res.arrayBuffer());
    // ICO header: reserved 0, type 1.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0, 0, 1, 0]);
  });

  it('store that is not LIVE: the platform file, even with a favicon', async () => {
    state.store = { coming_soon: true, favicon_url: '/uploads/fav.png' };
    expect((await call()).status).toBe(200);
  });

  it('lookup failure: the platform file', async () => {
    state.fail = true;
    expect((await call()).status).toBe(200);
  });
});
