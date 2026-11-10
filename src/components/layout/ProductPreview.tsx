'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { PRODUCT_PREVIEW_COOKIE } from '@/lib/storeGate';
import { encodePreviewCookie, readBrowserProductPreviewCookie } from '@/lib/storePreview';
import { consumeEditHintHandoff, takeHandoffToken } from '@/components/edit-hint/editHintStorage';
import { candidateTokens, cookieAttrs } from './StorePreviewUnlock';

// Owner preview of a DRAFT product on a LIVE store.
//
// The dashboard's "Preview on store" button opens the product URL with the
// edit-hint hand-off (`#ms_edit=<token>`). The server render has no owner
// token yet, so the API answers 404 and the store 404 page mounts
// `ProductPreviewUnlock`: it tries the owner tokens this browser holds
// against the product endpoint and, when the API serves the product,
// copies the token into the `ms_product_preview` cookie (bound to the
// slug) and reloads. The product page then reads the draft through that
// cookie (`cache: 'no-store'`, see `src/lib/api.ts`) and shows
// `ProductPreviewBanner`. Lists never read the cookie, so the public,
// cached storefront is untouched. On a non-LIVE store the store preview
// cookie already carries the token and the draft is served without this.

/** `/products/<slug>` (any locale prefix, trailing slash tolerated) → the encoded product slug. */
export function productSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/\/products\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

export function clearProductPreviewCookie(): void {
  document.cookie = `${PRODUCT_PREVIEW_COOKIE}=; Max-Age=0${cookieAttrs()}`;
}

/**
 * Session flag set by "Exit preview" (value: the store slug). The owner's
 * edit-hint token stays in localStorage for 30 days, so without it the 404
 * page would silently re-enter the preview on the next load. A fresh
 * dashboard hand-off (`#ms_edit=`) clears it.
 */
const PREVIEW_EXITED_KEY = 'ms_product_preview_exited';

function markPreviewExited(storeSlug: string): void {
  try {
    window.sessionStorage.setItem(PREVIEW_EXITED_KEY, storeSlug);
  } catch {
    /* storage unavailable */
  }
}

function previewExited(storeSlug: string): boolean {
  try {
    return window.sessionStorage.getItem(PREVIEW_EXITED_KEY) === storeSlug;
  } catch {
    return false;
  }
}

function clearPreviewExited(): void {
  try {
    window.sessionStorage.removeItem(PREVIEW_EXITED_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Mounted on the store 404 page. Does nothing for a visitor without an
 * owner token or on a path that is not a product URL. A cookie already
 * present while the 404 still renders means the API refused the token
 * (not the owner, expired, product gone): it is cleared, nothing is
 * retried, so a stale token can never loop the page. After "Exit preview"
 * nothing is tried either, until the dashboard hands a token over again.
 */
export function ProductPreviewUnlock({ storeSlug }: { storeSlug: string }) {
  useEffect(() => {
    // A fresh hand-off (fragment still in the address bar) re-arms the
    // preview; it must be read before the fragment is consumed below.
    if (takeHandoffToken(window.location.href)?.token) clearPreviewExited();
    consumeEditHintHandoff();
    const productSlug = productSlugFromPath(window.location.pathname);
    if (!productSlug) return;
    if (previewExited(storeSlug)) return;
    if (readBrowserProductPreviewCookie() !== null) {
      clearProductPreviewCookie();
      return;
    }
    const tokens = candidateTokens();
    if (tokens.length === 0) return;
    const controller = new AbortController();
    (async () => {
      for (const token of tokens) {
        try {
          const res = await fetch(
            `${API_URL}/storefront/${encodeURIComponent(storeSlug)}/products/${productSlug}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
              credentials: 'omit',
              signal: controller.signal,
            },
          );
          if (!res.ok) continue;
          // Bound to this slug: api.ts never sends it to another store's endpoints.
          document.cookie = `${PRODUCT_PREVIEW_COOKIE}=${encodePreviewCookie(storeSlug, token)}${cookieAttrs()}`;
          window.location.reload();
          return;
        } catch {
          /* aborted or offline: stay on the 404 page */
          if (controller.signal.aborted) return;
        }
      }
    })();
    return () => controller.abort();
  }, [storeSlug]);

  return null;
}

/**
 * Small sticky strip at the top of a product page rendered from a DRAFT
 * product (owner preview). "Exit" drops the product preview cookie, marks
 * the session as exited (so the 404 page does not re-enter the preview
 * with the stored edit-hint token) and reloads: the owner then sees what
 * every visitor sees (the 404).
 */
export function ProductPreviewBanner({ storeSlug }: { storeSlug: string }) {
  const t = useTranslations('store');
  const exit = () => {
    markPreviewExited(storeSlug);
    clearProductPreviewCookie();
    window.location.reload();
  };
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900/95 shadow-md"
    >
      <Eye className="w-4 h-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span>{t('productPreviewBar')}</span>
      <button
        type="button"
        onClick={exit}
        className="ms-2 rounded-md border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10 transition-colors"
      >
        {t('previewBarExit')}
      </button>
    </div>
  );
}
