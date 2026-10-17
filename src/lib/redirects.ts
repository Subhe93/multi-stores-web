// Store redirects for the storefront proxy (M4.4 §6.2, §6.4).
//
// Path normalisation mirrors `multi-stores-api/src/modules/redirects/
// redirect-path.util.ts`; the vectors in its spec are the contract and are
// repeated in redirects.spec.ts. Everything here is edge-safe (fetch,
// AbortController, Map) and fails OPEN: any error means "no redirect".
//
// The proxy only calls `matchStoreRedirect` when the host lookup answered a
// `redirects_version`, so stores without redirects never reach this module.

export const REDIRECT_PATH_MAX = 1024;

const FALLBACK_SUFFIX = /\/(?:page\/\d+|feed|amp)$/;
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

/** Percent-decode; an invalid sequence leaves the input unchanged. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Normalised matching key of a request path: query and fragment dropped,
 * percent-decoded (safely), NFC, lower-case, `//` collapsed, trailing `/`
 * removed (except on root). Null for input that is not a path.
 */
export function normalizeRedirectPath(input: string): string | null {
  if (typeof input !== 'string') return null;
  let path = input.trim();
  const cut = path.search(/[?#]/);
  if (cut >= 0) path = path.slice(0, cut);
  if (!path.startsWith('/')) return null;
  path = safeDecode(path).normalize('NFC').toLowerCase();
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path.length > REDIRECT_PATH_MAX) return null;
  return path;
}

/** The single retry key: a trailing `/page/<n>`, `/feed` or `/amp` removed. */
export function fallbackRedirectPath(normalized: string): string | null {
  if (!FALLBACK_SUFFIX.test(normalized)) return null;
  const stripped = normalized.replace(FALLBACK_SUFFIX, '');
  return stripped === '' ? '/' : stripped;
}

/**
 * Same-host target check (defence in depth; the API validates on write):
 * absolute path, not protocol-relative, no backslash/whitespace/control
 * characters, and no decoded `//` or `/\` prefix.
 */
export function isSafeRedirectTarget(to: unknown): to is string {
  if (typeof to !== 'string') return false;
  if (!to.startsWith('/') || to.startsWith('//')) return false;
  if (to.length > REDIRECT_PATH_MAX) return false;
  if (/[\\\s\u0000-\u001f\u007f]/.test(to)) return false;
  const decoded = safeDecode(to);
  return !(decoded.startsWith('//') || decoded.startsWith('/\\'));
}

export type RedirectHit = { to: string; status: number };

/** Exact key first, then the fallback key once. */
export function matchRedirectMap(
  map: ReadonlyMap<string, RedirectHit>,
  requestPath: string,
): RedirectHit | null {
  const key = normalizeRedirectPath(requestPath);
  if (key === null) return null;
  const exact = map.get(key);
  if (exact) return exact;
  const fallback = fallbackRedirectPath(key);
  return fallback === null ? null : (map.get(fallback) ?? null);
}

/**
 * Location for a hit: the request query is kept (§6.2 step 4). When the
 * target has its own query the request's parameters are appended to it;
 * a target fragment stays last.
 */
export function buildRedirectLocation(to: string, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) return to;
  const hashAt = to.indexOf('#');
  const base = hashAt >= 0 ? to.slice(0, hashAt) : to;
  const hash = hashAt >= 0 ? to.slice(hashAt) : '';
  const joiner = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${joiner}${query}${hash}`;
}

/** A hit whose target is the request path itself would loop: ignore it. */
function isSelfRedirect(requestPath: string, to: string): boolean {
  const from = normalizeRedirectPath(requestPath);
  return from !== null && from === normalizeRedirectPath(to);
}

function toHit(to: unknown, status: unknown): RedirectHit | null {
  if (!isSafeRedirectTarget(to)) return null;
  const code = typeof status === 'number' && REDIRECT_STATUSES.has(status) ? status : 301;
  return { to, status: code };
}

// ── Fetching and caching ─────────────────────────────────────────────────────

type StoreRedirects =
  | { mode: 'map'; map: Map<string, RedirectHit> }
  | { mode: 'lookup' }
  | { mode: 'none' }; // fetch failed or unversioned: fail open until the entry expires (FAILURE_TTL_MS)

type CacheEntry<T> = { value: T; expiresAt: number };

const MAP_TTL_MS = 10 * 60_000;
const FAILURE_TTL_MS = 10_000;
const MAP_CACHE_MAX = 200;
const LOOKUP_TTL_MS = 10 * 60_000;
const LOOKUP_MISS_TTL_MS = 60_000;
const LOOKUP_CACHE_MAX = 2_000;
const FETCH_TIMEOUT_MS = 2_000;

const mapCache = new Map<string, CacheEntry<StoreRedirects>>();
const inflight = new Map<string, Promise<StoreRedirects>>();
const lookupCache = new Map<string, CacheEntry<RedirectHit | null>>();

/** Map get with LRU touch and TTL expiry. */
function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string, now: number): CacheEntry<T> | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  cache.delete(key);
  if (entry.expiresAt <= now) return undefined;
  cache.set(key, entry);
  return entry;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, entry: CacheEntry<T>, max: number): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

/** Header carrying the shared proxy key (API `redirect-proxy-key.ts`). */
export const PROXY_KEY_HEADER = 'x-proxy-key';

/**
 * Headers of the map/resolve calls. With `REDIRECTS_PROXY_KEY` set (same value
 * on the API) the API lifts its per-IP throttle for the proxy, whose few IPs
 * carry every storefront request. The variable is server-only: it has no
 * `NEXT_PUBLIC_` prefix, so it is never inlined into a client bundle, and it
 * is read at request time in the proxy (Node.js runtime).
 */
export function redirectFetchHeaders(): Record<string, string> | undefined {
  const key = process.env.REDIRECTS_PROXY_KEY;
  return key ? { [PROXY_KEY_HEADER]: key } : undefined;
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = redirectFetchHeaders();
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal, ...(headers ? { headers } : {}) });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    // API wraps responses as { success, data, timestamp }; accept bare too.
    const body = (await res.json()) as { data?: unknown } | null;
    const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
    return { ok: true, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function loadStoreRedirects(slug: string, version: string): Promise<StoreRedirects> {
  try {
    const { ok, data } = await fetchJson(
      `${apiBase()}/stores/${encodeURIComponent(slug)}/redirects?v=${encodeURIComponent(version)}`,
    );
    if (!ok || !data || typeof data !== 'object') return { mode: 'none' };
    const body = data as { version?: unknown; mode?: unknown; items?: unknown };
    // The proxy only asks when the host lookup reported a version, so an
    // answer without one is not "no redirects": it is a failed or stale
    // answer and must expire after the short failure TTL, never after the
    // 10-minute map TTL (the API answers 503 on a DB error, but an older API
    // or a wrapped error could still deliver `version: null`).
    if (typeof body.version !== 'string' || !body.version) return { mode: 'none' };
    if (body.mode === 'lookup') return { mode: 'lookup' };
    if (body.mode !== 'map' || !Array.isArray(body.items)) return { mode: 'none' };
    const map = new Map<string, RedirectHit>();
    for (const item of body.items) {
      if (!Array.isArray(item)) continue;
      const key = typeof item[0] === 'string' ? normalizeRedirectPath(item[0]) : null;
      const hit = toHit(item[1], item[2]);
      if (key !== null && hit && !map.has(key)) map.set(key, hit);
    }
    return { mode: 'map', map };
  } catch {
    return { mode: 'none' };
  }
}

async function storeRedirects(slug: string, version: string): Promise<StoreRedirects> {
  const key = `${slug}@${version}`;
  const now = Date.now();
  const cached = cacheGet(mapCache, key, now);
  if (cached) return cached.value;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = loadStoreRedirects(slug, version)
    .then((value) => {
      const ttl = value.mode === 'none' ? FAILURE_TTL_MS : MAP_TTL_MS;
      cacheSet(mapCache, key, { value, expiresAt: Date.now() + ttl }, MAP_CACHE_MAX);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function lookupRedirect(slug: string, version: string, pathname: string): Promise<RedirectHit | null> {
  const normalized = normalizeRedirectPath(pathname);
  if (normalized === null) return null;
  const key = `${slug}@${version}|${normalized}`;
  const now = Date.now();
  const cached = cacheGet(lookupCache, key, now);
  if (cached) return cached.value;
  try {
    const { ok, status, data } = await fetchJson(
      `${apiBase()}/stores/${encodeURIComponent(slug)}/redirects/resolve?path=${encodeURIComponent(normalized)}`,
    );
    let hit: RedirectHit | null = null;
    if (ok && data && typeof data === 'object') {
      const body = data as { to?: unknown; status?: unknown };
      hit = toHit(body.to, body.status);
    } else if (status !== 404) {
      // Server error: fail open without caching a definitive miss.
      return null;
    }
    cacheSet(
      lookupCache,
      key,
      { value: hit, expiresAt: now + (hit ? LOOKUP_TTL_MS : LOOKUP_MISS_TTL_MS) },
      LOOKUP_CACHE_MAX,
    );
    return hit;
  } catch {
    return null;
  }
}

/**
 * Redirect for a storefront request path, or null. Never throws. `version`
 * is the store's `redirects_version`; callers must skip the call when it is
 * absent so stores without redirects make no extra request.
 */
export async function matchStoreRedirect(
  slug: string,
  version: string,
  pathname: string,
): Promise<RedirectHit | null> {
  try {
    if (!slug || !version) return null;
    const redirects = await storeRedirects(slug, version);
    let hit: RedirectHit | null = null;
    if (redirects.mode === 'map') hit = matchRedirectMap(redirects.map, pathname);
    else if (redirects.mode === 'lookup') hit = await lookupRedirect(slug, version, pathname);
    if (!hit || isSelfRedirect(pathname, hit.to)) return null;
    return hit;
  } catch {
    return null;
  }
}

/** Test hook: drop every cached map and lookup. */
export function __resetRedirectCaches(): void {
  mapCache.clear();
  inflight.clear();
  lookupCache.clear();
}
