import { loadStripe, Stripe } from '@stripe/stripe-js';

// Cache one Stripe.js instance per (publishableKey, stripeAccount) pair so
// switching between stores in a single session can never reuse a client that
// is scoped to the wrong connected account.
const stripePromises = new Map<string, Promise<Stripe | null>>();

/**
 * Load Stripe.js with the platform publishable key. The key is admin-managed
 * and served by the API (GET /payments/config), so it must be passed in;
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is only a build-time fallback. Returns null
 * when no key is available so callers never initialise Stripe with an empty key.
 *
 * For INDEPENDENT stores the PaymentIntent is created as a direct charge on the
 * store owner's connected account, so Stripe.js must be initialised with the
 * same `stripeAccount` — otherwise confirmCardPayment fails with
 * "No such payment_intent".
 */
export function getStripe(publishableKey?: string, stripeAccount?: string | null) {
  const key =
    publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  if (!key) return null;
  const account = stripeAccount || '';
  const cacheKey = `${key}::${account}`;
  let promise = stripePromises.get(cacheKey);
  if (!promise) {
    promise = account ? loadStripe(key, { stripeAccount: account }) : loadStripe(key);
    stripePromises.set(cacheKey, promise);
  }
  return promise;
}
