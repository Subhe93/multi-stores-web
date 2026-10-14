// ── Guest cart hand-off between market domains (M1-DESIGN D10 / L9) ──────────
// A guest's cart lives in localStorage, which does not cross origins. When the
// country switcher sends a visitor from namez.se to namez.shop, the lines are
// encoded into a size-capped base64url `?c=` query parameter; the landing
// CartProvider decodes it, merges the lines into the local cart and re-prices
// them through `POST /orders/quote` for the new market. Logged-in customers
// need nothing: the server cart is per customer and re-priced on fetch.

import type { CartItem } from '@/hooks/useCart';

/** Query parameter carrying the encoded cart. */
export const CART_HANDOFF_PARAM = 'c';
/** Query parameter carrying how many lines the sender had to drop (L9). */
export const CART_HANDOFF_DROPPED_PARAM = 'cd';
/** Upper bound of the encoded payload (L9). */
export const CART_HANDOFF_MAX_BYTES = 4096;

/** Compact wire form of one guest line (short keys keep the payload small). */
export interface HandoffLine {
  /** product id (own products) */
  p?: string;
  /** custom product id */
  c?: string;
  /** variant id */
  v?: string;
  /** bundle offer id */
  b?: string;
  /** quantity */
  q: number;
  /** custom fields */
  f?: Record<string, unknown>;
  /** title (display only — price comes from the quote) */
  t?: string;
  /** image url */
  i?: string;
  /** variant label */
  l?: string;
}

function toBase64Url(utf8: string): string {
  const bytes = new TextEncoder().encode(utf8);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function toHandoffLine(item: CartItem): HandoffLine {
  const line: HandoffLine = { q: item.quantity };
  if (item.customProductId) line.c = item.customProductId;
  else if (item.productId) line.p = item.productId;
  if (item.variantId) line.v = item.variantId;
  if (item.bundleOfferId) line.b = item.bundleOfferId;
  if (item.customFields && Object.keys(item.customFields).length > 0) line.f = item.customFields;
  const title = item.title || item.name;
  if (title) line.t = title.slice(0, 120);
  const image = item.imageUrl || item.image;
  if (image) line.i = image;
  if (item.variant) line.l = item.variant.slice(0, 80);
  return line;
}

/**
 * Encode guest lines for the `?c=` parameter. Lines are dropped from the end
 * until the payload fits the cap; `dropped` tells the UI how many were lost.
 * Returns `param: null` when nothing fits (or the cart is empty).
 */
export function encodeGuestCart(items: CartItem[]): { param: string | null; dropped: number } {
  const lines = items.map(toHandoffLine);
  let keep = lines.length;
  while (keep > 0) {
    const encoded = toBase64Url(JSON.stringify(lines.slice(0, keep)));
    if (encoded.length <= CART_HANDOFF_MAX_BYTES) {
      return { param: encoded, dropped: lines.length - keep };
    }
    keep -= 1;
  }
  return { param: null, dropped: lines.length };
}

// Field caps for decoded lines — the payload comes from a URL anyone can
// craft, so every field is validated and anything out of shape is dropped.
const ID_MAX = 64;
const TITLE_MAX = 120;
const LABEL_MAX = 80;
const IMAGE_MAX = 2048;
const QTY_MAX = 999;
const FIELDS_MAX_KEYS = 50;
const FIELD_KEY_MAX = 64;
const FIELD_VALUE_MAX = 2048;
const MAX_LINES = 100;

function optString(value: unknown, max: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return null;
  return value;
}

function isSafeImageUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value) || (value.startsWith('/') && !value.startsWith('//'));
}

// Depth-1 plain object with string / number / boolean values only.
function sanitizeCustomFields(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key.length === 0 || key.length > FIELD_KEY_MAX || key === '__proto__') continue;
    if (typeof v === 'string') {
      if (v.length > FIELD_VALUE_MAX) continue;
      out[key] = v;
    } else if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') {
      out[key] = v;
    } else {
      continue;
    }
    if (++count >= FIELDS_MAX_KEYS) break;
  }
  return count > 0 ? out : undefined;
}

/** Validate one decoded line; null when it must be dropped. */
export function sanitizeHandoffLine(raw: unknown): HandoffLine | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const q = r.q;
  if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > QTY_MAX) return null;
  const p = optString(r.p, ID_MAX);
  const c = optString(r.c, ID_MAX);
  const v = optString(r.v, ID_MAX);
  const b = optString(r.b, ID_MAX);
  const t = optString(r.t, TITLE_MAX);
  const l = optString(r.l, LABEL_MAX);
  if (p === null || c === null || v === null || b === null || t === null || l === null) return null;
  if (!p && !c) return null;
  const line: HandoffLine = { q };
  if (c) line.c = c;
  else if (p) line.p = p;
  if (v) line.v = v;
  if (b) line.b = b;
  if (t) line.t = t;
  if (l) line.l = l;
  if (typeof r.i === 'string' && r.i.length <= IMAGE_MAX && isSafeImageUrl(r.i)) line.i = r.i;
  const f = sanitizeCustomFields(r.f);
  if (f) line.f = f;
  return line;
}

/** Decode a `?c=` value; malformed input yields `[]`, malformed lines are dropped. */
export function decodeGuestCart(param: string | null | undefined): HandoffLine[] {
  if (!param || param.length > CART_HANDOFF_MAX_BYTES) return [];
  const json = fromBase64Url(param);
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, MAX_LINES)
      .map(sanitizeHandoffLine)
      .filter((l): l is HandoffLine => l !== null);
  } catch {
    return [];
  }
}

/** Append `?c=` (and `cd=` when lines were dropped) to an absolute or relative URL. */
export function appendHandoffParam(url: string, param: string | null, dropped = 0): string {
  if (!param && dropped <= 0) return url;
  const parts: string[] = [];
  if (param) parts.push(`${CART_HANDOFF_PARAM}=${param}`);
  if (dropped > 0) parts.push(`${CART_HANDOFF_DROPPED_PARAM}=${Math.min(dropped, MAX_LINES)}`);
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${parts.join('&')}`;
}
