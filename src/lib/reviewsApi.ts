// Browser calls of the reviews app (M171): the signed-in customer's routes
// and the review-link routes. The browser talks to the API directly, so the
// per-IP throttles see the real visitor. The review-link token only ever
// travels in a JSON body (never in a path or a query string).

import { api } from './api';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** The customer's own review, as the form prefills it. */
export interface OwnReview {
  /** Absent on the review-link routes (the link edits its own review only). */
  id?: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  status: ReviewStatus;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason: null | 'NOT_PURCHASED';
  display_name_suggestion: string;
  review: OwnReview | null;
}

export interface OrderReviewItems {
  eligible: boolean;
  items: { order_item_id: string; product_id: string; review_status: ReviewStatus | null }[];
}

export interface ReviewLinkContext {
  product: {
    id: string;
    translations: { locale: string; title: string; slug: string }[];
    image_url: string | null;
  };
  display_name_suggestion: string;
  review: OwnReview | null;
  expires_at: string;
}

/** Answer of the two write routes (`id: null` only for a dropped spam post). */
export interface SubmitReviewResult {
  id: string | null;
  status: ReviewStatus;
}

/** Fields of both write routes. */
export interface ReviewFields {
  rating: number;
  title?: string;
  body: string;
  display_name: string;
  locale: string;
  /** Honeypot: sent only when something filled the hidden field. */
  website?: string;
  turnstile_token?: string;
}

const base = (storeSlug: string) => `/storefront/${encodeURIComponent(storeSlug)}/reviews`;

export const reviewsApi = {
  eligibility: (storeSlug: string, productId: string, token: string) =>
    api<ReviewEligibility>(`${base(storeSlug)}/mine/eligibility?product_id=${encodeURIComponent(productId)}`, { token }),

  orderItems: (storeSlug: string, orderId: string, token: string) =>
    api<OrderReviewItems>(`${base(storeSlug)}/mine/orders/${encodeURIComponent(orderId)}`, { token }),

  submitMine: (storeSlug: string, fields: ReviewFields & { product_id: string }, token: string) =>
    api<SubmitReviewResult>(`${base(storeSlug)}/mine`, { method: 'PUT', body: JSON.stringify(fields), token }),

  deleteMine: (storeSlug: string, id: string, token: string) =>
    api<{ deleted: boolean }>(`${base(storeSlug)}/mine/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  linkContext: (storeSlug: string, linkToken: string) =>
    api<ReviewLinkContext>(`${base(storeSlug)}/link/context`, { method: 'POST', body: JSON.stringify({ token: linkToken }) }),

  submitLink: (storeSlug: string, fields: ReviewFields & { token: string }) =>
    api<SubmitReviewResult>(`${base(storeSlug)}/link`, { method: 'PUT', body: JSON.stringify(fields) }),
};
