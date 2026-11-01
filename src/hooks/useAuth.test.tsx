import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthProvider,
  CUSTOMER_STORE_MISMATCH,
  NOT_CUSTOMER_ACCOUNT,
  profileMatchesStore,
  useAuth,
  type AuthStoreContext,
} from './useAuth';

const h = vi.hoisted(() => ({
  routes: {} as Record<string, (body: unknown) => unknown>,
  calls: [] as { endpoint: string; body: unknown }[],
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(async (endpoint: string, opts: { body?: string } = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    h.calls.push({ endpoint, body });
    const route = h.routes[endpoint];
    if (!route) throw new Error(`unexpected ${endpoint}`);
    return route(body);
  }),
}));

const STORE: AuthStoreContext = { storeSlug: 'shop', storeId: 'store-1' };
const HOST = window.location.hostname;

const tokens = { access_token: 'access-1', refresh_token: 'refresh-1' };
const customerOf = (storeId: string) => () => ({
  id: 'u1', name: 'A', email: 'a@x.se', role: 'CUSTOMER', store_id: storeId,
});

function renderAuth(ctx: AuthStoreContext = STORE) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider {...ctx}>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

const bodyOf = (endpoint: string) => h.calls.find((c) => c.endpoint === endpoint)?.body;

beforeEach(() => {
  h.calls.length = 0;
  h.routes = {};
  localStorage.clear();
});

describe('useAuth store context', () => {
  it('login sends the route store slug and the hostname', async () => {
    h.routes['/auth/login'] = () => tokens;
    h.routes['/auth/me'] = customerOf('store-1');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.login('a@x.se', 'secret123'));

    expect(bodyOf('/auth/login')).toEqual({
      email: 'a@x.se', password: 'secret123', store_slug: 'shop', hostname: HOST,
    });
    expect(result.current.user?.email).toBe('a@x.se');
    expect(localStorage.getItem('auth_access_token')).toBe('access-1');
  });

  it('register and guest-register carry the store context over caller values', async () => {
    h.routes['/auth/register'] = () => tokens;
    h.routes['/auth/guest-register'] = () => tokens;
    h.routes['/auth/me'] = customerOf('store-1');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.register({
      email: 'a@x.se', password: 'secret123', role: 'CUSTOMER', store_slug: 'other', locale: 'sv',
    }));
    await act(() => result.current.registerGuest({ email: 'b@x.se' }));

    expect(bodyOf('/auth/register')).toMatchObject({ store_slug: 'shop', hostname: HOST, locale: 'sv' });
    expect(bodyOf('/auth/guest-register')).toMatchObject({ email: 'b@x.se', store_slug: 'shop', hostname: HOST });
  });

  it('forgot-password sends the store context', async () => {
    h.routes['/auth/forgot-password'] = () => ({ ok: true });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.forgotPassword('a@x.se'));

    expect(bodyOf('/auth/forgot-password')).toEqual({ email: 'a@x.se', store_slug: 'shop', hostname: HOST });
  });

  it('sends no store context without a store (platform pages)', async () => {
    h.routes['/auth/forgot-password'] = () => ({ ok: true });
    const { result } = renderAuth({});
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.forgotPassword('staff@x.se'));

    expect(bodyOf('/auth/forgot-password')).toEqual({ email: 'staff@x.se' });
  });
});

describe('useAuth magic link and token swap', () => {
  it('loginWithMagicToken sends the token with the store context', async () => {
    h.routes['/auth/magic-login'] = () => ({ ...tokens, user: { role: 'CUSTOMER' } });
    h.routes['/auth/me'] = customerOf('store-1');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.loginWithMagicToken('magic-raw'));

    expect(bodyOf('/auth/magic-login')).toEqual({ token: 'magic-raw', store_slug: 'shop', hostname: HOST });
    expect(localStorage.getItem('auth_access_token')).toBe('access-1');
  });

  it('loginWithMagicToken sends no store context on the platform', async () => {
    h.routes['/auth/magic-login'] = () => ({ ...tokens, user: { role: 'CREATOR' } });
    const { result } = renderAuth({});
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.loginWithMagicToken('magic-raw')).rejects.toMatchObject({ code: NOT_CUSTOMER_ACCOUNT });
    expect(bodyOf('/auth/magic-login')).toEqual({ token: 'magic-raw' });
  });

  it('replaceTokens stores the new pair (after change-password)', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.replaceTokens({ access_token: 'new-a', refresh_token: 'new-r' }));

    expect(localStorage.getItem('auth_access_token')).toBe('new-a');
    expect(localStorage.getItem('auth_refresh_token')).toBe('new-r');
    expect(result.current.token).toBe('new-a');
  });
});

