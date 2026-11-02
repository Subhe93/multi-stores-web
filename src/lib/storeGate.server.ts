import 'server-only';
import { cookies } from 'next/headers';
import { api, getStorePreviewToken, registerServerPreviewCookieReader, storefront } from './api';
import type { MarketRef } from './market';
import { STORE_PREVIEW_COOKIE, storeGate, type StoreGate, type StoreGateFields } from './storeGate';

export interface GatedStore<T> {
  store: T;
  gate: StoreGate;
  /** True when the full payload was served for the owner's preview token. */
  preview: boolean;
}

// Server-side reader of the preview cookie for `src/lib/api.ts` (registered
// at module load; the store layout imports this module, so every route under
// it — pages, templates, menus, search — reads through it).
registerServerPreviewCookieReader(async () => {
  try {
    return (await cookies()).get(STORE_PREVIEW_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
});

/**
 * Loads the storefront payload and applies the publication gate.
 *
 * A LIVE store is returned as is. For a gated store (`coming_soon` /
 * `paused`) the owner can still see the full storefront: the client
 * (`StorePreviewUnlock`) copies the owner token it holds — the dashboard's
 * edit-hint hand-off, or a dashboard session — into the `ms_store_preview`
 * cookie (bound to the slug), and `storefront.*` then sends it as a Bearer
 * token on every read of that store (`cache: 'no-store'`). The API answers
 * the full data only for the owner / an admin; any other answer keeps the
 * public gate (the cookie is never trusted on its own).
 *
 * Errors of the public fetch propagate unchanged (the layout maps them to
 * 404 / 5xx as before).
 */
export async function loadGatedStore<T extends StoreGateFields>(
  slug: string,
  market?: MarketRef,
): Promise<GatedStore<T>> {
  // With a valid preview token in force this read already carries it, so
  // the API serves the full payload here.
  const store = (await storefront.getStore(slug, market)) as T;
  const token = await getStorePreviewToken(slug);
  const gate = storeGate(store);
  if (gate === 'live') return { store, gate, preview: token !== null };
  if (!token) return { store, gate, preview: false };

  // The reads carried the token but the answer is still gated (older API):
  // fall back to the explicit owner preview endpoint.
  try {
    const full = (await api<T>(`/storefront/${encodeURIComponent(slug)}/preview`, {
      token,
      cache: 'no-store',
    })) as T;
    if (!full || typeof full !== 'object') return { store, gate, preview: false };
    return { store: full, gate: 'live', preview: true };
  } catch {
    // Not the owner (401/403), token expired, or the endpoint is not
    // deployed yet: the visitor sees the public gate page.
    return { store, gate, preview: false };
  }
}
