import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const h = vi.hoisted(() => ({
  calls: [] as { endpoint: string; body: unknown }[],
  response: null as unknown,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(async (endpoint: string, opts: { body?: string } = {}) => {
    h.calls.push({ endpoint, body: opts.body ? JSON.parse(opts.body) : undefined });
    return h.response;
  }),
}));

function submit(email: string) {
  fireEvent.change(screen.getByLabelText('email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'signIn' }));
}

beforeEach(() => {
  h.calls.length = 0;
  h.response = null;
  localStorage.clear();
});

describe('platform login (staff only)', () => {
  it('sends no store context and keeps no customer session', async () => {
    h.response = { user: { role: 'CUSTOMER' }, access_token: 'a', refresh_token: 'r' };
    render(<LoginPage />);

    submit('buyer@x.se');

    // The hint is always shown; the error repeats it after the attempt.
    await waitFor(() => expect(screen.getAllByText('platformCustomerSignIn')).toHaveLength(2));
    expect(h.calls).toEqual([
      { endpoint: '/auth/login', body: { email: 'buyer@x.se', password: 'secret123' } },
    ]);
    expect(localStorage.getItem('auth_access_token')).toBeNull();
    expect(localStorage.getItem('auth_refresh_token')).toBeNull();
  });

  it('sends a two-step verification challenge to the dashboard login', async () => {
    h.response = { requires_2fa: true, challenge_token: 'c', expires_in: 300 };
    const location = window.location;
    // jsdom cannot navigate: capture the href assignment instead.
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
    try {
      render(<LoginPage />);
      submit('admin@x.se');
      await waitFor(() => expect(window.location.href).toMatch(/\/auth\/login$/));
      expect(screen.queryByText('platformCustomerSignIn', { selector: 'div' })).toBeNull();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: location });
    }
  });

  it('shows the staff-only copy and the customer hint up front', () => {
    render(<LoginPage />);
    expect(screen.getByText('platformStaffOnly')).toBeInTheDocument();
    expect(screen.getByText('platformCustomerSignIn')).toBeInTheDocument();
  });
});
