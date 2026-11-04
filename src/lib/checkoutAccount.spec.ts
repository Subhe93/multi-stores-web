import { describe, expect, it, vi } from 'vitest';
import type { GuestRegisterData, RegisterData } from '@/hooks/useAuth';
import { createCheckoutAccount, guestAccountNoteKey } from './checkoutAccount';

const base = {
  email: 'guest@example.se',
  first_name: 'Ada',
  last_name: 'Lind',
  phone: '+46701234567',
  storeSlug: 'namez',
  hostname: 'namez.se',
  locale: 'sv',
};

function deps() {
  return {
    register: vi.fn<(data: RegisterData) => Promise<string>>(async () => 'token-register'),
    registerGuest: vi.fn<(data: GuestRegisterData) => Promise<string>>(async () => 'token-guest'),
  };
}

describe('createCheckoutAccount', () => {
  it('passes the Turnstile token to either call when present', async () => {
    const guest = deps();
    await createCheckoutAccount({ ...base, wantAccount: false, password: '', turnstileToken: 'cf-tok' }, guest);
    expect(guest.registerGuest.mock.calls[0]![0]).toMatchObject({ turnstile_token: 'cf-tok' });

    const account = deps();
    await createCheckoutAccount({ ...base, wantAccount: true, password: 'long-enough', turnstileToken: 'cf-tok' }, account);
    expect(account.register.mock.calls[0]![0]).toMatchObject({ turnstile_token: 'cf-tok' });

    const none = deps();
    await createCheckoutAccount({ ...base, wantAccount: false, password: '', turnstileToken: null }, none);
    expect(none.registerGuest.mock.calls[0]![0]).not.toHaveProperty('turnstile_token');
  });

  it('uses guest-register with the store context and no client password', async () => {
    const d = deps();
    const res = await createCheckoutAccount({ ...base, wantAccount: false, password: '' }, d);

    expect(res).toEqual({ token: 'token-guest', guest: true });
    expect(d.register).not.toHaveBeenCalled();
    expect(d.registerGuest).toHaveBeenCalledTimes(1);
    const body = d.registerGuest.mock.calls[0]![0];
    expect(body).toEqual({
      email: 'guest@example.se',
      first_name: 'Ada',
      last_name: 'Lind',
      phone: '+46701234567',
      store_slug: 'namez',
      hostname: 'namez.se',
      locale: 'sv',
    });
    expect(body).not.toHaveProperty('password');
  });

  it('ignores a too-short typed password and lets the server generate one', async () => {
    const d = deps();
    await createCheckoutAccount({ ...base, wantAccount: true, password: 'short' }, d);
    expect(d.register).not.toHaveBeenCalled();
    expect(d.registerGuest).toHaveBeenCalledTimes(1);
  });

  it('registers with the chosen password and the store context', async () => {
    const d = deps();
    const res = await createCheckoutAccount({ ...base, wantAccount: true, password: 'my-own-pass' }, d);

    expect(res).toEqual({ token: 'token-register', guest: false });
    expect(d.registerGuest).not.toHaveBeenCalled();
    expect(d.register).toHaveBeenCalledWith({
      email: 'guest@example.se',
      first_name: 'Ada',
      last_name: 'Lind',
      phone: '+46701234567',
      password: 'my-own-pass',
      role: 'CUSTOMER',
      store_slug: 'namez',
      hostname: 'namez.se',
      locale: 'sv',
    });
  });

  it('propagates the existing-email error unchanged', async () => {
    const d = deps();
    const err = Object.assign(new Error('Email already registered'), { code: 'EMAIL_EXISTS' });
    d.registerGuest.mockRejectedValueOnce(err);
    await expect(createCheckoutAccount({ ...base, wantAccount: false, password: '' }, d)).rejects.toBe(err);
  });

  it('keys the confirmation note by order', () => {
    expect(guestAccountNoteKey('o1')).toBe('checkout_guest_account:o1');
  });
});
