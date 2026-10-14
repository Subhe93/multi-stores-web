// ── Buyer type (plans/namez-store-apps/M2-DESIGN.md D1 / §4.1) ───────────────
// Whether the shopper browses as a private person or a company. It is a
// request-level signal, not a store setting: the storefront keeps it in the
// `ms-buyer-type` cookie, seeds the provider from it on the server (the store
// layout already reads `cookies()`), and sends it to the API as
// `?buyer=company` on GET /cart and `buyer_type` in quote / order / Kustom
// session bodies. Only stores with the `b2b` app read or write the cookie.
//
// Pure module (no React, no `next/*`) — shared by the server layout, client
// hooks and vitest.

import type { B2bSettings } from './b2bSettings';

export type BuyerType = 'person' | 'company';

export const BUYER_COOKIE = 'ms-buyer-type';
/** One year, in seconds. */
export const BUYER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** `'person' | 'company'` from a raw cookie value; null for anything else. */
export function parseBuyerType(raw: unknown): BuyerType | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  return value === 'person' || value === 'company' ? value : null;
}

/** `'COMPANY'` / `'PERSON'` (API spelling) from the storefront value. */
export function toApiBuyerType(value: BuyerType): 'PERSON' | 'COMPANY' {
  return value === 'company' ? 'COMPANY' : 'PERSON';
}

/**
 * The view a request starts in: the cookie wins, else the app's
 * `default_buyer_type`, else person. `company` is only ever returned when the
 * settings allow company purchases.
 */
export function resolveInitialBuyerType({
  cookie,
  settings,
}: {
  cookie?: string | null;
  settings?: Pick<B2bSettings, 'allow_company' | 'default_buyer_type'> | null;
}): BuyerType {
  const allowCompany = settings ? settings.allow_company !== false : true;
  const fromCookie = parseBuyerType(cookie);
  const resolved: BuyerType =
    fromCookie ?? (settings?.default_buyer_type === 'COMPANY' ? 'company' : 'person');
  return resolved === 'company' && !allowCompany ? 'person' : resolved;
}

/** `document.cookie` assignment string for the buyer-type cookie. */
export function buyerCookieString(value: BuyerType): string {
  return `${BUYER_COOKIE}=${value}; Path=/; Max-Age=${BUYER_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Read the buyer-type cookie out of a `document.cookie` string. */
export function readBuyerCookie(cookieHeader: string | null | undefined): BuyerType | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.split('=');
    if (name?.trim() === BUYER_COOKIE) return parseBuyerType(rest.join('='));
  }
  return null;
}
