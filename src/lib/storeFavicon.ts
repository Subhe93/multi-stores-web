// Store favicon routing (pure helpers, shared by the proxy and its tests).
//
// The platform icon lives at `public/favicon.ico` and is linked explicitly by
// the root layout. A store host must not serve it when the store uploaded
// its own favicon, so the proxy rewrites `GET /favicon.ico` on a store host
// to the store route `src/app/store/[storeSlug]/favicon.ico/route.ts`.

export const FAVICON_PATH = '/favicon.ico';

/**
 * Internal path a `/favicon.ico` request is rewritten to, or null when the
 * request passes through to the static platform file (platform host, or any
 * other path).
 */
export function storeFaviconRewritePath(pathname: string, storeSlug: string | null): string | null {
  if (pathname !== FAVICON_PATH || !storeSlug) return null;
  return `/store/${storeSlug}${FAVICON_PATH}`;
}
