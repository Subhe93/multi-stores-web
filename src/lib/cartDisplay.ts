// ── Guest cart titles in the page locale (M160) ─────────────────────────────
// Guest lines keep the title / variant label of the page they were added on.
// One cart is shared by every locale of a host, so the storefront asks
// `POST /storefront/:slug/cart-display` for fresh text and lays it over the
// stored lines for display only. Stored lines are never rewritten (old carts
// keep working, two tabs in different languages never overwrite each other)
// and the ids sent to quote / order are untouched.

import type { CartItem } from '@/hooks/useCart';

/** Display text of one line in a locale. */
export interface CartDisplayEntry {
  title: string | null;
  variant: string | null;
}

/** Max lines per request (the API's `ArrayMaxSize`). */
export const CART_DISPLAY_MAX_LINES = 50;

type DisplayLine = Pick<CartItem, 'productId' | 'variantId' | 'customProductId' | 'displayLocale'>;

/** Display identity of a line: product (or custom product) + variant. */
export function displayKey(item: Pick<CartItem, 'productId' | 'variantId' | 'customProductId'>): string {
  const base = item.customProductId ? `cp:${item.customProductId}` : `p:${item.productId}`;
  return `${base}|${item.variantId ?? ''}`;
}

/**
 * Lines whose stored text may be in another language: no `displayLocale`
 * (carts from before M160, hand-off lines) or a different one. Deduped by
 * display key; lines without a product id are skipped.
 */
export function staleLines<T extends DisplayLine>(items: readonly T[], locale: string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (item.displayLocale === locale) continue;
    if (!item.customProductId && !item.productId) continue;
    const key = displayKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Body of one `cart-display` request (at most `CART_DISPLAY_MAX_LINES` lines). */
export function buildCartDisplayBody(lines: readonly DisplayLine[], locale: string) {
  return {
    locale,
    lines: lines.slice(0, CART_DISPLAY_MAX_LINES).map((l) => ({
      ...(l.customProductId ? { custom_product_id: l.customProductId } : { product_id: l.productId }),
      ...(l.variantId ? { variant_id: l.variantId } : {}),
    })),
  };
}

const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** `{ items }` of the answer, one entry (or null) per requested line. */
export function normalizeCartDisplay(raw: unknown, n: number): (CartDisplayEntry | null)[] {
  const items = raw && typeof raw === 'object' ? (raw as { items?: unknown }).items : undefined;
  const list = Array.isArray(items) ? items : [];
  return Array.from({ length: n }, (_, i) => {
    const e = list[i];
    if (!e || typeof e !== 'object') return null;
    const r = e as { title?: unknown; variant?: unknown };
    return { title: textOrNull(r.title), variant: textOrNull(r.variant) };
  });
}

/**
 * Lines with fresh text applied: the title when the entry has one, the
 * variant label only on a line with a variant. Anything missing keeps the
 * stored text. Returns `items` itself when nothing changes.
 *
 * Known limit (M160): only `title` and `variant` are re-localized.
 * `customFieldDisplay` (personalization field labels) and the bundle
 * `bundleTitle` / `bundleLabel` stay in the language the line was added in;
 * re-localizing them needs the field definitions and bundle offer
 * translations by id (follow-up). Display only: requests use ids.
 */
export function applyCartDisplay<T extends CartItem>(
  items: T[],
  lookup: (key: string) => CartDisplayEntry | null | undefined,
): T[] {
  let changed = false;
  const next = items.map((item) => {
    const entry = lookup(displayKey(item));
    if (!entry) return item;
    const title = entry.title && entry.title !== item.title ? entry.title : null;
    const variant = item.variantId && entry.variant && entry.variant !== item.variant ? entry.variant : null;
    if (!title && !variant) return item;
    changed = true;
    return { ...item, ...(title ? { title } : {}), ...(variant ? { variant } : {}) };
  });
  return changed ? next : items;
}

// ── Cache (memory + sessionStorage) ─────────────────────────────────────────
// Successful entries are mirrored to sessionStorage so an old or mixed-locale
// cart costs at most one request per locale per tab session. Null entries
// (unknown product) stay in memory only.

const memory = new Map<string, CartDisplayEntry | null>();
const loadedSessions = new Set<string>();

const sessionKey = (slug: string, locale: string) => `cart_display:${slug}:${locale}`;
const memoryKey = (slug: string, locale: string, key: string) => `${slug}|${locale}|${key}`;

function sessionStore(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function loadSession(slug: string, locale: string): void {
  const sk = sessionKey(slug, locale);
  if (loadedSessions.has(sk)) return;
  loadedSessions.add(sk);
  try {
    const raw = sessionStore()?.getItem(sk);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const [entry] = normalizeCartDisplay({ items: [value] }, 1);
      const mk = memoryKey(slug, locale, key);
      if (entry && !memory.has(mk)) memory.set(mk, entry);
    }
  } catch {
    // Unreadable storage: memory only.
  }
}

/** Cached entry: an entry, null (known: nothing to show) or undefined (not asked yet). */
export function readCachedDisplay(slug: string, locale: string, key: string): CartDisplayEntry | null | undefined {
  loadSession(slug, locale);
  return memory.get(memoryKey(slug, locale, key));
}

/** Stores answered entries; non-null ones also go to sessionStorage. */
export function writeCachedDisplay(slug: string, locale: string, entries: Record<string, CartDisplayEntry | null>): void {
  loadSession(slug, locale);
  for (const [key, entry] of Object.entries(entries)) memory.set(memoryKey(slug, locale, key), entry);
  try {
    const store = sessionStore();
    if (!store) return;
    const sk = sessionKey(slug, locale);
    const prev: unknown = JSON.parse(store.getItem(sk) || '{}');
    const merged: Record<string, CartDisplayEntry> =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...(prev as Record<string, CartDisplayEntry>) } : {};
    for (const [key, entry] of Object.entries(entries)) if (entry) merged[key] = entry;
    store.setItem(sk, JSON.stringify(merged));
  } catch {
    // Full / disabled storage: the memory cache still holds the entries.
  }
}

/** Test helper: forget every cached entry. */
export function resetCartDisplayCache(): void {
  memory.clear();
  loadedSessions.clear();
}
