// ── Store checkout settings (M5 W2-A, M5-PLAN §4 M5.1) ───────────────────────
// Mirror of `multi-stores-api/src/modules/stores/checkout-settings.ts`. The
// storefront payload carries a `checkout` block only when the merchant
// overrode a default; everything else (and every store that never touched the
// setting) resolves to DEFAULT_CHECKOUT_SETTINGS, which is today's behaviour.

export const AFTER_ADD_TO_CART = ['stay', 'cart', 'checkout'] as const;
export type AfterAddToCart = (typeof AFTER_ADD_TO_CART)[number];

export interface CheckoutSettings {
  /** Where the shopper goes after "add to cart" (`stay` = confirmation toast). */
  after_add_to_cart: AfterAddToCart;
  /** Whether the checkout form requires a phone number. */
  phone_required: boolean;
  /** Pay button label per locale; null = the translated default. */
  pay_button_label: Record<string, string> | null;
  /** Query keys that carry a coupon code on any store URL. */
  coupon_param: string[];
  /** Apply a coupon found in the URL automatically. */
  coupon_autoapply: boolean;
}

export const DEFAULT_CHECKOUT_SETTINGS: Readonly<CheckoutSettings> = Object.freeze({
  after_add_to_cart: 'stay',
  phone_required: false,
  pay_button_label: null,
  coupon_param: ['coupon'],
  coupon_autoapply: false,
});

const COUPON_PARAM_RE = /^[A-Za-z0-9_-]+$/;
// Coupon codes are short identifiers; anything longer is noise from the URL.
const MAX_COUPON_CODE_LENGTH = 64;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Coerce the `checkout` block of `storefront.getStore`. Missing / malformed
 * input (and every unknown key) yields the defaults, so a store without the
 * block behaves exactly as before.
 */
export function normalizeCheckoutSettings(raw: unknown): CheckoutSettings {
  const out: CheckoutSettings = { ...DEFAULT_CHECKOUT_SETTINGS, coupon_param: [...DEFAULT_CHECKOUT_SETTINGS.coupon_param] };
  if (!isPlainObject(raw)) return out;
  if ((AFTER_ADD_TO_CART as readonly string[]).includes(raw.after_add_to_cart as string)) {
    out.after_add_to_cart = raw.after_add_to_cart as AfterAddToCart;
  }
  if (typeof raw.phone_required === 'boolean') out.phone_required = raw.phone_required;
  if (typeof raw.coupon_autoapply === 'boolean') out.coupon_autoapply = raw.coupon_autoapply;
  if (isPlainObject(raw.pay_button_label)) {
    const labels: Record<string, string> = {};
    for (const [locale, label] of Object.entries(raw.pay_button_label)) {
      if (typeof label === 'string' && label.trim()) labels[locale] = label.trim();
    }
    if (Object.keys(labels).length) out.pay_button_label = labels;
  }
  if (Array.isArray(raw.coupon_param)) {
    const keys = raw.coupon_param.filter((k): k is string => typeof k === 'string' && COUPON_PARAM_RE.test(k));
    if (keys.length) out.coupon_param = keys;
  }
  return out;
}

/**
 * The pay button label for `locale`, or null to use the translated default.
 * Falls back from a regional tag (`sv-SE`) to its language (`sv`); never to
 * another language, so a label the merchant wrote in Swedish does not show
 * on the English checkout.
 */
export function resolvePayButtonLabel(settings: CheckoutSettings | null | undefined, locale: string): string | null {
  const labels = settings?.pay_button_label;
  if (!labels) return null;
  const exact = labels[locale];
  if (exact) return exact;
  const language = locale.split('-')[0]!;
  return labels[language] || null;
}

/**
 * Reads a coupon code from `search` (the URL query) using the store's
 * `coupon_param` keys. Returns the code and the query string with every
 * coupon key removed (what the URL is rewritten to), or null when none of
 * the keys is present / the value is unusable. The first key in
 * `coupon_param` order wins when several are present.
 */
export function captureCouponFromSearch(
  search: string,
  settings: Pick<CheckoutSettings, 'coupon_param' | 'coupon_autoapply'>,
): { code: string; search: string } | null {
  if (!settings.coupon_autoapply || !search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let code: string | null = null;
  let seen = false;
  for (const key of settings.coupon_param) {
    if (!params.has(key)) continue;
    seen = true;
    const value = (params.get(key) || '').trim();
    params.delete(key);
    if (!code && value && value.length <= MAX_COUPON_CODE_LENGTH) code = value;
  }
  if (!seen || !code) return null;
  const rest = params.toString();
  return { code, search: rest ? `?${rest}` : '' };
}

/** localStorage key of the coupon waiting to be applied, per store. */
export function pendingCouponStorageKey(storeId: string | undefined): string {
  return `ms_pending_coupon:${storeId || 'store'}`;
}

/** The notice the cart / checkout shows after an automatic coupon attempt. */
export interface CouponAutoApplyNotice {
  code: string;
  /** `pending` = captured, waiting for a cart line to validate against. */
  status: 'pending' | 'applied' | 'invalid';
}
