import type { Appearance, CssFontSource, StripeElementLocale } from '@stripe/stripe-js';
import { currencyMinorDigits } from '@/lib/format';

// Helpers for the Stripe Payment Element on the storefront checkout: the
// display amount (deferred-intent Elements), the store-themed appearance and
// the return-URL query the confirmation page reads after a redirect method.

/**
 * Amount in the currency's smallest unit, mirroring the API's toStripeAmount
 * so the amount Elements shows matches the PaymentIntent the API creates.
 * Elements in `payment` mode needs a positive amount, so it never returns 0.
 */
export function toStripeMinorAmount(amount: number, currency: string): number {
  const value = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const digits = currencyMinorDigits(currency);
  let minor: number;
  if (digits === 0) {
    minor = Math.round(value);
  } else {
    const cents = Math.round(value * 100);
    minor = digits === 3 ? Math.round(cents / 100) * 100 : cents;
  }
  return Math.max(1, minor);
}

const STRIPE_LOCALES: ReadonlySet<string> = new Set(['ar', 'de', 'en', 'fr', 'sv', 'tr']);

/** Store/visitor locale for Elements; anything unsupported lets Stripe pick. */
export function toStripeLocale(locale: string | null | undefined): StripeElementLocale {
  const base = (locale || '').toLowerCase().split(/[-_]/)[0] ?? '';
  return (STRIPE_LOCALES.has(base) ? base : 'auto') as StripeElementLocale;
}

