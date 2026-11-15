// ── External site return (headless booking P3, PLAN §7) ──────────────────────
// A store with its own website (the custom site in front of a ShopsDoor
// booking store) can send the shopper back there after payment. The URLs come
// from `checkout_settings` (validated by the API on write and read); this file
// checks them a third time before anything is rendered, so a bad value can
// never turn the storefront into an open redirect (R-D4):
//   - https only, default port, no userinfo, a real DNS host name;
//   - `return_url` may carry `{order_number}` outside the host, nothing else;
//   - the `return_url` host equals the `external_site_url` host or its `www.`
//     twin (no registrable-domain fallback).
// Only the order number is ever substituted (R-D3): never PII, ids, tokens.

import type { CheckoutSettings } from './checkoutSettings';

export const ORDER_NUMBER_PLACEHOLDER = '{order_number}';
const MAX_EXTERNAL_URL_LENGTH = 500;
// Stand-in for the placeholder while the URL is parsed (braces would be
// percent-encoded by the WHATWG parser).
const PLACEHOLDER_SENTINEL = 'zzorderxnumberzz';
const PLACEHOLDER_RE = /\{[^{}]*\}/g;
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Seconds of the cancellable countdown in `auto` return mode (R-D2). */
export const AUTO_RETURN_SECONDS = 8;

export type ReturnMode = 'button' | 'auto';

function isDnsHostName(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (hostname.startsWith('[') || IPV4_RE.test(hostname)) return false;
  const labels = hostname.split('.');
  if (labels.length < 2) return false;
  if (/^\d+$/.test(labels[labels.length - 1]!)) return false;
  return labels.every((l) => HOST_LABEL_RE.test(l));
}

/**
 * Validates and normalizes an external URL; null when it breaks a rule.
 * With `allowPlaceholder` `{order_number}` may appear in the path, query or
 * fragment (and is kept as is in the result).
 */
export function parseExternalUrl(raw: unknown, allowPlaceholder = false): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_EXTERNAL_URL_LENGTH) return null;
  if (/[\s\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (!/^https:\/\//i.test(value)) return null;
  if (value.toLowerCase().includes(PLACEHOLDER_SENTINEL)) return null;
  const authority = value.slice('https://'.length).split(/[/?#]/, 1)[0]!;
  if (/[{}@]/.test(authority)) return null;
  for (const token of value.match(PLACEHOLDER_RE) ?? []) {
    if (!allowPlaceholder || token !== ORDER_NUMBER_PLACEHOLDER) return null;
  }
  const swapped = value.split(ORDER_NUMBER_PLACEHOLDER).join(PLACEHOLDER_SENTINEL);
  if (/[{}]/.test(swapped)) return null;
  let url: URL;
  try {
    url = new URL(swapped);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (!isDnsHostName(url.hostname)) return null;
  return url.href.split(PLACEHOLDER_SENTINEL).join(ORDER_NUMBER_PLACEHOLDER);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url.split(ORDER_NUMBER_PLACEHOLDER).join(PLACEHOLDER_SENTINEL)).hostname;
  } catch {
    return null;
  }
}

/** The external site host and its `www.` twin; empty without a valid site. */
export function externalSiteHosts(siteUrl: string | null | undefined): string[] {
  const site = parseExternalUrl(siteUrl);
  if (!site) return [];
  const host = hostOf(site);
  if (!host) return [];
  const twin = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  return isDnsHostName(twin) ? [host, twin] : [host];
}

/** True when `url` points at the external site host (or its `www.` twin). */
export function isExternalHostAllowed(url: string, siteUrl: string | null | undefined): boolean {
  const host = hostOf(url);
  return host !== null && externalSiteHosts(siteUrl).includes(host);
}

type ExternalSettings = Pick<CheckoutSettings, 'external_site_url' | 'return_url' | 'return_mode' | 'back_label'>;

/** The validated external site URL of the store, or null (no external site). */
export function externalSiteUrl(settings: ExternalSettings | null | undefined): string | null {
  return parseExternalUrl(settings?.external_site_url);
}

/**
 * The host shown to the shopper ("Back to primatrafikskola.se"): the site
 * host without a leading `www.`. Null without an external site.
 */
export function externalSiteHost(settings: ExternalSettings | null | undefined): string | null {
  const site = externalSiteUrl(settings);
  const host = site ? hostOf(site) : null;
  if (!host) return null;
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Where "back to site" goes after payment: `return_url` with the order number
 * substituted (URL-encoded), else the site URL. Null without a valid external
 * site, or when the result fails the host check. A template that needs the
 * order number falls back to the site URL when the number is not known.
 */
export function buildExternalReturnUrl(
  settings: ExternalSettings | null | undefined,
  orderNumber: string | null | undefined,
): string | null {
  const site = externalSiteUrl(settings);
  if (!site) return null;
  const template = parseExternalUrl(settings?.return_url, true);
  if (!template || !isExternalHostAllowed(template, site)) return site;
  const number = typeof orderNumber === 'string' ? orderNumber.trim() : '';
  if (template.includes(ORDER_NUMBER_PLACEHOLDER)) {
    if (!number) return site;
    const built = template.split(ORDER_NUMBER_PLACEHOLDER).join(encodeURIComponent(number));
    const checked = parseExternalUrl(built);
    return checked && isExternalHostAllowed(checked, site) ? checked : site;
  }
  return template;
}

/**
 * The merchant's "back to site" label for `locale` (regional tag falls back
 * to its language, never to another language); null = translated default.
 */
export function resolveBackLabel(settings: ExternalSettings | null | undefined, locale: string): string | null {
  const labels = settings?.back_label;
  if (!labels || !externalSiteUrl(settings)) return null;
  const exact = labels[locale];
  if (exact) return exact;
  return labels[locale.split('-')[0]!] || null;
}

/** `auto` only when an external site is set; `button` otherwise. */
export function resolveReturnMode(settings: ExternalSettings | null | undefined): ReturnMode {
  return externalSiteUrl(settings) && settings?.return_mode === 'auto' ? 'auto' : 'button';
}

/**
 * Props for a "continue shopping" style link: the external site (with
 * `rel="noreferrer"`) when the store has one, else `fallback` unchanged and
 * no `rel`, so stores without the setting render exactly as before.
 */
export function continueShoppingLink(
  settings: ExternalSettings | null | undefined,
  fallback: string,
): { href: string; rel?: string } {
  const site = externalSiteUrl(settings);
  return site ? { href: site, rel: 'noreferrer' } : { href: fallback };
}

/** Normalizes the external-site keys of a storefront `checkout` block. */
export function normalizeExternalReturn(raw: Record<string, unknown>): ExternalSettings | null {
  const site = parseExternalUrl(raw.external_site_url);
  if (!site) return null;
  const ret = parseExternalUrl(raw.return_url, true);
  let backLabel: Record<string, string> | null = null;
  if (raw.back_label && typeof raw.back_label === 'object' && !Array.isArray(raw.back_label)) {
    const labels: Record<string, string> = {};
    for (const [locale, label] of Object.entries(raw.back_label as Record<string, unknown>)) {
      if (typeof label === 'string' && label.trim()) labels[locale] = label.trim();
    }
    if (Object.keys(labels).length) backLabel = labels;
  }
  return {
    external_site_url: site,
    return_url: ret && isExternalHostAllowed(ret, site) ? ret : null,
    return_mode: raw.return_mode === 'auto' ? 'auto' : 'button',
    back_label: backLabel,
  };
}
