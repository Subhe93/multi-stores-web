'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { CartItem } from '@/hooks/useCart';

// ── Kustom-first checkout session ─────────────────────────────────────────────
// Talks to /payments/kustom/checkout/session (plans/kustom-integration/
// API-CONTRACT-B.md). The session mirrors the cart: it is created once per
// store visit, remembered in sessionStorage so a reload resumes it, and every
// change of lines / coupon / notes is pushed with a debounced PUT while the
// Kustom iframe is suspended.

/** Same shape POST /cart/items accepts (see API-CONTRACT-B `CartLine`). */
export interface KustomCartLine {
  product_id?: string;
  custom_product_id?: string;
  variant_id?: string;
  bundle_offer_id?: string;
  quantity: number;
  custom_fields?: Record<string, unknown>;
}

export interface KustomCheckoutSessionResponse {
  session_id: string;
  token: string;
  kustom_order_id: string;
  html_snippet: string;
  status: string;
}

export interface StoredKustomSession {
  session_id: string;
  token: string;
  kustom_order_id: string;
}

// Kustom (ex-Klarna) checkout JS API: `window._kustomCheckout(cb)` (or the
// legacy `window._klarnaCheckout`) hands the api object to the callback once
// the iframe is ready. Only the two methods we use are typed.
interface KustomJsApi {
  suspend: () => void;
  resume: () => void;
}
type KustomJsLoader = (callback: (checkoutApi: KustomJsApi) => void) => void;

declare global {
  interface Window {
    _kustomCheckout?: KustomJsLoader;
    _klarnaCheckout?: KustomJsLoader;
  }
}

const STORAGE_PREFIX = 'kustom_checkout_session:';
const SYNC_DEBOUNCE_MS = 400;
// How long to wait for the Kustom JS API before syncing without suspend/resume
// (the loader queues the callback until the iframe is ready; if the snippet
// never booted the callback never fires).
const JS_API_WAIT_MS = 3000;
// A PUT answered with one of these means the stored session is gone or can no
// longer be edited (expired / already ordered) — start a fresh one.
const STALE_SESSION_STATUSES = new Set([404, 409, 410]);

