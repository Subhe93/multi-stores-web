import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
let loadedKey: string | null = null;

/**
 * Load Stripe.js with the platform publishable key. The key is admin-managed
 * and served by the API (GET /payments/config), so it must be passed in;
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is only a build-time fallback. Returns null
 * when no key is available so callers never initialise Stripe with an empty key.
 */
export function getStripe(publishableKey?: string) {
  const key =
    publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  if (!key) return null;
  if (!stripePromise || loadedKey !== key) {
    stripePromise = loadStripe(key);
    loadedKey = key;
  }
  return stripePromise;
}
