// Ecommerce events for the vendor tags (GA4, Meta Pixel, TikTok Pixel).
//
// The vendor globals (`window.fbq` / `gtag` / `ttq`) exist only once
// <TrackingScripts> mounted them, i.e. the store has the tracker configured
// and the visitor's consent allows it. Every function here calls a vendor
// only when its global is present, never throws and is a no-op on the server.
//
// Amounts are major currency units; `value` is what the customer pays for
// the goods as the cart / order already exposes it (no tax math here).

import { getActiveTrackers, isMetaPixelActive } from '@/lib/consent';

type VendorFn = (...args: unknown[]) => void;

export interface TrackItem {
  productId: string;
  quantity: number;
  /** Unit price. */
  price?: number;
  name?: string;
}

export interface AddToCartEvent {
  productId: string;
  name?: string;
  /** Unit price × quantity. */
  value: number;
  currency: string;
  quantity: number;
}

export interface InitiateCheckoutEvent {
  value: number;
  currency: string;
  items: TrackItem[];
}

export interface PurchaseEvent {
  /** Order uuid — also the Meta event id (see `purchaseEventId`). */
  orderId: string;
  value: number;
  currency: string;
  items: TrackItem[];
}

interface Vendors {
  fbq: VendorFn | null;
  gtag: VendorFn | null;
  ttqTrack: VendorFn | null;
}

function vendors(): Vendors {
  if (typeof window === 'undefined') return { fbq: null, gtag: null, ttqTrack: null };
  // A vendor counts only while its tag is mounted for this store: the
  // globals survive a consent withdrawal and a client navigation to another
  // store, and must not receive events then.
  const active = getActiveTrackers();
  const ttq = window.ttq;
  return {
    fbq: active.meta && typeof window.fbq === 'function' ? window.fbq : null,
    gtag: active.ga4 && typeof window.gtag === 'function' ? window.gtag : null,
    ttqTrack: active.tiktok && ttq && typeof ttq.track === 'function' ? (...args: unknown[]) => ttq.track!(...(args as [string, Record<string, unknown>?])) : null,
  };
}

function hasVendor(v: Vendors): boolean {
  return Boolean(v.fbq || v.gtag || v.ttqTrack);
}

/** A vendor tag that throws must never break the storefront. */
function safely(call: () => void): void {
  try {
    call();
  } catch {
    // Ignored on purpose: tracking is best effort.
  }
}