export function kustomSessionStorageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug}`;
}

function readStoredSession(storeSlug: string): StoredKustomSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(kustomSessionStorageKey(storeSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredKustomSession>;
    if (!parsed.session_id || !parsed.token) return null;
    return {
      session_id: parsed.session_id,
      token: parsed.token,
      kustom_order_id: parsed.kustom_order_id || '',
    };
  } catch {
    return null;
  }
}

function writeStoredSession(storeSlug: string, session: StoredKustomSession) {
  try {
    sessionStorage.setItem(kustomSessionStorageKey(storeSlug), JSON.stringify(session));
  } catch {
    /* storage may be unavailable (private mode) — the session still works for this page load */
  }
}

/** Forget the remembered session, e.g. once the order is confirmed. */
export function clearKustomCheckoutSession(storeSlug: string) {
  try {
    sessionStorage.removeItem(kustomSessionStorageKey(storeSlug));
  } catch {
    /* ignore */
  }
}

/** Map cart-hook items to the `CartLine[]` snapshot the session API expects. */
export function toKustomCartLines(items: CartItem[]): KustomCartLine[] {
  return items.map((item) => {
    const line: KustomCartLine = { quantity: item.quantity };
    // Guest custom-product lines carry the custom product id in both
    // `productId` and `customProductId`; server lines only in the latter.
    if (item.customProductId) line.custom_product_id = item.customProductId;
    else if (item.productId) line.product_id = item.productId;
    if (item.variantId) line.variant_id = item.variantId;
    if (item.bundleOfferId) line.bundle_offer_id = item.bundleOfferId;
    if (item.customFields && Object.keys(item.customFields).length > 0) {
      line.custom_fields = item.customFields;
    }
    return line;
  });
}

function isStaleSessionError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return typeof status === 'number' && STALE_SESSION_STATUSES.has(status);
}

function isUnauthorizedError(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 401;
}

function getKustomLoader(): KustomJsLoader | undefined {
  if (typeof window === 'undefined') return undefined;
  return window._kustomCheckout || window._klarnaCheckout;
}

// Run `work` with the Kustom JS API when it is available (`(api) => …`
// callback form), or with `null` when the snippet exposes no API / never
// answers. The returned promise settles when `work` does.
function withKustomApi(work: (checkoutApi: KustomJsApi | null) => Promise<void>): Promise<void> {
  const loader = getKustomLoader();
  if (!loader) return work(null);
  return new Promise<void>((resolve) => {
    let started = false;
    const start = (checkoutApi: KustomJsApi | null) => {
      if (started) return;
      started = true;
      work(checkoutApi).finally(resolve);
    };
    const fallback = setTimeout(() => start(null), JS_API_WAIT_MS);
    try {
      loader((checkoutApi) => {
        clearTimeout(fallback);
        start(checkoutApi);
      });
    } catch {
      clearTimeout(fallback);
      start(null);
    }
  });
}

export interface UseKustomCheckoutOptions {
  storeSlug: string;
  /** Storefront locale sent to Kustom for the iframe language. */
  locale: string;
  /** False while auth / cart are still resolving — nothing is requested until true. */
  enabled: boolean;
  authToken: string | null;
  /**
   * `useAuth().refresh` — asked for a new access token when a request that
   * carried `authToken` is answered 401. Optional: without it (or when it
   * resolves null) the request is retried once as a guest.
   */
  refreshAuth?: () => Promise<string | null>;
  items: CartItem[];
  couponCode: string | null;
  notes: string;
}

export interface UseKustomCheckoutResult {
  /** Kustom `html_snippet` to mount, null until the session exists. */
  html: string | null;
  /** True while the session is being created / resumed on mount. */
  loading: boolean;
  /** True while a change is being pushed to the session. */
  updating: boolean;
  /** The session could not be created or resumed. */
  failed: boolean;
  /** A change could not be pushed (the iframe may show stale totals). */
  syncFailed: boolean;
  session: StoredKustomSession | null;
  retry: () => void;
}

export function useKustomCheckout({
  storeSlug,
  locale,
  enabled,
  authToken,
  refreshAuth,
  items,
  couponCode,
  notes,
}: UseKustomCheckoutOptions): UseKustomCheckoutResult {
  const [html, setHtml] = useState<string | null>(null);
  const [session, setSession] = useState<StoredKustomSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resyncTick, setResyncTick] = useState(0);

  const lines = useMemo(() => toKustomCartLines(items), [items]);
  // Everything the session mirrors, serialised; a change schedules a resync.
  const changeKey = useMemo(
    () => JSON.stringify({ lines, coupon: couponCode ?? null, notes: notes || null }),
    [lines, couponCode, notes],
  );

  // Latest inputs for the async callbacks (avoids stale closures without
  // re-creating the callbacks on every keystroke).
  const latest = useRef({ lines, couponCode, notes, authToken, refreshAuth, locale, changeKey });
  latest.current = { lines, couponCode, notes, authToken, refreshAuth, locale, changeKey };

  const sessionRef = useRef<StoredKustomSession | null>(null);
  // `changeKey` the session currently reflects.
  const syncedKeyRef = useRef<string | null>(null);
  // Shared create/resume request so React strict-mode double effects (or a
  // fast re-render) never open two Kustom sessions.
  const establishRef = useRef<Promise<KustomCheckoutSessionResponse> | null>(null);
  const establishedRef = useRef(false);
  const syncingRef = useRef(false);

  // Send a session request with the current JWT, recovering from a 401.
  //
  // The session endpoints use an optional-JWT guard: no Bearer header means
  // "guest", but a Bearer header that is expired or invalid is rejected with
  // 401 rather than ignored. The storefront keeps the access token in
  // localStorage across visits, so a shopper who comes back after it expired
  // would otherwise be stuck with a checkout that never loads. Recovery order:
  //   1. ask `refreshAuth` (useAuth().refresh) for a new access token and
  //      resend with it;
  //   2. if there is no refresh mechanism, it fails, or the refreshed token is
  //      rejected too, resend once as a guest (no token, guest cart lines in
  //      `items`) so the session still gets created / updated.
  // Each step runs at most once — no loop. Local auth state is not touched
  // here; only `useAuth().refresh` clears it, and only on a failed refresh.
  const sendWithAuthFallback = useCallback(
    async (send: (jwt: string | undefined) => Promise<KustomCheckoutSessionResponse>) => {
      const { authToken: jwt, refreshAuth: tryRefresh } = latest.current;
      try {
        return await send(jwt ?? undefined);
      } catch (err) {
        if (!jwt || !isUnauthorizedError(err)) throw err;
      }
      let fresh: string | null = null;
      if (tryRefresh) {
        try { fresh = await tryRefresh(); } catch { fresh = null; }
      }
      if (fresh) {
        try {
          return await send(fresh);
        } catch (err) {
          if (!isUnauthorizedError(err)) throw err;
        }
      }
      // Guest retry (once).
      return send(undefined);
    },
    [],
  );

  const createSession = useCallback(async (): Promise<KustomCheckoutSessionResponse> => {
    const { lines: currentLines, couponCode: code, notes: text, locale: lang } = latest.current;
    const res = await sendWithAuthFallback((jwt) =>
      api<KustomCheckoutSessionResponse>('/payments/kustom/checkout/session', {
        method: 'POST',
        token: jwt,
        body: JSON.stringify({
          store_slug: storeSlug,
          locale: lang,
          // Logged-in shoppers omit `items`: the API reads their server cart.
          // A guest (or the guest fallback after a 401) sends the local lines.
          ...(jwt ? {} : { items: currentLines }),
          ...(code ? { coupon_code: code } : {}),
          ...(text ? { notes: text } : {}),
        }),
      }),
    );
    const stored: StoredKustomSession = {
      session_id: res.session_id,
      token: res.token,
      kustom_order_id: res.kustom_order_id,
    };
    writeStoredSession(storeSlug, stored);
    sessionRef.current = stored;
    setSession(stored);
    return res;
  }, [storeSlug, sendWithAuthFallback]);

  const updateSession = useCallback(async (stored: StoredKustomSession): Promise<KustomCheckoutSessionResponse> => {
    const { lines: currentLines, couponCode: code, notes: text } = latest.current;
    return sendWithAuthFallback((jwt) =>
      api<KustomCheckoutSessionResponse>(
        `/payments/kustom/checkout/session/${encodeURIComponent(stored.session_id)}`,
        {
          method: 'PUT',
          token: jwt,
          body: JSON.stringify({
            token: stored.token,
            // Always send the lines: for a logged-in shopper they equal the
            // server cart, and it keeps the PUT self-contained (which is also
            // what makes the guest fallback after a 401 work unchanged).
            items: currentLines,
            coupon_code: code ?? null,
            notes: text || null,
          }),
        },
      ),
    );
  }, [sendWithAuthFallback]);

  // Resume the remembered session with a PUT (resync), or create a new one
  // when there is none / it is gone.
  const establish = useCallback(async (): Promise<KustomCheckoutSessionResponse> => {
    const key = latest.current.changeKey;
    const stored = readStoredSession(storeSlug);
    let res: KustomCheckoutSessionResponse | null = null;
    if (stored) {
      try {
        res = await updateSession(stored);
        sessionRef.current = stored;
        setSession(stored);
      } catch (err) {
        if (!isStaleSessionError(err)) throw err;
        clearKustomCheckoutSession(storeSlug);
      }
    }
    if (!res) res = await createSession();
    syncedKeyRef.current = key;
    establishedRef.current = true;
    return res;
  }, [storeSlug, updateSession, createSession]);

  const hasLines = lines.length > 0;

  // ── Mount: create or resume ────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !storeSlug || !hasLines) return;
    if (establishedRef.current) return;
    let cancelled = false;
    let promise = establishRef.current;
    if (!promise) {
      promise = establish().finally(() => { establishRef.current = null; });
      establishRef.current = promise;
    }
    setLoading(true);
    setFailed(false);
    promise
      .then((res) => {
        if (cancelled) return;
        setHtml(res.html_snippet);
        setSyncFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enabled, storeSlug, hasLines, attempt, establish]);

  // ── Push a change: suspend → PUT → resume ─────────────────────────────────
  const runSync = useCallback(async () => {
    const stored = sessionRef.current;
    if (!stored || syncingRef.current) return;
    const key = latest.current.changeKey;
    syncingRef.current = true;
    setUpdating(true);

    // PUT the session; when it is gone, open a new one with the same content.
    const push = async (): Promise<{ res: KustomCheckoutSessionResponse; recreated: boolean }> => {
      try {
        const res = await updateSession(stored);
        return { res, recreated: false };
      } catch (err) {
        if (!isStaleSessionError(err)) throw err;
        clearKustomCheckoutSession(storeSlug);
        const res = await createSession();
        return { res, recreated: true };
      }
    };

    try {
      await withKustomApi(async (checkoutApi) => {
        if (checkoutApi) {
          try { checkoutApi.suspend(); } catch { /* iframe not ready — the PUT still applies */ }
        }
        try {
          const { res, recreated } = await push();
          syncedKeyRef.current = key;
          setSyncFailed(false);
          // With the JS API the iframe reloads the order itself on resume; a
          // new session (or no API) needs the fresh snippet mounted instead.
          if (recreated || !checkoutApi) setHtml(res.html_snippet);
        } catch {
          setSyncFailed(true);
        } finally {
          if (checkoutApi) {
            try { checkoutApi.resume(); } catch { /* ignore */ }
          }
        }
      });
    } finally {
      syncingRef.current = false;
      setUpdating(false);
      // Inputs changed while the request was in flight: go again.
      if (latest.current.changeKey !== syncedKeyRef.current) setResyncTick((n) => n + 1);
    }
  }, [storeSlug, updateSession, createSession]);

  useEffect(() => {
    if (!session || !establishedRef.current) return;
    if (!hasLines) return;
    if (changeKey === syncedKeyRef.current) return;
    const timer = setTimeout(() => { void runSync(); }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [session, hasLines, changeKey, resyncTick, runSync]);

  const retry = useCallback(() => {
    establishedRef.current = false;
    setAttempt((n) => n + 1);
  }, []);

  return { html, loading, updating, failed, syncFailed, session, retry };
}
