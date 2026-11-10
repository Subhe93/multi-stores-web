// Storefront publication gate (platform onboarding, SPEC §3 / §7).
//
// `GET /storefront/:slug` answers 200 for every known store, but a store
// that is not LIVE carries a reduced payload: `{ coming_soon: true }` for
// DRAFT / PENDING_REVIEW / CHANGES_REQUESTED, `{ paused: true }` for
// PAUSED (no catalog in either case). SUSPENDED is a plain 404. The store
// layout turns those shapes into the branded "Coming soon" / "Temporarily
// closed" pages; the owner can still open the full store through the
// preview endpoint (`src/lib/storeGate.server.ts`).
//
// Shared constants and pure helpers only — no `next/headers` here so client
// code can import it.

import { locales } from '@/i18n/config';

/** Cookie carrying the owner token for the server-side preview fetch. */
export const STORE_PREVIEW_COOKIE = 'ms_store_preview';

/**
 * Cookie carrying the owner token for the preview of ONE DRAFT product on
 * a LIVE store (`<slug>:<token>`, same encoding). Read by the single
 * product fetch only — lists, search and the sitemap never see it — so a
 * LIVE store keeps its cached public reads while the owner previews a
 * draft (see `src/components/layout/ProductPreview.tsx`).
 */
export const PRODUCT_PREVIEW_COOKIE = 'ms_product_preview';

/** API error code of cart / checkout calls against a non-LIVE store. */
export const STORE_NOT_LIVE_CODE = 'STORE_NOT_LIVE';

export type StoreGate = 'live' | 'coming_soon' | 'paused';

/** Fields of the storefront payload the gate reads. */
export interface StoreGateFields {
  status?: string;
  coming_soon?: boolean;
  paused?: boolean;
}

/** Which page the public storefront may show for this payload. */
export function storeGate(store: StoreGateFields | null | undefined): StoreGate {
  if (!store) return 'live';
  if (store.coming_soon === true) return 'coming_soon';
  if (store.paused === true) return 'paused';
  return 'live';
}

/** True when the API refused a cart / checkout call because the store is not LIVE (409). */
export function isStoreNotLiveError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === STORE_NOT_LIVE_CODE
  );
}

/**
 * The store home for the current public path, keeping a leading locale
 * prefix (`/sv/cart` → `/sv/`, `/cart` → `/`). Public paths only: the
 * proxy maps the store host to `/store/{slug}` internally, and that
 * internal form never appears in the address bar.
 */
export function storeHomeHref(pathname: string): string {
  const first = pathname.split('/')[1] ?? '';
  return (locales as readonly string[]).includes(first) ? `/${first}/` : '/';
}
