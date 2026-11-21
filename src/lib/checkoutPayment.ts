// Payment availability of the storefront checkout (pure, unit-tested).
//
// The checkout page combines two API reads, both scoped to the request
// market: the store payload flags (`card_payments_enabled`, `kustom_enabled`,
// `cod_enabled`) and `GET /payments/config`. Since M157 the API narrows both
// for a market that restricts its payment methods, so a method is offered
// only when every source says it is on (each term below is an AND).
import { storeOffersCod } from '@/lib/codPolicy';
import type { PaymentRoute } from '@/lib/stripeElements';

export interface PaymentConfig {
  stripeConfigured: boolean;
  publishableKey: string | null;
  stripeAccount: string | null;
  /** Kustom Checkout is offered (independent store with configured credentials). */
  kustomEnabled: boolean;
  /** Which Stripe account charges: the owner's own key, legacy Connect, or the platform. */
  route?: PaymentRoute;
  /** Owner preview with a Stripe test key: nothing real is charged. */
  test_mode?: boolean;
}

// Resolved once per visit (store flags + platform payment config) and shared
// by both checkout modes.
export interface PaymentAvailability {
  storeId?: string;
  cod: boolean;
  stripe: boolean;
  kustom: boolean;
  publishableKey: string | null;
  stripeAccount: string | null;
  /** Route the publishable key belongs to (absent on older APIs). */
  route?: PaymentRoute;
  testMode: boolean;
  /** Owner / admin preview of a store that is not LIVE yet (`preview` payload). */
  ownerPreview: boolean;
}

// Store-level flags of the availability (the payment config is reloadable).
export interface StorePaymentFlags {
  storeId?: string;
  cod: boolean;
  card: boolean;
  kustom: boolean;
  /** The full payload of a non-LIVE store was served to its owner / an admin. */
  ownerPreview: boolean;
}

/** The store payload fields the checkout reads. */
export interface StorePaymentPayload {
  id?: string;
  card_payments_enabled?: boolean;
  cod_enabled?: boolean;
  store_type?: string;
  kustom_enabled?: boolean;
  preview?: boolean;
}

/**
 * Flags used when the store read failed: card and Kustom stay possible and
 * the (market-narrowed) payment config decides, so a failed store read can
 * never re-enable a method the config excludes. COD needs the store read.
 */
export function defaultStorePaymentFlags(): StorePaymentFlags {
  return { storeId: undefined, cod: false, card: true, kustom: true, ownerPreview: false };
}

/** Flags from the store payload (already narrowed to the request market by the API). */
export function storePaymentFlags(store: StorePaymentPayload): StorePaymentFlags {
  return {
    storeId: store.id,
    // `preview: true` = a non-LIVE store served to its owner / an admin.
    ownerPreview: store.preview === true,
    // The creator must have completed Stripe onboarding for this store to
    // accept card payments (and the market must allow card).
    card: store.card_payments_enabled !== false,
    // Cash on delivery is opt-in per store (off by default server-side):
    // strict check so COD stays hidden for stores that haven't enabled it.
    // Never offered by a MARKETPLACE store (platform rule).
    cod: storeOffersCod(store),
    kustom: store.kustom_enabled !== false,
  };
}

/** A classic-form method the API refused with MARKET_PAYMENT_METHOD_NOT_ALLOWED. */
export type RefusedClassicMethod = 'cod' | 'card';

/**
 * Store flags after the API refused the chosen method for the market (M157).
 * A fresh (market-narrowed) store read replaces the cached flags when it
 * succeeded; either way the refused method stays off for the rest of the
 * visit, because the API has just said no and a cached store payload could
 * still offer it. COD is known only from the store payload, so without this
 * the refused COD option would stay on screen.
 */
export function storeFlagsAfterRefusal(
  prev: StorePaymentFlags,
  fresh: StorePaymentFlags | null,
  refused: RefusedClassicMethod,
): StorePaymentFlags {
  return { ...(fresh ?? prev), [refused]: false };
}