/** Theme values read from the page, already resolved to plain CSS values. */
export interface StripeThemeInput {
  primary?: string | null;
  background?: string | null;
  text?: string | null;
  muted?: string | null;
  border?: string | null;
  danger?: string | null;
  radius?: string | null;
  fontFamily?: string | null;
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;
const RADIUS_RE = /^\d+(\.\d+)?(px|rem|em)?$/;

function color(value: string | null | undefined): string | undefined {
  const v = (value || '').trim();
  return COLOR_RE.test(v) ? v : undefined;
}

// Stripe inputs deform with a pill radius, so the theme radius is capped.
function radius(value: string | null | undefined): string | undefined {
  const v = (value || '').trim();
  if (!RADIUS_RE.test(v)) return undefined;
  const n = parseFloat(v);
  const px = v.endsWith('rem') || v.endsWith('em') ? n * 16 : n;
  return `${Math.min(Math.max(px, 0), 16)}px`;
}

const GENERIC_FONTS = new Set([
  'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'ui-sans-serif', 'ui-serif',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica', 'helvetica neue',
  'georgia', 'times new roman', 'times', 'verdana', 'tahoma', 'courier new', 'inherit',
]);

/** First family of a CSS font-family list, unquoted. */
export function primaryFontFamily(fontFamily: string | null | undefined): string | null {
  const first = (fontFamily || '').split(',')[0]?.trim().replace(/^["']|["']$/g, '').trim();
  return first ? first : null;
}

function isWebFont(family: string | null): family is string {
  return !!family && !GENERIC_FONTS.has(family.toLowerCase()) && /^[A-Za-z0-9 ]{2,60}$/.test(family);
}

/**
 * Google Fonts stylesheet for the store's body font, so the Payment Element
 * iframe (which cannot see the page's fonts) renders in the same typeface.
 * System and generic families need no stylesheet.
 */
export function stripeFontSources(fontFamily: string | null | undefined): CssFontSource[] {
  const family = primaryFontFamily(fontFamily);
  if (!isWebFont(family)) return [];
  const query = encodeURIComponent(family).replace(/%20/g, '+');
  return [{ cssSrc: `https://fonts.googleapis.com/css2?family=${query}:wght@400;500;600&display=swap` }];
}

/** Payment Element appearance that follows the store theme tokens. */
export function buildStripeAppearance(input: StripeThemeInput): Appearance {
  const variables: NonNullable<Appearance['variables']> = {};
  const primary = color(input.primary);
  const background = color(input.background);
  const text = color(input.text);
  const muted = color(input.muted);
  const danger = color(input.danger);
  const r = radius(input.radius);
  const family = primaryFontFamily(input.fontFamily);
  if (primary) variables.colorPrimary = primary;
  if (background) variables.colorBackground = background;
  if (text) variables.colorText = text;
  if (muted) variables.colorTextSecondary = muted;
  if (danger) variables.colorDanger = danger;
  if (r) variables.borderRadius = r;
  if (family && (GENERIC_FONTS.has(family.toLowerCase()) || isWebFont(family))) {
    variables.fontFamily = `"${family}", system-ui, sans-serif`;
  }
  const border = color(input.border);
  return {
    theme: 'stripe',
    variables,
    ...(border
      ? { rules: { '.Input': { borderColor: border }, '.Tab': { borderColor: border }, '.AccordionItem': { borderColor: border } } }
      : {}),
  };
}

/** Outcome of a Stripe payment, as read from the confirmation URL. */
export type StripeReturnState = 'succeeded' | 'processing' | 'failed' | null;

/**
 * Stripe appends `payment_intent`, `payment_intent_client_secret` and
 * `redirect_status` to the return URL; the checkout adds `stripe_return=1`
 * (also used for an inline payment that ended in `processing`).
 */
export function readStripeReturn(params: { get(name: string): string | null }): StripeReturnState {
  if (params.get('stripe_return') !== '1') return null;
  const status = params.get('redirect_status');
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed' || status === 'canceled' || status === 'requires_payment_method') return 'failed';
  // `processing`, `pending` (bank debits, Klarna review) or an unknown value.
  return 'processing';
}

// Any CSS colour (oklch, color-mix, named...) to an rgb() string Stripe can
// parse, by painting one canvas pixel. Null when the value is not a colour.
function resolveCssColor(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (COLOR_RE.test(v)) return v;
  try {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const sentinel = '#010203';
    ctx.fillStyle = sentinel;
    ctx.fillStyle = v;
    if (String(ctx.fillStyle).toLowerCase() === sentinel) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a ? `rgb(${r}, ${g}, ${b})` : null;
  } catch {
    return null;
  }
}

/**
 * Appearance + fonts for the checkout's Payment Element, from the store theme
 * variables on the page (brand colour, radius, body font). The element sits on
 * the checkout's white panel, so background and text stay neutral and
 * readable whatever the storefront palette is.
 */
export function readStripeThemeFromDom(): { appearance: Appearance; fonts: CssFontSource[] } {
  if (typeof document === 'undefined') {
    return { appearance: buildStripeAppearance({}), fonts: [] };
  }
  const el = document.querySelector('.store-page') ?? document.documentElement;
  const cs = getComputedStyle(el);
  const prop = (name: string) => cs.getPropertyValue(name).trim();
  const fontFamily = cs.fontFamily || prop('--theme-font-body');
  const input: StripeThemeInput = {
    primary: resolveCssColor(prop('--store-primary') || prop('--theme-colors-primary')),
    background: '#ffffff',
    text: '#1a1a1a',
    muted: '#6b7280',
    danger: '#dc2626',
    radius: prop('--theme-radius-md') || null,
    fontFamily,
  };
  return { appearance: buildStripeAppearance(input), fonts: stripeFontSources(fontFamily) };
}

// ── Payment flow decisions (pure, unit-tested) ────────────────────────────────

/** Which Stripe account charges an order (mirrors the API's payment route). */
export type PaymentRoute = 'OWN_KEY' | 'CONNECT_DIRECT' | 'PLATFORM';

/** POST /payments/create-intent: an intent to confirm, or an order that needs none. */
export interface CreateIntentResponse {
  clientSecret?: string;
  paymentIntentId?: string;
  /** Set instead of an intent when the order is already paid / processing. */
  status?: string;
  route?: string | null;
}

export type CreateIntentOutcome =
  | { kind: 'confirm'; clientSecret: string }
  | { kind: 'paid' }
  | { kind: 'processing' }
  | { kind: 'route_changed' }
  | { kind: 'invalid' };

/** True when both routes are known and differ (the page's Stripe.js no longer matches). */
export function routeChanged(
  serverRoute: string | null | undefined,
  pageRoute: string | null | undefined,
): boolean {
  return !!serverRoute && !!pageRoute && serverRoute !== pageRoute;
}

/**
 * What the checkout does with a create-intent answer. An already paid or
 * processing order goes to the confirmation page; an intent created on
 * another Stripe account than the one the page loaded Stripe.js for cannot
 * be confirmed here, so the page reloads its payment config first.
 */
export function readCreateIntent(
  res: CreateIntentResponse | null | undefined,
  pageRoute: string | null | undefined,
): CreateIntentOutcome {
  if (res?.status === 'paid') return { kind: 'paid' };
  if (res?.status === 'processing') return { kind: 'processing' };
  if (routeChanged(res?.route, pageRoute)) return { kind: 'route_changed' };
  if (typeof res?.clientSecret === 'string' && res.clientSecret) {
    return { kind: 'confirm', clientSecret: res.clientSecret };
  }
  return { kind: 'invalid' };
}

/**
 * `paid` / `processing`: the order is placed. `failed`: the attempt is over
 * (a retry needs a new order). `open`: the intent can still be paid, so a
 * retry reuses the same order and intent.
 */
export type IntentOutcome = 'paid' | 'processing' | 'failed' | 'open';

export function intentStatusOutcome(status: string | null | undefined): IntentOutcome {
  if (status === 'succeeded' || status === 'requires_capture') return 'paid';
  if (status === 'processing') return 'processing';
  if (status === 'canceled' || status === 'requires_payment_method') return 'failed';
  return 'open';
}

/** The parts of a PaymentIntent the decisions below read. */
export interface IntentLike {
  status?: string | null;
  last_payment_error?: unknown;
}

/**
 * Outcome of an intent read after an uncertain attempt. A fresh, never
 * confirmed intent is also `requires_payment_method`, so that status only
 * counts as failed when the intent records a failed attempt.
 */
export function readIntentOutcome(intent: IntentLike | null | undefined): IntentOutcome {
  const status = intent?.status;
  if (status === 'requires_payment_method') return intent?.last_payment_error ? 'failed' : 'open';
  return intentStatusOutcome(status);
}

/** The parts of a Stripe.js error the decision needs. */
export interface ConfirmErrorLike {
  type?: string;
  code?: string;
  payment_intent?: IntentLike | null;
}

/**
 * How a confirmPayment error is handled:
 * - `invalid_details`: nothing was attempted; fix the details, same order.
 * - `declined`: the card / method was refused; the order is dropped.
 * - `paid` / `processing`: the intent had already gone through.
 * - `uncertain`: network / Stripe / unknown error. The charge may or may
 *   not have happened, so the intent is checked before any retry and the
 *   order is kept.
 */
export type ConfirmErrorOutcome = 'invalid_details' | 'declined' | 'paid' | 'processing' | 'uncertain';

export function confirmErrorOutcome(err: ConfirmErrorLike): ConfirmErrorOutcome {
  if (err.type === 'validation_error') return 'invalid_details';
  if (err.type === 'card_error') return 'declined';
  if (err.code === 'payment_intent_unexpected_state') {
    const outcome = readIntentOutcome(err.payment_intent);
    if (outcome === 'paid' || outcome === 'processing') return outcome;
    if (outcome === 'failed') return 'declined';
  }
  return 'uncertain';
}

/** POST /payments/confirm (server reconcile) answer. */
export interface ReconcileResponse {
  payment_status?: string;
  intent_status?: string;
}

/**
 * Settles an uncertain confirm from what could be checked: the intent read
 * through Stripe.js (null when that failed too), else the server reconcile
 * (null when unreachable or not asked). Anything not definitive stays `open`.
 */
export function settleUncertainPayment(
  intent: IntentLike | null | undefined,
  reconcile: ReconcileResponse | null | undefined,
): IntentOutcome {
  if (intent) return readIntentOutcome(intent);
  const ps = reconcile?.payment_status;
  if (ps === 'paid') return 'paid';
  if (ps === 'failed') return 'failed';
  const is = reconcile?.intent_status;
  if (is === 'succeeded' || is === 'requires_capture') return 'paid';
  if (is === 'processing') return 'processing';
  return 'open';
}

/** The parts of the checkout's pending Stripe order the route-change guard reads. */
export interface RouteChangePending {
  clientSecret: string | null;
  /** Consecutive route changes seen for this order (absent = 0). */
  routeChanges?: number;
}

/**
 * Pending order to keep after a route change (`PAYMENT_ROUTE_CHANGED_RETRY`
 * or an intent on another route than the page's). The first change keeps the
 * same order and drops its intent so the retry re-requests one on the new
 * route. A second consecutive change for the same order drops the order, so
 * the next submit creates a fresh one instead of looping on it.
 */
export function pendingAfterRouteChange<T extends RouteChangePending>(pending: T | null | undefined): T | null {
  if (!pending) return null;
  if ((pending.routeChanges ?? 0) >= 1) return null;
  return { ...pending, clientSecret: null, routeChanges: 1 };
}
