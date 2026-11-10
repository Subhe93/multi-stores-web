'use client';

import { useEffect } from 'react';
import { API_URL } from '@/lib/api';
import {
  consumeEditHintHandoff,
  isPlausibleToken,
  readEditHintToken,
} from '@/components/edit-hint/editHintStorage';
import { STORE_PREVIEW_COOKIE } from '@/lib/storeGate';
import { encodePreviewCookie, readBrowserPreviewCookie } from '@/lib/storePreview';

/** Storefront session key of `src/hooks/useAuth.ts` (a dashboard JWT may sit there briefly). */
const STOREFRONT_TOKEN_KEY = 'auth_access_token';

function hasPreviewCookie(): boolean {
  return readBrowserPreviewCookie() !== null;
}

export function cookieAttrs(): string {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; SameSite=Lax${secure}`;
}

export function clearPreviewCookie(): void {
  document.cookie = `${STORE_PREVIEW_COOKIE}=; Max-Age=0${cookieAttrs()}`;
}

/** Owner tokens this browser may hold, most specific first. */
export function candidateTokens(): string[] {
  const out: string[] = [];
  const hint = readEditHintToken();
  if (hint) out.push(hint);
  try {
    const session = window.localStorage.getItem(STOREFRONT_TOKEN_KEY);
    if (isPlausibleToken(session) && !out.includes(session)) out.push(session);
  } catch {
    /* storage unavailable */
  }
  return out;
}

/**
 * Mounted on the LIVE storefront without preview: a left-over cookie is
 * dropped so no later browser read carries a token needlessly.
 */
export function StorePreviewReset() {
  useEffect(() => {
    if (hasPreviewCookie()) clearPreviewCookie();
  }, []);
  return null;
}

/**
 * Mounted on the public "Coming soon" / "Temporarily closed" page. A
 * visitor without an owner token gets no request. When the dashboard
 * handed this browser an owner token (edit-hint hand-off) or a dashboard
 * session is stored, the token is tried against the owner preview
 * endpoint; on success it is copied into a session cookie and the page
 * reloads, so the server layout can fetch the full storefront with it.
 *
 * The hand-off fragment (`#ms_edit=<token>`) is consumed here as well: the
 * Edit button that normally does it is not mounted on the gate page, and
 * the dashboard's "visit store" link lands on this page for a DRAFT store.
 *
 * A cookie that is already present while this page still renders means
 * the server tried it and the API refused: it is cleared and nothing is
 * retried, so a stale token can never loop the page.
 */
export function StorePreviewUnlock({ storeSlug }: { storeSlug: string }) {
  useEffect(() => {
    consumeEditHintHandoff();
    if (hasPreviewCookie()) {
      clearPreviewCookie();
      return;
    }
    const tokens = candidateTokens();
    if (tokens.length === 0) return;
    const controller = new AbortController();
    (async () => {
      for (const token of tokens) {
        try {
          const res = await fetch(`${API_URL}/storefront/${encodeURIComponent(storeSlug)}/preview`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
          });
          if (!res.ok) continue;
          // Bound to this slug: api.ts never sends it to another store's endpoints.
          document.cookie = `${STORE_PREVIEW_COOKIE}=${encodePreviewCookie(storeSlug, token)}${cookieAttrs()}`;
          window.location.reload();
          return;
        } catch {
          /* aborted or offline: stay on the public page */
          if (controller.signal.aborted) return;
        }
      }
    })();
    return () => controller.abort();
  }, [storeSlug]);

  return null;
}