function money(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function code(currency: string): string {
  return String(currency || '').trim().toUpperCase();
}

function totalQuantity(items: TrackItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function metaContents(items: TrackItem[]) {
  return items.map((item) => ({
    id: item.productId,
    quantity: item.quantity,
    ...(typeof item.price === 'number' ? { item_price: money(item.price) } : {}),
  }));
}

function ga4Items(items: TrackItem[]) {
  return items.map((item) => ({
    item_id: item.productId,
    ...(item.name ? { item_name: item.name } : {}),
    quantity: item.quantity,
    ...(typeof item.price === 'number' ? { price: money(item.price) } : {}),
  }));
}

function tiktokContents(items: TrackItem[]) {
  return items.map((item) => ({
    content_id: item.productId,
    content_type: 'product',
    ...(item.name ? { content_name: item.name } : {}),
    quantity: item.quantity,
    ...(typeof item.price === 'number' ? { price: money(item.price) } : {}),
  }));
}

/** The vendor snippets mount right after hydration: wait up to ~3 s for them. */
export const VENDOR_RETRY_DELAY_MS = 300;
export const VENDOR_MAX_RETRIES = 10;

/**
 * Run `fire` with the vendor tags as soon as at least one is present, polling
 * for ~3 s. A store without trackers / a visitor without consent never gets
 * one: `giveUp` (optional) runs instead and nothing is sent.
 */
function whenVendorsReady(fire: (v: Vendors) => void, giveUp?: () => void): void {
  if (typeof window === 'undefined') return;
  let attempts = 0;
  const attempt = () => {
    const v = vendors();
    if (hasVendor(v)) {
      fire(v);
      return;
    }
    if (attempts >= VENDOR_MAX_RETRIES) {
      giveUp?.();
      return;
    }
    attempts += 1;
    setTimeout(attempt, VENDOR_RETRY_DELAY_MS);
  };
  attempt();
}

// ── AddToCart ─────────────────────────────────────────────────────────────────

export function trackAddToCart(event: AddToCartEvent): void {
  const v = vendors();
  if (!hasVendor(v)) return;
  const value = money(event.value);
  const currency = code(event.currency);
  const quantity = event.quantity;
  const unitPrice = quantity > 0 ? money(event.value / quantity) : value;
  if (v.fbq) {
    safely(() =>
      v.fbq!('track', 'AddToCart', {
        content_ids: [event.productId],
        content_type: 'product',
        contents: [{ id: event.productId, quantity }],
        content_name: event.name,
        value,
        currency,
      }),
    );
  }
  if (v.gtag) {
    safely(() =>
      v.gtag!('event', 'add_to_cart', {
        currency,
        value,
        items: [{ item_id: event.productId, item_name: event.name, quantity, price: unitPrice }],
      }),
    );
  }
  if (v.ttqTrack) {
    safely(() =>
      v.ttqTrack!('AddToCart', {
        content_id: event.productId,
        content_type: 'product',
        content_name: event.name,
        quantity,
        value,
        currency,
      }),
    );
  }
}

// ── InitiateCheckout ──────────────────────────────────────────────────────────

/**
 * Report the start of a checkout. The checkout page can be the first page of
 * a visit (reload, return from the payment provider), so the vendor tags may
 * still be mounting: waits for them like `trackPurchase` does.
 */
export function trackInitiateCheckout(event: InitiateCheckoutEvent): void {
  whenVendorsReady((v) => fireInitiateCheckout(v, event));
}

function fireInitiateCheckout(v: Vendors, event: InitiateCheckoutEvent): void {
  const value = money(event.value);
  const currency = code(event.currency);
  const items = event.items;
  if (v.fbq) {
    safely(() =>
      v.fbq!('track', 'InitiateCheckout', {
        content_ids: items.map((item) => item.productId),
        content_type: 'product',
        contents: metaContents(items),
        num_items: totalQuantity(items),
        value,
        currency,
      }),
    );
  }
  if (v.gtag) {
    safely(() => v.gtag!('event', 'begin_checkout', { currency, value, items: ga4Items(items) }));
  }
  if (v.ttqTrack) {
    safely(() =>
      v.ttqTrack!('InitiateCheckout', { contents: tiktokContents(items), content_type: 'product', value, currency }),
    );
  }
}

// ── Purchase ──────────────────────────────────────────────────────────────────

/**
 * Meta event id of an order's Purchase. CONTRACT with the API: its
 * server-side Conversions API event uses the very same id, which is how Meta
 * deduplicates the browser and the server event. Keep `purchase_<order uuid>`.
 */
export function purchaseEventId(orderId: string): string {
  return `purchase_${orderId}`;
}

export function purchaseTrackedKey(orderId: string): string {
  return `ms:purchase-tracked:${orderId}`;
}


// Fallback guard when localStorage is blocked, and the orders whose retry
// loop is running (React strict effects call twice).
const trackedInMemory = new Set<string>();
const pendingPurchases = new Set<string>();

function purchaseAlreadyTracked(orderId: string): boolean {
  if (trackedInMemory.has(orderId)) return true;
  try {
    return window.localStorage.getItem(purchaseTrackedKey(orderId)) !== null;
  } catch {
    return false;
  }
}

function markPurchaseTracked(orderId: string): void {
  trackedInMemory.add(orderId);
  try {
    window.localStorage.setItem(purchaseTrackedKey(orderId), String(Date.now()));
  } catch {
    // Storage blocked: the in-memory set guards this page load.
  }
}

function firePurchase(v: Vendors, event: PurchaseEvent): void {
  const value = money(event.value);
  const currency = code(event.currency);
  const items = event.items;
  if (v.fbq) {
    safely(() =>
      v.fbq!(
        'track',
        'Purchase',
        {
          content_ids: items.map((item) => item.productId),
          content_type: 'product',
          contents: metaContents(items),
          num_items: totalQuantity(items),
          value,
          currency,
        },
        { eventID: purchaseEventId(event.orderId) },
      ),
    );
  }
  if (v.gtag) {
    safely(() =>
      v.gtag!('event', 'purchase', { transaction_id: event.orderId, currency, value, items: ga4Items(items) }),
    );
  }
  if (v.ttqTrack) {
    safely(() =>
      v.ttqTrack!('CompletePayment', { contents: tiktokContents(items), content_type: 'product', value, currency }),
    );
  }
}

/**
 * Report a placed order, at most once per order per browser. When no vendor
 * tag is present yet (still mounting after hydration) it retries for ~3 s;
 * a store without trackers / a visitor without consent never gets one, so
 * the attempt ends silently and leaves no guard behind.
 */
export function trackPurchase(event: PurchaseEvent): void {
  if (typeof window === 'undefined') return;
  const orderId = event.orderId;
  if (!orderId || pendingPurchases.has(orderId) || purchaseAlreadyTracked(orderId)) return;
  pendingPurchases.add(orderId);
  whenVendorsReady(
    (v) => {
      pendingPurchases.delete(orderId);
      if (purchaseAlreadyTracked(orderId)) return;
      // Guard first: a throwing vendor must not cause a second Purchase.
      markPurchaseTracked(orderId);
      firePurchase(v, event);
    },
    // No vendor will come: leave no guard behind.
    () => pendingPurchases.delete(orderId),
  );
}

/** The parts of an order (`GET /orders/:id`) a Purchase is built from. */
export interface TrackableOrder {
  id: string;
  total: number | string;
  currency?: string | null;
  items?: Array<{
    id: string;
    product_id?: string | null;
    custom_product_id?: string | null;
    quantity: number;
    unit_price: number | string;
  }> | null;
}

/** Purchase of a loaded order: its uuid, grand total, currency and lines. */
export function purchaseFromOrder(order: TrackableOrder, fallbackCurrency = 'EUR'): PurchaseEvent {
  return {
    orderId: order.id,
    value: Number(order.total) || 0,
    currency: order.currency || fallbackCurrency,
    items: (order.items ?? []).map((item) => ({
      productId: item.product_id || item.custom_product_id || item.id,
      quantity: item.quantity,
      price: Number(item.unit_price) || 0,
    })),
  };
}

/** Test helper: forget the in-memory purchase guards. */
export function resetPurchaseTrackingForTests(): void {
  trackedInMemory.clear();
  pendingPurchases.clear();
}

// ── Checkout snapshot (Kustom guests) ─────────────────────────────────────────
// The Kustom confirmation page can only load the full order for a logged-in
// customer. The checkout page therefore keeps what the session charges in
// sessionStorage (same tab as Kustom's redirect) so a guest's Purchase still
// carries value, currency and items.

export interface PurchaseSnapshot {
  value: number;
  currency: string;
  items: TrackItem[];
}

function snapshotKey(sessionId: string): string {
  return `ms:purchase-snapshot:${sessionId}`;
}

export function rememberPurchaseSnapshot(sessionId: string, snapshot: PurchaseSnapshot): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    window.sessionStorage.setItem(snapshotKey(sessionId), JSON.stringify(snapshot));
  } catch {
    // Storage blocked: the Purchase of a guest is then left to the server event.
  }
}