export function buildAvailability(flags: StorePaymentFlags, config: PaymentConfig | null): PaymentAvailability {
  // Before go-live the API takes an order only from the owner, paid with the
  // store's own TEST key (fix batch 1, item 4): COD and Kustom would be
  // refused (409 STORE_NOT_LIVE), so the preview offers only the test card.
  if (flags.ownerPreview) {
    const testCard = Boolean(config?.stripeConfigured) && config?.test_mode === true;
    return {
      storeId: flags.storeId,
      cod: false,
      stripe: testCard,
      kustom: false,
      publishableKey: testCard ? config?.publishableKey ?? null : null,
      stripeAccount: testCard ? config?.stripeAccount ?? null : null,
      route: config?.route,
      testMode: testCard,
      ownerPreview: true,
    };
  }
  return {
    storeId: flags.storeId,
    cod: flags.cod,
    // Card is offered only when Stripe is configured (and active) for the
    // store AND the store creator can accept charges. The public store read
    // says "no card" while only a TEST key is connected; the viewer-aware
    // config (`test_mode`, owner / admin only) overrides that for the owner.
    // M157: a market without card answers `stripeConfigured: false`.
    stripe: Boolean(config?.stripeConfigured) && (flags.card || config?.test_mode === true),
    // Kustom is offered only when the payment config says so AND the store
    // itself hasn't turned it off (both narrowed per market).
    kustom: config?.kustomEnabled === true && flags.kustom,
    publishableKey: config?.publishableKey ?? null,
    stripeAccount: config?.stripeAccount ?? null,
    route: config?.route,
    testMode: config?.test_mode === true,
    ownerPreview: false,
  };
}

/** Something can be paid on the classic form (card element or COD). */
export function classicPossible(availability: PaymentAvailability): boolean {
  return availability.cod || availability.stripe;
}

/**
 * Checkout mode: Kustom-first whenever Kustom is available (never on a
 * market-preview host: Kustom sessions are LIVE-only); `?method=classic` is
 * honoured only when there is something to pay with there.
 */
export function checkoutMode(
  availability: PaymentAvailability,
  opts: { wantsClassic: boolean; previewMode: boolean },
): 'kustom' | 'classic' {
  return !opts.previewMode && availability.kustom && (!opts.wantsClassic || !classicPossible(availability))
    ? 'kustom'
    : 'classic';
}

// ── M157: payment methods per market (error codes of the shared contract) ──

/** The market does not offer the method used (orders, create-intent, Kustom sessions). */
export const MARKET_PAYMENT_METHOD_NOT_ALLOWED = 'MARKET_PAYMENT_METHOD_NOT_ALLOWED';
/** Kustom refused the purchase currency (not enabled on the merchant account). */
export const KUSTOM_CURRENCY_NOT_ENABLED = 'KUSTOM_CURRENCY_NOT_ENABLED';
/** Kustom validation redirect reason: the market stopped offering Kustom. */
export const KUSTOM_REASON_PAYMENT_METHOD_UNAVAILABLE = 'payment_method_unavailable';

/** The `code` of an API error, or null. */
export function apiErrorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code ? code : null;
}

/** What the Kustom-first checkout does with the code of a failed create / update. */
export type KustomFailureAction =
  /** The market no longer offers Kustom: go to the classic form. */
  | { kind: 'classic' }
  /** The market no longer offers Kustom and nothing else is payable. */
  | { kind: 'methodNotAllowed' }
  /** Kustom cannot take this currency: friendly message, no retry. */
  | { kind: 'currency'; payByCard: boolean; otherWay: boolean }
  /** Anything else: today's handling. */
  | { kind: 'default' };

export function kustomFailureAction(
  code: string | null,
  opts: { classicAvailable: boolean; cardAvailable: boolean },
): KustomFailureAction {
  if (code === MARKET_PAYMENT_METHOD_NOT_ALLOWED) {
    return opts.classicAvailable ? { kind: 'classic' } : { kind: 'methodNotAllowed' };
  }
  if (code === KUSTOM_CURRENCY_NOT_ENABLED) {
    return {
      kind: 'currency',
      payByCard: opts.classicAvailable && opts.cardAvailable,
      otherWay: opts.classicAvailable && !opts.cardAvailable,
    };
  }
  return { kind: 'default' };
}

/**
 * Order-first Kustom page (`/checkout/kustom`): the session answer codes that
 * mean "Kustom is not offered for this order here" send the shopper back to
 * the checkout; the currency code shows a friendly message.
 */
export function kustomOrderFirstAction(code: string | null): 'checkout' | 'currency' | 'default' {
  if (code === MARKET_PAYMENT_METHOD_NOT_ALLOWED || code === 'ORDER_KUSTOM_UNAVAILABLE') return 'checkout';
  if (code === KUSTOM_CURRENCY_NOT_ENABLED) return 'currency';
  return 'default';
}
