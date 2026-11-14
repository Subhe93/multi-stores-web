// Consent log (plans/consent-v2/CONTRACT.md §5): proof of the visitor's
// cookie decisions (GDPR art. 7(1)). Only decisions are sent, never page
// views; the payload carries the anonymous consent id from the visitor's
// storage, the categories, the vendors offered and a SHA-256 hash of the
// text the visitor acted on. The API truncates the IP and hashes the UA.
//
// Fire-and-forget: `keepalive` lets the request survive the page reload that
// follows a withdrawal, errors are swallowed and storage writes never wait
// on the network.

import { API_URL } from './api';
import { CONSENT_PURPOSE_VERSION, storeVendors, type ConsentDecisionMeta, type ConsentRecord, type StoreTracking } from './consent';

export type ConsentAction =
  | 'accept_all'
  | 'reject_all'
  | 'save'
  | 'external_media_grant'
  | 'external_media_revoke'
  | 'migrated';
export type ConsentSource = 'banner' | 'dialog' | 'facade' | 'migration';

/** Random UUID v4 (crypto.randomUUID, with a getRandomValues fallback for older browsers). */
export function randomUuid(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The text that informs the decision: every `[data-consent-text]` element
 * inside `root` (and root itself), outermost only, with whitespace collapsed,
 * joined by "\n".
 */
export function consentText(root: Element | null): string {
  if (!root) return '';
  const nodes: Element[] = [];
  if (root.hasAttribute('data-consent-text')) nodes.push(root);
  root.querySelectorAll('[data-consent-text]').forEach((el) => {
    // A marked ancestor already includes this element's text.
    const parent = el.parentElement?.closest('[data-consent-text]');
    if (parent && (parent === root || root.contains(parent))) return;
    nodes.push(el);
  });
  return nodes
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** sha256 hex of the rendered consent text (§5.4); 'unavailable' when crypto.subtle is missing. */
export async function consentTextHash(root: Element | null): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !root) return 'unavailable';
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(consentText(root)));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unavailable';
  }
}

const TEXT_HASH_RE = /^([a-f0-9]{64}|legacy|unavailable|facade)$/;

/** `sv`, `en-GB`, … in the API's `^[a-z]{2}(-[A-Z]{2})?$` shape; 'en' when unusable. */
export function normalizeConsentLocale(locale: string | null | undefined): string {
  const m = /^([a-zA-Z]{2})(?:[-_]([a-zA-Z]{2}))?(?:$|[-_])/.exec((locale ?? '').trim());
  if (!m) return 'en';
  return m[2] ? `${m[1].toLowerCase()}-${m[2].toUpperCase()}` : m[1].toLowerCase();
}

export interface ConsentLogPayload {
  event_id: string;
  consent_id: string;
  action: ConsentAction;
  source: ConsentSource;
  analytics: boolean | null;
  marketing: boolean | null;
  external_media: boolean | null;
  consent_version: string;
  vendors: string[];
  text_hash: string;
  locale: string;
}

/** The POST body for one decision (§5.2). null = category not offered / not decided. */
export function consentLogPayload(
  rec: ConsentRecord,
  meta: ConsentDecisionMeta,
  t: StoreTracking | null | undefined,
): ConsentLogPayload {
  const offered = storeVendors(t);
  const tr = rec.tracking;
  return {
    event_id: randomUuid(),
    consent_id: rec.id,
    action: meta.action,
    source: meta.source,
    analytics: tr && offered.analytics.length > 0 ? tr.analytics : null,
    marketing: tr && offered.marketing.length > 0 ? tr.marketing : null,
    external_media: rec.external ? rec.external.granted : null,
    consent_version: String(CONSENT_PURPOSE_VERSION),
    vendors: tr ? Array.from(new Set(tr.vendors)).slice(0, 4) : [],
    text_hash: TEXT_HASH_RE.test(meta.textHash) ? meta.textHash : 'unavailable',
    locale: normalizeConsentLocale(meta.locale),
  };
}

/** Sends one decision to `POST /storefront/:slug/consent`; never throws, never awaited. */
export function logConsent(
  slug: string,
  rec: ConsentRecord,
  meta: ConsentDecisionMeta,
  t: StoreTracking | null | undefined,
): void {
  try {
    if (typeof fetch !== 'function' || !slug) return;
    const body = JSON.stringify(consentLogPayload(rec, meta, t));
    void fetch(`${API_URL}/storefront/${encodeURIComponent(slug)}/consent`, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      // Logging is best effort: the visitor's choice is already stored.
    });
  } catch {
    // Same: never let logging break the consent flow.
  }
}
