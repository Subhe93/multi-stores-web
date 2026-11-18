import { describe, expect, it, vi } from 'vitest';
import {
  buildGuestOrderBody,
  canReusePending,
  checkoutIdentity,
  guestAccountExistsKey,
  guestOrderTokenKey,
  orderReadPath,
  paymentPaths,
  readGuestAccountExists,
  readGuestOrderResponse,
  readGuestOrderToken,
  registerFailureOutcome,
  rememberGuestAccountExists,
  rememberGuestOrderToken,
} from './guestOrder';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const form = {
  email: ' Ada@Example.se ',
  first_name: 'Ada',
  last_name: 'Lind',
  phone: '',
  line1: 'Storgatan 1',
  line2: '',
  city: 'Malmö',
  state: '',
  postal_code: '211 34',
  country_code: 'SE',
};

describe('checkoutIdentity', () => {
  it('a signed-in shopper keeps the session flow', () => {
    expect(checkoutIdentity({ loggedIn: true, wantAccount: false, password: '' })).toBe('session');
    expect(checkoutIdentity({ loggedIn: true, wantAccount: true, password: 'long-enough' })).toBe('session');
  });

  it('box not ticked: a guest order, never an account', () => {
    expect(checkoutIdentity({ loggedIn: false, wantAccount: false, password: '' })).toBe('guest');
    // A password typed before the box was unticked does not count.
    expect(checkoutIdentity({ loggedIn: false, wantAccount: false, password: 'long-enough' })).toBe('guest');
  });

  it('box ticked with a usable password: register', () => {
    expect(checkoutIdentity({ loggedIn: false, wantAccount: true, password: 'long-enough' })).toBe('register');
    expect(checkoutIdentity({ loggedIn: false, wantAccount: true, password: 'short' })).toBe('guest');
  });
});

describe('registerFailureOutcome', () => {
  it('existing email: the order continues as a guest order', () => {
    expect(registerFailureOutcome('AUTH_EMAIL_EXISTS', false)).toBe('guest');
  });

  it('existing email with the captcha on: one more submit with a fresh token', () => {
    expect(registerFailureOutcome('AUTH_EMAIL_EXISTS', true)).toBe('guest_after_captcha');
  });

  it('any other failure is still an error', () => {
    expect(registerFailureOutcome('AUTH_CAPTCHA_FAILED', false)).toBe('error');
    expect(registerFailureOutcome(undefined, true)).toBe('error');
    expect(registerFailureOutcome(null, false)).toBe('error');
  });
});

describe('guest token storage', () => {
  it('is kept per order under its own key, never under the session key', () => {
    const store = memoryStore();
    rememberGuestOrderToken('o1', 'tok-1', store);
    expect(guestOrderTokenKey('o1')).toBe('checkout_guest_token:o1');
    expect([...store.data.keys()]).toEqual(['checkout_guest_token:o1']);
    expect(readGuestOrderToken('o1', store)).toBe('tok-1');
    expect(readGuestOrderToken('o2', store)).toBeNull();
    expect(readGuestOrderToken(null, store)).toBeNull();
  });

  it('a store that lists its keys keeps only the token of the latest order', () => {
    const data = new Map<string, string>([['auth_access_token', 'session'], ['checkout_guest_token:old', 'tok-old']]);
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() { return data.size; },
    };
    rememberGuestOrderToken('new', 'tok-new', store);
    expect([...data.keys()].sort()).toEqual(['auth_access_token', 'checkout_guest_token:new']);
    expect(readGuestOrderToken('new', store)).toBe('tok-new');
    expect(readGuestOrderToken('old', store)).toBeNull();
    // An unchanged retry of the same order keeps its token.
    rememberGuestOrderToken('new', 'tok-new', store);
    expect(readGuestOrderToken('new', store)).toBe('tok-new');
  });

  it('by default the token is shared across tabs (localStorage), not tab-bound', () => {
    const local = memoryStore();
    const session = memoryStore();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    try {
      rememberGuestOrderToken('o9', 'tok-9');
      expect(local.data.get('checkout_guest_token:o9')).toBe('tok-9');
      expect(session.data.size).toBe(0);
      expect(readGuestOrderToken('o9')).toBe('tok-9');
      // A token only this tab holds (localStorage refused the write) is still read.
      session.data.set('checkout_guest_token:o8', 'tok-8');
      expect(readGuestOrderToken('o8')).toBe('tok-8');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the "account exists" note is kept per order', () => {
    const store = memoryStore();
    rememberGuestAccountExists('o1', 'ada@example.se', store);
    expect(guestAccountExistsKey('o1')).toBe('checkout_guest_account_exists:o1');
    expect(readGuestAccountExists('o1', store)).toBe('ada@example.se');
    expect(readGuestAccountExists('o2', store)).toBeNull();
  });

  it('survives a missing or throwing storage', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => undefined,
    };
    expect(() => rememberGuestOrderToken('o1', 't', broken)).not.toThrow();
    expect(readGuestOrderToken('o1', broken)).toBeNull();
    expect(() => rememberGuestOrderToken('o1', 't', null)).not.toThrow();
    expect(readGuestOrderToken('o1', null)).toBeNull();
    expect(readGuestAccountExists('o1', broken)).toBeNull();
  });
});

describe('payment and order paths', () => {
  it('guest orders use the guest routes', () => {
    expect(paymentPaths(true)).toEqual({
      createIntent: '/payments/guest/create-intent',
      confirm: '/payments/guest/confirm',
    });
    expect(orderReadPath('o 1', true)).toBe('/orders/guest/o%201');
  });

  it('session orders keep the existing routes', () => {
    expect(paymentPaths(false)).toEqual({ createIntent: '/payments/create-intent', confirm: '/payments/confirm' });
    expect(orderReadPath('o1', false)).toBe('/orders/o1');
  });
});