describe('useAuth profile store check', () => {
  it('rejects a login whose profile belongs to another store and keeps no tokens', async () => {
    h.routes['/auth/login'] = () => tokens;
    h.routes['/auth/me'] = customerOf('store-2');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let error: unknown;
    await act(async () => {
      try { await result.current.login('a@x.se', 'secret123'); } catch (e) { error = e; }
    });

    expect((error as { code?: string }).code).toBe(CUSTOMER_STORE_MISMATCH);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('auth_access_token')).toBeNull();
  });

  it('still rejects dashboard accounts with NOT_CUSTOMER_ACCOUNT', async () => {
    h.routes['/auth/login'] = () => tokens;
    h.routes['/auth/me'] = () => ({ id: 's1', name: 'S', email: 's@x.se', role: 'CREATOR', store_id: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.login('s@x.se', 'secret123')).rejects.toMatchObject({ code: NOT_CUSTOMER_ACCOUNT });
  });

  it('drops a saved session of another store on mount', async () => {
    localStorage.setItem('auth_access_token', 'old-access');
    localStorage.setItem('auth_refresh_token', 'old-refresh');
    h.routes['/auth/me'] = customerOf('store-2');
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('auth_access_token')).toBeNull();
  });

  it('never exposes a saved token before its profile is accepted', async () => {
    localStorage.setItem('auth_access_token', 'foreign-access');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.routes['/auth/me'] = async () => { await gate; return customerOf('store-2')(); };
    const { result } = renderAuth();

    // While /auth/me is pending (cart sync would run on `token`), no token.
    expect(result.current.token).toBeNull();
    release();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
  });

  it('keeps a saved session of this store on mount', async () => {
    localStorage.setItem('auth_access_token', 'old-access');
    h.routes['/auth/me'] = customerOf('store-1');
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe('u1');
    expect(result.current.token).toBe('old-access');
  });

  it('rejects a registered account whose profile is in another store', async () => {
    h.routes['/auth/register'] = () => tokens;
    h.routes['/auth/me'] = customerOf('store-2');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      result.current.register({ email: 'a@x.se', password: 'secret123', role: 'CUSTOMER' }),
    ).rejects.toMatchObject({ code: CUSTOMER_STORE_MISMATCH });
    expect(localStorage.getItem('auth_access_token')).toBeNull();
  });
});

describe('profileMatchesStore', () => {
  const customer = { id: 'u1', name: 'A', email: 'a@x.se', role: 'CUSTOMER' };

  it('compares the store id when the provider knows it', () => {
    expect(profileMatchesStore({ ...customer, store_id: 'store-1' }, STORE)).toBe(true);
    expect(profileMatchesStore({ ...customer, store_id: 'store-2' }, STORE)).toBe(false);
    expect(profileMatchesStore({ ...customer }, STORE)).toBe(false);
  });

  it('falls back to the slug, then to the store-scoped token', () => {
    expect(profileMatchesStore({ ...customer, store: { slug: 'shop' } }, { storeSlug: 'shop' })).toBe(true);
    expect(profileMatchesStore({ ...customer, store: { slug: 'other' } }, { storeSlug: 'shop' })).toBe(false);
    expect(profileMatchesStore({ ...customer, store_id: 'store-9' }, { storeSlug: 'shop' })).toBe(true);
  });

  it('accepts no customer without a store context', () => {
    expect(profileMatchesStore({ ...customer, store_id: 'store-1' }, {})).toBe(false);
  });
});
