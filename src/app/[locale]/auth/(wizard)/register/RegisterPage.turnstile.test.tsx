import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './page';

// Turnstile on the sign-up (onboarding wave 3), with the widget module
// mocked: the site key is "set", the widget is a button that hands over a
// token. Without a token the submit stops locally; with one the token
// travels as `turnstile_token`; the two API codes map to friendly messages
// and reset the widget (single-use tokens).

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
vi.mock('@/lib/animations', () => ({
  gsap: { fromTo: vi.fn() },
  useGSAP: () => undefined,
  DUR: { fast: 0 },
  EASE: { out: 'none' },
  prefersReducedMotion: () => true,
}));
vi.mock('./Turnstile', () => ({
  TURNSTILE_SITE_KEY: 'site-key',
  TurnstileWidget: ({
    onToken,
    resetSignal,
    label,
    language,
  }: {
    onToken: (t: string | null) => void;
    resetSignal?: number;
    label: string;
    language: string;
  }) => (
    <button type="button" data-reset={resetSignal} data-lang={language} onClick={() => onToken('tok-1')}>
      {label}
    </button>
  ),
}));

afterEach(() => {
  apiMock.mockReset();
});

function fill(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
}

function toDetails() {
  fireEvent.click(screen.getByRole('radio', { name: /accountKind\.independent/ }));
  fireEvent.click(screen.getByRole('button', { name: /wizard\.continue/ }));
  fill('firstName', 'Anna');
  fill('lastName', 'Svensson');
  fill('email', 'anna@example.com');
  fill('password', 'secret123');
  fill('confirmPassword', 'secret123');
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('RegisterPage with Turnstile', () => {
  it('renders the widget with the page locale and refuses to submit without a token', () => {
    render(<RegisterPage />);
    toDetails();
    const widget = screen.getByRole('button', { name: 'captchaLabel' });
    expect(widget).toHaveAttribute('data-lang', 'sv');
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('captchaRequired');
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('sends turnstile_token once the widget handed over a token', async () => {
    apiMock.mockResolvedValue({ dashboard_login_url: 'https://dash.test/auth/magic#t' });
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    render(<RegisterPage />);
    toDetails();
    fireEvent.click(screen.getByRole('button', { name: 'captchaLabel' }));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    const [, init] = apiMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({ account_kind: 'independent', turnstile_token: 'tok-1' });
  });

  it('maps AUTH_CAPTCHA_FAILED / AUTH_CAPTCHA_UNAVAILABLE and resets the widget', async () => {
    apiMock.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'AUTH_CAPTCHA_FAILED' }));
    render(<RegisterPage />);
    toDetails();
    const widget = () => screen.getByRole('button', { name: 'captchaLabel' });
    expect(widget()).toHaveAttribute('data-reset', '0');
    fireEvent.click(widget());
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('captchaFailed'));
    expect(widget()).toHaveAttribute('data-reset', '1');

    // The token was cleared: submitting again stops locally.
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('captchaRequired');
    expect(apiMock).toHaveBeenCalledTimes(1);

    apiMock.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'AUTH_CAPTCHA_UNAVAILABLE' }));
    fireEvent.click(widget());
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('captchaUnavailable'));
    expect(widget()).toHaveAttribute('data-reset', '2');
  });
});
