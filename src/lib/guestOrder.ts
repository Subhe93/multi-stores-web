// Guest checkout (fix batch items 2 and 8): an order placed without an
// account session.
//
// A shopper who is not signed in and did not tick "create an account" (or
// whose email already has an account they could not sign in to) places the
// order through `POST /orders/guest`. The API finds or creates the customer
// record itself, never signs anyone in and never mails credentials. It
// answers with an order-bound guest token, good only for that order's
// payment (`/payments/guest/*`) and confirmation (`GET /orders/guest/:id`).
//
// The guest token is NOT a session: it is never written to the auth storage
// and never passed to `login`. It lives in `localStorage` under a key that
// names its order, so the confirmation page can read the order back, also
// when a redirect payment (Swish, a bank app) returns in another tab. Only
// the latest guest order's token is kept; it expires after 24 h on the API.
//
// Pure helpers only; the checkout page does the calls.

/** How the checkout of this submit identifies the buyer. */
export type CheckoutIdentity = 'session' | 'register' | 'guest';

/**
 * - `session`: already signed in, the order is created from the server cart.
 * - `register`: "create an account" ticked with a usable password.
 * - `guest`: everything else, the order goes through `POST /orders/guest`.
 */
export function checkoutIdentity(input: {
  loggedIn: boolean;
  wantAccount: boolean;
  password: string;
}): CheckoutIdentity {
  if (input.loggedIn) return 'session';
  return input.wantAccount && input.password.length >= 8 ? 'register' : 'guest';
}

/** API code of a register call whose email already has an account. */
export const AUTH_EMAIL_EXISTS = 'AUTH_EMAIL_EXISTS';

/**
 * What to do after "create an account" failed to register AND the typed
 * password did not sign in:
 * - `guest`: the email already has an account, so the order continues as a
 *   guest order (never blocked);
 * - `guest_after_captcha`: same, but the captcha token was spent by the
 *   register call, so the shopper must solve it again and submit once more;
 * - `error`: any other failure is shown as before.
 */
export function registerFailureOutcome(
  code: string | null | undefined,
  captchaOn: boolean,
): 'guest' | 'guest_after_captcha' | 'error' {
  if (code !== AUTH_EMAIL_EXISTS) return 'error';
  return captchaOn ? 'guest_after_captcha' : 'guest';
}

// ── Storage keys ──────────────────────────────────────────────────────────────

/** Prefix of every guest token key. */
const GUEST_TOKEN_KEY_PREFIX = 'checkout_guest_token:';

/** Storage key of an order's guest token. */
export function guestOrderTokenKey(orderId: string): string {
  return `${GUEST_TOKEN_KEY_PREFIX}${orderId}`;
}

/** Session key flagging "an account already exists for this email" (value: the email). */
export function guestAccountExistsKey(orderId: string): string {
  return `checkout_guest_account_exists:${orderId}`;
}

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): SessionStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // storage blocked (private mode)
  }
}

/** A store that can also list its keys (a real `Storage`), for pruning. */
type TokenStore = SessionStore & Partial<Pick<Storage, 'key' | 'length'>>;

/** Shared across the tabs of the browser, unlike `sessionStorage`. */
function localStore(): TokenStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode)
  }
}

/** Where guest tokens are looked up: across tabs first, then this tab. */
function tokenStores(): TokenStore[] {
  return [localStore(), sessionStore()].filter((s): s is TokenStore => s !== null);
}

/** Drops the guest tokens of other orders (only the latest order's token is kept). */
function pruneOtherGuestTokens(store: TokenStore, keepKey: string): void {
  if (typeof store.key !== 'function' || typeof store.length !== 'number') return;
  const stale: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const k = store.key(i);
    if (k && k.startsWith(GUEST_TOKEN_KEY_PREFIX) && k !== keepKey) stale.push(k);
  }
  for (const k of stale) store.removeItem(k);
}

/**
 * Best-effort: without storage the order is still placed, only the receipt is
 * missing. Written to the first store that takes it (`localStorage`, else
 * `sessionStorage`), or to the given store.
 */
export function rememberGuestOrderToken(orderId: string, token: string, store?: TokenStore | null): void {
  const key = guestOrderTokenKey(orderId);
  const stores = store === undefined ? tokenStores() : store ? [store] : [];
  for (const s of stores) {
    try {
      s.setItem(key, token);
      try { pruneOtherGuestTokens(s, key); } catch { /* optional */ }
      return;
    } catch { /* try the next store */ }
  }
}

export function readGuestOrderToken(orderId: string | null | undefined, store?: TokenStore | null): string | null {
  if (!orderId) return null;
  const key = guestOrderTokenKey(orderId);
  const stores = store === undefined ? tokenStores() : store ? [store] : [];
  for (const s of stores) {
    try {
      const value = s.getItem(key);
      if (value) return value;
    } catch { /* try the next store */ }
  }
  return null;
}

export function rememberGuestAccountExists(orderId: string, email: string, store: SessionStore | null = sessionStore()): void {
  try {
    store?.setItem(guestAccountExistsKey(orderId), email);
  } catch { /* the note is optional */ }
}

