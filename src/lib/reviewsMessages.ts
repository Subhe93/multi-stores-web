// Client messages of the reviews app (M171). Every message of a store page
// is serialized into its HTML for the client provider, so the texts of the
// reviews app are sent only to stores that have the app on: a store without
// it keeps exactly the page payload it had before the app existed.
// Pure: no React, no `next/*` import.

type Messages = Record<string, unknown>;

const isObj = (v: unknown): v is Messages => !!v && typeof v === 'object' && !Array.isArray(v);

/** Message keys outside the `reviews` namespace that only the app reads. */
export const REVIEWS_ACCOUNT_KEYS = ['writeReview', 'editReview'] as const;

/** True for an `errors.*` key only the reviews app reads. */
export function isReviewsErrorKey(key: string): boolean {
  return key.startsWith('REVIEW_') || key === 'REVIEWS_NOT_ENABLED';
}

/**
 * The messages for the client provider of a store page: unchanged while the
 * `reviews` app is on, else without the app's texts (the `reviews`
 * namespace, its error codes and its two account labels). The input is not
 * mutated; other namespaces keep their object identity.
 */
export function reviewsClientMessages<T extends object>(messages: T, reviewsEnabled: boolean): T {
  if (reviewsEnabled || !isObj(messages)) return messages;
  const out: Messages = {};
  for (const [namespace, value] of Object.entries(messages)) {
    if (namespace === 'reviews') continue;
    if (namespace === 'errors' && isObj(value)) {
      const errors: Messages = {};
      for (const [key, text] of Object.entries(value)) if (!isReviewsErrorKey(key)) errors[key] = text;
      out[namespace] = errors;
      continue;
    }
    if (namespace === 'account' && isObj(value)) {
      const account: Messages = { ...value };
      for (const key of REVIEWS_ACCOUNT_KEYS) delete account[key];
      out[namespace] = account;
      continue;
    }
    out[namespace] = value;
  }
  return out as T;
}