describe('buildGuestOrderBody', () => {
  const base = {
    form,
    storeId: 'store-1',
    storeSlug: 'newroj',
    hostname: 'newroj.shopsdoor.com',
    locale: 'sv',
    paymentMethod: 'STRIPE' as const,
    lines: [{ product_id: 'p1', variant_id: 'v1', quantity: 2 }],
  };

  it('carries the buyer, the typed address, the local lines and the order fields', () => {
    const body = buildGuestOrderBody({
      ...base,
      orderFields: { shipping_method_id: 'm1', coupon_code: 'HELLO', notes: 'ring', market_key: 'se' },
    });
    expect(body).toEqual({
      email: 'Ada@Example.se',
      first_name: 'Ada',
      last_name: 'Lind',
      phone: undefined,
      store_slug: 'newroj',
      hostname: 'newroj.shopsdoor.com',
      locale: 'sv',
      address: {
        full_name: 'Ada Lind',
        line1: 'Storgatan 1',
        line2: undefined,
        city: 'Malmö',
        state: undefined,
        postal_code: '211 34',
        country_code: 'SE',
        phone: undefined,
      },
      lines: [{ product_id: 'p1', variant_id: 'v1', quantity: 2 }],
      shipping_method_id: 'm1',
      coupon_code: 'HELLO',
      notes: 'ring',
      market_key: 'se',
      store_id: 'store-1',
      payment_method: 'STRIPE',
    });
    // Optional blanks disappear from the JSON that is sent.
    const sent = JSON.parse(JSON.stringify(body)) as { address: Record<string, unknown> };
    expect('phone' in sent).toBe(false);
    expect('line2' in sent.address).toBe(false);
  });

  it('never sends an address id, a password or a session', () => {
    const body = buildGuestOrderBody({
      ...base,
      orderFields: { address_id: 'a1', store_id: 'other', payment_method: 'COD' },
    });
    expect('address_id' in body).toBe(false);
    expect('password' in body).toBe(false);
    // The checkout's own store and method win over anything in the fields.
    expect(body.store_id).toBe('store-1');
    expect(body.payment_method).toBe('STRIPE');
  });

  it('sends the captcha token only when there is one', () => {
    expect('turnstile_token' in buildGuestOrderBody(base)).toBe(false);
    expect(buildGuestOrderBody({ ...base, turnstileToken: 'cf-tok' }).turnstile_token).toBe('cf-tok');
  });

  it('b2b: company fields go on the address, the company block with the order fields', () => {
    const body = buildGuestOrderBody({
      ...base,
      paymentMethod: 'COD',
      addressCompany: { company_name: 'Acme AB', org_number: '5566778899', buyer_reference: 'PO-7' },
      orderFields: { buyer_type: 'COMPANY', company: { company_name: 'Acme AB', org_number: '5566778899' } },
    }) as { address: Record<string, unknown>; buyer_type?: string; payment_method?: string };
    expect(body.address).toMatchObject({ company_name: 'Acme AB', org_number: '5566778899', buyer_reference: 'PO-7' });
    expect(body.buyer_type).toBe('COMPANY');
    expect(body.payment_method).toBe('COD');
  });
});

describe('readGuestOrderResponse', () => {
  it('reads the order id and the guest token', () => {
    expect(readGuestOrderResponse({ order: { id: 'o1', order_number: 'N-1' }, guest_token: 'tok', guest_token_expires_at: 'x' }))
      .toEqual({ orderId: 'o1', orderNumber: 'N-1', guestToken: 'tok' });
    expect(readGuestOrderResponse({ order: { id: 'o1' }, guest_token: 'tok' })).toEqual({ orderId: 'o1', guestToken: 'tok' });
  });

  it('is null for a malformed answer', () => {
    expect(readGuestOrderResponse(null)).toBeNull();
    expect(readGuestOrderResponse({ order: { id: 'o1' } })).toBeNull();
    expect(readGuestOrderResponse({ guest_token: 'tok' })).toBeNull();
    expect(readGuestOrderResponse({ order: { id: '' }, guest_token: 'tok' })).toBeNull();
  });
});

describe('canReusePending', () => {
  it('a session order is reused by the same session only', () => {
    const pending = { signature: 's', token: 'jwt-1' };
    expect(canReusePending(pending, 's', 'jwt-1')).toBe(true);
    expect(canReusePending(pending, 's', 'jwt-2')).toBe(false);
    expect(canReusePending(pending, 's', null)).toBe(false);
    expect(canReusePending(pending, 'changed', 'jwt-1')).toBe(false);
  });

  it('a guest order is reused while nobody is signed in', () => {
    const pending = { signature: 's', token: 'guest-tok', guest: true };
    expect(canReusePending(pending, 's', null)).toBe(true);
    expect(canReusePending(pending, 'changed', null)).toBe(false);
    // Signed in meanwhile: the session flow creates its own order.
    expect(canReusePending(pending, 's', 'jwt-1')).toBe(false);
    // A guest token is never mistaken for the session, even when equal.
    expect(canReusePending(pending, 's', 'guest-tok')).toBe(false);
  });

  it('nothing pending: nothing to reuse', () => {
    expect(canReusePending(null, 's', 'jwt-1')).toBe(false);
    expect(canReusePending(undefined, 's', null)).toBe(false);
  });
});
