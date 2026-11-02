import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './page';

// Platform sign-up (onboarding SPEC §2 / §7) as a two-step wizard: step 1 is
// the radio group of three path cards, step 2 the details card (the supplier
// path adds a company name). The terms checkbox and the honeypot travel in
// the body, and the API error codes map to friendly messages.

const apiMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: apiMock }));
vi.mock('@/lib/brand', () => ({ DASHBOARD_LOGIN_URL: 'https://dash.test/auth/login' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'sv',
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    return t;
  },
}));
// No GSAP in jsdom: the step reveal is cosmetic.
vi.mock('@/lib/animations', () => ({
  gsap: { fromTo: vi.fn() },
  useGSAP: () => undefined,
  DUR: { fast: 0 },
  EASE: { out: 'none' },
  prefersReducedMotion: () => true,
}));

afterEach(() => {
  apiMock.mockReset();
});

function fill(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
}

function continueToDetails() {
  fireEvent.click(screen.getByRole('button', { name: /wizard\.continue/ }));
}

describe('RegisterPage', () => {
  it('sends account_kind, accept_terms, names, locale and the empty honeypot; no role', async () => {
    apiMock.mockResolvedValue({ dashboard_login_url: 'https://dash.test/auth/magic#t' });
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { href: '', assign }, writable: true });
    render(<RegisterPage />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByRole('button', { name: /wizard\.continue/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /accountKind\.marketplace/ }));
    expect(screen.getByRole('radio', { name: /accountKind\.marketplace/ })).toHaveAttribute('aria-checked', 'true');

    continueToDetails();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(document.getElementById('companyName')).toBeNull();

    fill('firstName', 'Anna');
    fill('lastName', 'Svensson');
    fill('email', 'anna@example.com');
    fill('password', 'secret123');
    fill('confirmPassword', 'secret123');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    const [endpoint, init] = apiMock.mock.calls[0] as [string, { body: string }];
    expect(endpoint).toBe('/auth/register');
    expect(JSON.parse(init.body)).toEqual({
      email: 'anna@example.com',
      password: 'secret123',
      account_kind: 'marketplace',
      accept_terms: true,
      first_name: 'Anna',
      last_name: 'Svensson',
      locale: 'sv',
      website: '',
    });
    await waitFor(() => expect(window.location.href).toBe('https://dash.test/auth/magic#t'));
  });

  it('supplier: company name is required and sent; arrow keys move the selection', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('x'), { code: 'AUTH_EMAIL_DISPOSABLE' }));
    render(<RegisterPage />);

    const first = screen.getByRole('radio', { name: /accountKind\.independent/ });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('radio', { name: /accountKind\.marketplace/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /accountKind\.supplier/ })).toHaveAttribute('aria-checked', 'true');
    continueToDetails();
    fill('companyName', 'Acme AB');

    fill('firstName', 'A');
    fill('lastName', 'B');
    fill('email', 'a@mailinator.com');
    fill('password', 'secret123');
    fill('confirmPassword', 'secret123');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((apiMock.mock.calls[0] as [string, { body: string }])[1].body);
    expect(body.account_kind).toBe('supplier');
    expect(body.company_name).toBe('Acme AB');
    expect(body).not.toHaveProperty('role');
    expect(await screen.findByRole('alert')).toHaveTextContent('emailDisposable');
  });

  it('refuses to submit without a kind or without the terms; Back keeps the values', async () => {
    render(<RegisterPage />);
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('accountKindRequired');

    fireEvent.click(screen.getByRole('radio', { name: /accountKind\.independent/ }));
    continueToDetails();
    fill('firstName', 'A');
    fill('lastName', 'B');
    fill('email', 'a@b.se');
    fill('password', 'secret123');
    fill('confirmPassword', 'secret123');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('termsRequired');
    expect(apiMock).not.toHaveBeenCalled();

    // Back to step 1 and forward again: the chosen path and the fields survive.
    fireEvent.click(screen.getByRole('button', { name: /wizard\.back/ }));
    expect(screen.getByRole('radio', { name: /accountKind\.independent/ })).toHaveAttribute('aria-checked', 'true');
    continueToDetails();
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('a@b.se');
  });
});