export function readPurchaseSnapshot(sessionId: string | null | undefined): PurchaseSnapshot | null {
  if (typeof window === 'undefined' || !sessionId) return null;
  try {
    const raw = window.sessionStorage.getItem(snapshotKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PurchaseSnapshot> | null;
    if (!parsed || typeof parsed.value !== 'number' || !Number.isFinite(parsed.value)) return null;
    if (typeof parsed.currency !== 'string' || !parsed.currency) return null;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((item): item is TrackItem => Boolean(item) && typeof item.productId === 'string' && typeof item.quantity === 'number')
      : [];
    return { value: parsed.value, currency: parsed.currency, items };
  } catch {
    return null;
  }
}

// ── Tracking context for the API (server-side Conversions API) ────────────────

/** Sent as `tracking` with the order-creating requests. */
export interface TrackingContext {
  fbp?: string;
  fbc?: string;
  source_url?: string;
}

function readCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : '';
    return value || undefined;
  } catch {
    return undefined;
  }
}

/** Longest value sent in `tracking` (the API drops anything it dislikes, but
 *  an oversized or malformed cookie must never be able to fail a checkout). */
const TRACKING_VALUE_MAX = 500;

/** `_fbp` / `_fbc` look like "fb.<n>.<ms>.<id>"; anything else is dropped. */
function cleanFbCookie(value: string | undefined | null): string | undefined {
  if (!value || value.length > TRACKING_VALUE_MAX) return undefined;
  return /^fb\.\d+\.\d+\.\S+$/.test(value) ? value : undefined;
}

/**
 * The Meta browser ids of this visit, or undefined when they must not be
 * sent: the Meta pixel is not mounted (store without a pixel id, or consent
 * not granted / withdrawn). The pixel sets `_fbp` and — for a landing URL
 * with `fbclid` — `_fbc` itself; the cookies are only read here.
 */
export function readTrackingContext(): TrackingContext | undefined {
  if (typeof window === 'undefined' || !isMetaPixelActive()) return undefined;
  const fbp = cleanFbCookie(readCookie('_fbp'));
  const fbc = cleanFbCookie(readCookie('_fbc'));
  let sourceUrl: string | undefined;
  try {
    sourceUrl = `${window.location.origin}${window.location.pathname}`;
  } catch {
    sourceUrl = undefined;
  }
  if (sourceUrl && sourceUrl.length > TRACKING_VALUE_MAX) sourceUrl = undefined;
  const context: TrackingContext = {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
  };
  return Object.keys(context).length > 0 ? context : undefined;
}

/** `{ tracking }` body fragment, or `{}` when there is nothing to send. */
export function trackingBody(): { tracking?: TrackingContext } {
  const tracking = readTrackingContext();
  return tracking ? { tracking } : {};
}
