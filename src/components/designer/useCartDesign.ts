'use client';

// ── Designer line in the cart (M4.2 §7.1) ─────────────────────────────────
// Server-cart lines get a fresh signed proof with every GET /cart. Guest lines
// keep only the design id (+ token): their proof link (1 h) is refreshed
// here with GET design. Also resolves the "Edit design" link (the design's
// `product_slug`, else the product page path recorded in this browser) and
// offers "start again from this design" for an ordered (locked) design.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCart, type CartLineDesign } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useLocalePath } from '@/hooks/useLocalePath';
import { createDesignerClient, designerClientOptions, getDesignPath, getDesignToken } from '@/lib/designer/api';
import { designEditHref } from '@/lib/designer/storefront';

const FRESH_MS = 45 * 60 * 1000;

export interface CacheEntry {
  at: number;
  proofUrl: string | null;
  editable: boolean;
  productSlug: string | null;
  /** M5.6: the design has a back (its proof may still be null). */
  doubleSided?: boolean;
  proofBackUrl?: string | null;
}
/** Upper bound of cached design views (D25): a long session must not grow it forever. */
export const CART_DESIGN_CACHE_MAX = 50;
const cache = new Map<string, CacheEntry>();

/** Stores a view; the least recently stored entries are dropped past the bound. */
export function rememberCartDesign(designId: string, entry: CacheEntry): void {
  cache.delete(designId); // re-insert last (eviction order)
  cache.set(designId, entry);
  while (cache.size > CART_DESIGN_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Number of cached design views (tests). */
export function cartDesignCacheSize(): number {
  return cache.size;
}

/** Drops the cached design view(s) so the next render re-reads them (after an edit). */
export function clearCartDesignCache(designId?: string): void {
  if (designId) cache.delete(designId);
  else cache.clear();
}

export function useCartDesign(design: CartLineDesign | undefined, guestLine: boolean) {
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = typeof params?.storeSlug === 'string' ? params.storeSlug : '';
  const lp = useLocalePath();
  const { token: authToken, loading: authLoading } = useAuth();
  const { replaceDesignLine } = useCart();
  const id = design?.id ?? null;
  const [fresh, setFresh] = useState<CacheEntry | null>(() => {
    const hit = id ? cache.get(id) : undefined;
    return hit && Date.now() - hit.at < FRESH_MS ? hit : null;
  });
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    setStoredPath(getDesignPath(id));
  }, [id]);

  // Picks up a cleared cache entry (edited design) on the next render.
  const hit = id ? cache.get(id) : undefined;
  const missing = !hit || Date.now() - hit.at >= FRESH_MS;

  useEffect(() => {
    if (!id || !guestLine || !getDesignToken(id)) return;
    if (!missing) return;
    // The JWT goes along when signed in: a claimed design ignores the token.
    const o = designerClientOptions(storeSlug, { token: authToken, loading: authLoading });
    if (!o) return;
    let cancelled = false;
    createDesignerClient(o)
      .get(id)
      .then((view) => {
        const entry: CacheEntry = {
          at: Date.now(),
          proofUrl: view.proof_url,
          editable: view.status !== 'ORDERED',
          productSlug: typeof view.product_slug === 'string' && view.product_slug ? view.product_slug : null,
          ...(view.back ? { doubleSided: true, proofBackUrl: view.proof_back_url ?? null } : {}),
        };
        rememberCartDesign(id, entry);
        if (!cancelled) setFresh(entry);
      })
      .catch(() => {
        // Locked / purged / offline: keep the line's own image.
      });
    return () => {
      cancelled = true;
    };
  }, [id, guestLine, storeSlug, missing, authToken, authLoading]);

  // A guest line's stored proof link may have expired: only a fresh read counts.
  const proofUrl = fresh ? fresh.proofUrl : guestLine ? null : design?.proofUrl ?? null;
  // M5.6: the back thumbnail of a double-sided line (same freshness rule).
  const doubleSided = fresh ? fresh.doubleSided === true : design?.doubleSided === true;
  const proofBackUrl = fresh ? (fresh.proofBackUrl ?? null) : guestLine ? null : design?.proofBackUrl ?? null;
  const editable = fresh ? fresh.editable : design?.editable === true;
  const locked = Boolean(design) && (!editable || design?.invalidCode === 'DESIGNER_DESIGN_LOCKED');
  const productSlug = design?.productSlug ?? fresh?.productSlug ?? null;
  const editHref = id && editable && !locked ? designEditHref(id, productSlug, storedPath, lp) : null;

  /** Copies the ordered design into a new draft and moves the cart line onto it. */
  const startAgain = useCallback(async () => {
    if (!id || !storeSlug || restarting) return;
    setRestarting(true);
    setRestartError(null);
    try {
      const view = await createDesignerClient({ storeSlug, authToken }).duplicate(id);
      await replaceDesignLine(id, {
        id: view.id,
        token: getDesignToken(view.id),
        proofUrl: view.proof_url,
        productSlug: view.product_slug ?? productSlug,
      });
      clearCartDesignCache(id);
    } catch (err) {
      setRestartError(err);
    } finally {
      setRestarting(false);
    }
  }, [id, storeSlug, authToken, restarting, replaceDesignLine, productSlug]);

  return { proofUrl, doubleSided, proofBackUrl, editHref, locked, startAgain, restarting, restartError };
}
