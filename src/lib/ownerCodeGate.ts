'use client';

import { useSelectedLayoutSegment } from 'next/navigation';

// Owner-authored code (store-wide custom CSS and Embed Code sections placed in
// the HEADER / FOOTER) runs on every storefront page EXCEPT the pages the
// platform owns end to end: checkout (payment, totals, seller and legal
// text), sign-in / registration and the customer account. There, owner CSS
// could hide mandatory text or read input values through attribute
// selectors, and owner JS could capture credentials — notably on MARKETPLACE
// stores, where the store creator is not the merchant of record.
//
// The gate is read from the segment right below the store layout
// (`app/store/[storeSlug]/layout.tsx`), so it follows client navigations.
// Route groups are reported with their brackets.

const BLOCKED_SEGMENTS = new Set(['(checkout)', 'auth', 'account']);

/** True when owner code may run under this store-layout child segment. */
export function ownerCodeAllowedFor(segment: string | null): boolean {
  return segment === null || !BLOCKED_SEGMENTS.has(segment);
}

/**
 * Whether owner code may run on the current page. Only meaningful in client
 * components rendered by the store layout (the header / footer chrome and the
 * layout itself).
 */
export function useOwnerCodeAllowed(): boolean {
  return ownerCodeAllowedFor(useSelectedLayoutSegment());
}
