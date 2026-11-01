import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/hooks/useAuth';
import StoreForgotPasswordPage from './page';

const h = vi.hoisted(() => ({ calls: [] as { endpoint: string; body: unknown }[] }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/auth/forgot-password',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(async (endpoint: string, opts: { body?: string } = {}) => {
    h.calls.push({ endpoint, body: opts.body ? JSON.parse(opts.body) : undefined });
    return { ok: true };
  }),
}));

beforeEach(() => {
  h.calls.length = 0;
  localStorage.clear();
});

describe('store forgot-password page', () => {
  it('sends the route store slug and the hostname, not a slug guessed from the host', async () => {
    render(
      <AuthProvider storeSlug="namez-se" storeId="store-1">
        <StoreForgotPasswordPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@x.se' } });
    fireEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));

    expect(await screen.findByText('resetLinkSent')).toBeInTheDocument();
    expect(h.calls).toEqual([
      {
        endpoint: '/auth/forgot-password',
        body: { email: 'a@x.se', store_slug: 'namez-se', hostname: window.location.hostname },
      },
    ]);
  });
});
