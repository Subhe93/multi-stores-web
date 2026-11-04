'use client';

import { useEffect, useState } from 'react';

/**
 * Token from the URL fragment (`#token=`, current emails: never sent to the
 * server, so it stays out of access logs, CDN logs and Referer headers) or
 * the query string (`?token=`, links mailed before the switch).
 */
export function readUrlToken(): string | null {
  try {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    return fromHash || new URLSearchParams(window.location.search).get('token');
  } catch {
    return null;
  }
}

/** Remove `token` from the address bar (query and fragment) so it does not
 *  linger in history, bookmarks or a shared screenshot. Other params stay. */
export function stripTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const inHash = hash.has('token');
    if (!url.searchParams.has('token') && !inHash) return;
    url.searchParams.delete('token');
    hash.delete('token');
    const rest = hash.toString();
    const fragment = inHash ? (rest ? `#${rest}` : '') : url.hash;
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${fragment}`);
  } catch { /* non-fatal */ }
}

/**
 * The emailed token of this page, read once after mount and then removed
 * from the address bar. `undefined` until read (render nothing decisive yet),
 * then the token or null.
 */
export function useUrlToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const value = readUrlToken();
    stripTokenFromUrl();
    // Reading window state has to wait for the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(value);
  }, []);
  return token;
}