export function readGuestAccountExists(orderId: string | null | undefined, store: SessionStore | null = sessionStore()): string | null {
  if (!orderId) return null;
  try {
    return store?.getItem(guestAccountExistsKey(orderId)) || null;
  } catch {
    return null;
  }
}

// ── Payment routes ────────────────────────────────────────────────────────────

/** Payment endpoints of an order: the guest pair takes the guest token. */
export function paymentPaths(guest: boolean): { createIntent: string; confirm: string } {
  return guest
    ? { createIntent: '/payments/guest/create-intent', confirm: '/payments/guest/confirm' }
    : { createIntent: '/payments/create-intent', confirm: '/payments/confirm' };
}

/** Order read of the confirmation page. */
export function orderReadPath(orderId: string, guest: boolean): string {
  const id = encodeURIComponent(orderId);
  return guest ? `/orders/guest/${id}` : `/orders/${id}`;
}

// ── Request / response ────────────────────────────────────────────────────────

export interface GuestOrderForm {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
}

export interface GuestOrderCompany {
  company_name: string;
  org_number: string;
  buyer_reference?: string;
}

export interface GuestOrderInput {
  form: GuestOrderForm;
  storeId: string;
  storeSlug: string;
  hostname: string;
  locale: string;
  paymentMethod: 'STRIPE' | 'COD';
  /** The local guest lines, in the shape `POST /orders/quote` takes. */
  lines: readonly unknown[];
  turnstileToken?: string | null;
  /** b2b app: company fields saved on the (billing) address; null for a person. */
  addressCompany?: GuestOrderCompany | null;
  /**
   * Order fields shared with `POST /orders`, already shaped by the checkout:
   * `market_key`, `buyer_type` / `company` / `expect_reverse_charge`,
   * `shipping_method_id`, `coupon_code`, `notes`, `tracking`.
   */
  orderFields?: Record<string, unknown>;
}

const opt = (value: string | undefined | null): string | undefined => {
  const v = (value ?? '').trim();
  return v ? v : undefined;
};

/**
 * Body of `POST /orders/guest`. Never carries `address_id` (the address is
 * typed) nor anything of an account: no password, no session.
 */
export function buildGuestOrderBody(input: GuestOrderInput): Record<string, unknown> {
  const { form } = input;
  const fullName = `${form.first_name} ${form.last_name}`.trim();
  const company = input.addressCompany ?? null;
  // `address_id` belongs to the session flow only.
  const orderFields: Record<string, unknown> = { ...(input.orderFields ?? {}) };
  delete orderFields.address_id;
  return {
    email: form.email.trim(),
    first_name: opt(form.first_name),
    last_name: opt(form.last_name),
    phone: opt(form.phone),
    store_slug: opt(input.storeSlug),
    hostname: opt(input.hostname),
    locale: opt(input.locale),
    ...(input.turnstileToken ? { turnstile_token: input.turnstileToken } : {}),
    address: {
      full_name: fullName,
      line1: form.line1,
      line2: opt(form.line2),
      city: form.city,
      state: opt(form.state),
      postal_code: form.postal_code,
      country_code: form.country_code,
      phone: opt(form.phone),
      ...(company
        ? {
            company_name: company.company_name,
            org_number: company.org_number,
            ...(company.buyer_reference ? { buyer_reference: company.buyer_reference } : {}),
          }
        : {}),
    },
    lines: input.lines,
    ...orderFields,
    // After the spread: the checkout's own values always win.
    store_id: input.storeId,
    payment_method: input.paymentMethod,
  };
}

export interface GuestOrderResult {
  orderId: string;
  orderNumber?: string;
  guestToken: string;
}

/** `{ order, guest_token }` of `POST /orders/guest`, or null when malformed. */
export function readGuestOrderResponse(raw: unknown): GuestOrderResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { order?: { id?: unknown; order_number?: unknown } | null; guest_token?: unknown };
  const id = r.order?.id;
  if (typeof id !== 'string' || !id) return null;
  if (typeof r.guest_token !== 'string' || !r.guest_token) return null;
  return {
    orderId: id,
    ...(typeof r.order?.order_number === 'string' ? { orderNumber: r.order.order_number } : {}),
    guestToken: r.guest_token,
  };
}

// ── Reuse of the unpaid order ─────────────────────────────────────────────────

/** The fields of the pending Stripe order the reuse rule reads. */
export interface PendingOrderIdentity {
  signature: string;
  /** Session token of a signed-in order, or the guest token of a guest order. */
  token: string;
  /** The order was placed through `POST /orders/guest`. */
  guest?: boolean;
}

/**
 * An unchanged retry pays the same unpaid order instead of creating another
 * one. A session order is reused only by the same session; a guest order only
 * while nobody is signed in (its token is bound to that order alone).
 */
export function canReusePending(
  pending: PendingOrderIdentity | null | undefined,
  signature: string,
  sessionToken: string | null | undefined,
): boolean {
  if (!pending || pending.signature !== signature) return false;
  if (pending.guest) return !sessionToken && Boolean(pending.token);
  return Boolean(sessionToken) && pending.token === sessionToken;
}
