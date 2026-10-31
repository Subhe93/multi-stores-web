import { StrictMode, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/hooks/useAuth';
import { MagicLogin } from './MagicLogin';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  routes: {} as Record<string, (body: unknown) => unknown>,
  calls: [] as { endpoint: string; body: unknown }[],
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/auth/magic',
  useRouter: () => ({ push: vi.fn(), replace: h.replace, prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
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

function invalidLink(): never {
  const err = new Error('Invalid link') as Error & { code?: string; status?: number };
  err.code = 'MAGIC_LINK_INVALID';
  err.status = 401;
  throw err;
}

function renderPage() {
  return render(
    <StrictMode>
      <AuthProvider>
        <MagicLogin variant="store" />
      </AuthProvider>
    </StrictMode>,
  );
}

const magicCalls = () => h.calls.filter((c) => c.endpoint === '/auth/magic-login');

beforeEach(() => {
  h.replace.mockReset();
  h.calls.length = 0;
  h.routes = {};
  localStorage.clear();
  window.history.replaceState(null, '', '/auth/magic?token=secret-token&utm=mail');
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('MagicLogin', () => {
  it('exchanges the token once, stores the session and goes to the account page', async () => {
    h.routes['/auth/magic-login'] = () => ({
      user: { role: 'CUSTOMER' },
      access_token: 'access-1',
      refresh_token: 'refresh-1',
    });
    h.routes['/auth/me'] = () => ({ id: 'u1', name: 'A', email: 'a@x.se', role: 'CUSTOMER' });
    const changed = vi.fn();
    window.addEventListener('auth-changed', changed);

    renderPage();

    // The token leaves the address bar right away; other params stay.
    expect(window.location.search).toBe('?utm=mail');
    expect(screen.getByText('magicLoading')).toBeInTheDocument();

    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/account'));
    // Strict mode runs the effect twice; the single-use token is sent once.
    expect(magicCalls()).toEqual([{ endpoint: '/auth/magic-login', body: { token: 'secret-token' } }]);
    expect(localStorage.getItem('auth_access_token')).toBe('access-1');
    expect(localStorage.getItem('auth_refresh_token')).toBe('refresh-1');
    expect(changed).toHaveBeenCalled();
    window.removeEventListener('auth-changed', changed);
  });

  it('shows the friendly card with login and forgot-password links when the link is spent', async () => {
    h.routes['/auth/magic-login'] = invalidLink;

    renderPage();

    expect(await screen.findByText('magicInvalid')).toBeInTheDocument();
    expect(screen.getByText('magicInvalidHint')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'magicLogin' })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByRole('link', { name: 'magicForgot' })).toHaveAttribute('href', '/auth/forgot-password');
    expect(magicCalls()).toHaveLength(1);
    expect(localStorage.getItem('auth_access_token')).toBeNull();
    expect(h.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?utm=mail');
  });

  it('reads the token from the URL fragment (current emails) and strips it', async () => {
    window.history.replaceState(null, '', '/auth/magic?utm=mail#token=hash-token');
    h.routes['/auth/magic-login'] = () => ({
      user: { role: 'CUSTOMER' },
      access_token: 'access-3',
      refresh_token: 'refresh-3',
    });
    h.routes['/auth/me'] = () => ({ id: 'u1', name: 'A', email: 'a@x.se', role: 'CUSTOMER' });

    renderPage();

    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?utm=mail');
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/account'));
    expect(magicCalls()).toEqual([{ endpoint: '/auth/magic-login', body: { token: 'hash-token' } }]);
  });

  it('does not call the API without a token', async () => {
    window.history.replaceState(null, '', '/auth/magic');

    renderPage();

    expect(await screen.findByText('magicInvalid')).toBeInTheDocument();
    expect(magicCalls()).toHaveLength(0);
  });

  it('refuses a dashboard account without keeping its tokens', async () => {
    h.routes['/auth/magic-login'] = () => ({
      user: { role: 'CREATOR' },
      access_token: 'access-2',
      refresh_token: 'refresh-2',
    });

    renderPage();

    expect(await screen.findByText('dashboardAccountNotAllowed')).toBeInTheDocument();
    expect(localStorage.getItem('auth_access_token')).toBeNull();
    expect(h.replace).not.toHaveBeenCalled();
  });
});
