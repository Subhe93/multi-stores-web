// First-party vendor cookies cleared when a category is withdrawn
// (plans/consent-v2/CONTRACT.md §7.1). Each cookie is deleted on the current
// host (host-only) and on every parent domain down to the registrable one,
// because GA4 and the pixels set theirs on the top domain (`.namez.se`).
// Third-party cookies (YouTube, Microsoft MUID/CLID) cannot be erased from
// here; the cookie page tells the visitor so.

import type { TrackerVendor } from '@/lib/consent';

/**
 * Cookie groups: the tracker vendors, plus `google_ads` for Google's ad
 * cookies (`_gcl_*`, conversion linker). GA4 writes those only while
 * ad_storage is granted, i.e. under the marketing category, so they are
 * cleared when marketing is withdrawn even if GA4 keeps running under
 * analytics.
 */
export type CookieGroup = TrackerVendor | 'google_ads';

/** Exact names or `prefix*` patterns per group. */
const VENDOR_COOKIES: Record<CookieGroup, readonly string[]> = {
  ga4: ['_ga', '_ga_*', '_gid', '_gat*'],
  google_ads: ['_gcl_*'],
  clarity: ['_clck', '_clsk'],
  meta: ['_fbp', '_fbc'],
  tiktok: ['_ttp', '_tt_enable_cookie', 'ttcsid*'],
};

/** Clarity also keeps its ids in localStorage. */
const CLARITY_STORAGE = /^_cl(ck|sk|tk)/;

function matches(name: string, pattern: string): boolean {
  return pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

/** Cookie names (of the given groups) to clear among `names`. */
export function vendorCookieNames(names: readonly string[], vendors: readonly CookieGroup[]): string[] {
  const patterns = vendors.flatMap((v) => VENDOR_COOKIES[v]);
  return names.filter((n) => patterns.some((p) => matches(n, p)));
}

/**
 * Domain attributes to delete a cookie with: '' = host-only, then the host
 * and every parent domain with at least two labels (`www.namez.se` ->
 * ['', 'www.namez.se', 'namez.se']). IPs and single-label hosts (localhost)
 * only get the host-only deletion.
 */
export function cookieDomains(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return [''];
  const parts = host.split('.');
  const out = [''];
  for (let i = 0; i <= parts.length - 2; i++) out.push(parts.slice(i).join('.'));
  return out;
}

function currentCookieNames(): string[] {
  if (typeof document === 'undefined' || !document.cookie) return [];
  return document.cookie
    .split(';')
    .map((c) => c.split('=')[0]?.trim() ?? '')
    .filter(Boolean);
}

/** Deletes the first-party cookies (and Clarity storage) of the given groups. */
export function clearVendorCookies(vendors: readonly CookieGroup[]): void {
  if (typeof document === 'undefined' || vendors.length === 0) return;
  const names = vendorCookieNames(currentCookieNames(), vendors);
  const domains = cookieDomains(window.location.hostname);
  for (const name of names) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
    }
  }
  if (vendors.includes('clarity')) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && CLARITY_STORAGE.test(k)) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Storage blocked: nothing stored there.
    }
  }
}
