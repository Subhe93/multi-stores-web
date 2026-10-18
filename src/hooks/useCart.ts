'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
  createElement,
} from 'react';
import { api } from '@/lib/api';
import { CART_HANDOFF_DROPPED_PARAM, CART_HANDOFF_PARAM, decodeGuestCart, type HandoffLine } from '@/lib/cartHandoff';
import {
  normalizeB2bNetTotals,
  normalizeTaxLines,
  normalizeTaxPricingMode,
  sumTaxLines,
  type B2bNetTotals,
  type StoreTaxConfig,
  type TaxLine,
  type TaxPricingMode,
} from '@/lib/tax';
import { isKnownRate, netFromGross } from '@/lib/b2bPrice';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { captureCouponFromSearch, pendingCouponStorageKey, type CouponAutoApplyNotice } from '@/lib/checkoutSettings';
import { availableLines, hasUnavailableLines, sumLineTotals } from '@/lib/cartAvailability';
import {
  addGuestLine,
  guestLineToServerBody,
  mergeHandoffLines,
  patchGuestDesignLine,
  replaceGuestDesignLine,
  createGuestCartMover,
  guestCartFromStorageEvent,
  GUEST_CART_KEY,
  GUEST_COUPON_KEY,
  parseStoredGuestCart,
  safeStorageWrite,
  type DroppedGuestLine,
  type GuestMigrationResult,
} from '@/lib/guestCart';
import {
  applyValidateResult,
  buildValidateBody,
  personalizationInvalidError,
  readValidateResult,
  validatePath,
  type GuestPersonalizationCheck,
} from '@/components/product/personalization/validateApi';

// ── Types ──────────────────────────────────────────────

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  customProductId?: string;
  name?: string;
  title?: string;
  price: number;
  quantity: number;
  image?: string;
  imageUrl?: string;
  variant?: string;
  customerFile?: string;
  currency?: string;
  customFields?: Record<string, unknown>;
  /** Resolved "label: value" lines for the custom fields (server-enriched, or captured at add time for guests). */
  customFieldDisplay?: CartCustomFieldDisplay[];
  bundleOfferId?: string | null;
  bundleOriginalUnitPrice?: number | null;
  bundleTitle?: string | null;
  bundleLabel?: string | null;
  bundleStickerText?: string | null;
  bundleCartQuantity?: number | null;
  /** Estimated tax rate of the line (b2b stores only): from GET /cart
   *  `items[].tax_rate_bp`, or copied from the product at add time for
   *  guest carts (M2-DESIGN D2 / L8). Null/undefined = unknown. */
  taxRateBp?: number | null;
  /** Markets app: the line's product is hidden in the request market. The
   *  line stays in the cart (so it can be removed) but has no valid price
   *  here, is excluded from server tax/totals and blocks checkout. */
  unavailableInMarket?: boolean;
  /** Personalization app: the server could not validate the line's
   *  personalization any more (config changed); set only when flagged. */
  personalizationInvalid?: boolean;
  /** Designer app (M4.2): the line's design. Absent on every other line. */
  designId?: string;
  /** Guest lines only: the design's access token, sent when the line moves
   *  to the server cart on login (claims the design). Never put in a URL. */
  designToken?: string;
  /** Designer line details: server-enriched (`GET /cart` `design`) or
   *  captured at add time for guests. */
  design?: CartLineDesign;
}

/** Design of a designer cart line. */
export interface CartLineDesign {
  id: string;
  /** False once the design can no longer change (ordered). */
  editable: boolean;
  /** Signed proof image (relative API path, ~1 h); null until rendered. */
  proofUrl: string | null;
  /** Product page slug of the design (server block / design view). */
  productSlug?: string | null;
  /** The design no longer passes the template (checkout is blocked). */
  invalid?: boolean;
  /** API code of why the design is invalid (`DESIGNER_*`). */
  invalidCode?: string | null;
}

/** New display / proof of a designer line after its design was edited. */
export interface DesignLinePatch {
  display?: CartCustomFieldDisplay[];
  proofUrl?: string | null;
}

/** The design that replaces a locked (ordered) design on a cart line. */
export interface DesignLineReplacement {
  id: string;
  token?: string | null;
  proofUrl?: string | null;
  productSlug?: string | null;
}

export interface CartCustomFieldDisplay {
  id: string;
  label: string;
  value: unknown;
  /** Translated option label when the value is one of the field's options. */
  display?: string | null;
  // Personalization app only (M4.1 contract §4.5); absent otherwise.
  /** Repeater name of a grouped line. */
  group_key?: string;
  /** Repeater item index ("Artikel i"). */
  group_index?: number;
  group_label?: string;
  /** Colour of a palette / variant option value. */
  hex?: string;
  source?: 'FIELD' | 'OPTION';
}

export interface CartItemMetadata {
  title?: string;
  price?: number;
  imageUrl?: string;
  variant?: string;
  customerFile?: string;
  currency?: string;
  customProductId?: string;
  customFieldDisplay?: CartCustomFieldDisplay[];
  bundleOfferId?: string | null;
  bundleOriginalUnitPrice?: number | null;
  bundleTitle?: string | null;
  bundleLabel?: string | null;
  bundleStickerText?: string | null;
  bundleCartQuantity?: number | null;
  /** b2b stores: the product's `tax_rate_bp`, kept on guest lines. */
  taxRateBp?: number | null;
  /** Personalization app (D14): guests validate the line on the server
   *  first and keep its normalized values, price and display. Not stored. */
  personalizationCheck?: GuestPersonalizationCheck;
  /** Designer app (M4.2): add the line with this design instead of field
   *  values. `token` is the guest token (claims the design server-side). */
  design?: { id: string; token?: string | null; proofUrl?: string | null };
}

interface Coupon {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  freeShipping?: boolean;
}

/** Tax figures GET /cart returns (API-CONTRACT-TAX §3): itemized lines,
 *  estimated for the store's registration country until an address is known. */
interface CartTax {
  lines: TaxLine[];
  total: number;
  pricingMode: TaxPricingMode | null;
  estimated: boolean;
  /** EXCLUSIVE mode only: `total` + tax; null when the API did not send it. */
  totalWithTax: number | null;
  /** b2b stores, company view: net figures the API derived (null otherwise). */
  b2b: B2bNetTotals | null;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  coupon: Coupon | null;
}

interface CartContextValue extends CartState {
  addItem: (
    productId: string,
    variantId: string | null,
    quantity: number,
    customFields?: Record<string, unknown>,
    metadata?: CartItemMetadata,
  ) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  /** Clear the bundle reference on a line, reverting to base price */
  clearBundle: (itemId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  /**
   * Designer app: after a cart line's design was edited, refresh the line
   * (guests patch the stored line; logged-in carts re-read `GET /cart`).
   */
  refreshDesignLine: (designId: string, patch: DesignLinePatch) => Promise<void>;
  /**
   * Designer app: swap the locked (ordered) design of a line for its
   * duplicate, keeping product, variant, bundle and quantity.
   */
  replaceDesignLine: (oldDesignId: string, next: DesignLineReplacement) => Promise<void>;
  /** Migrate localStorage cart items to the server and return the server cart */
  /**
   * Moves the guest cart to the server cart (checkout after auto-register).
   * Resolves with the lines the server rejected for their personalization;
   * those stay in the guest cart and checkout must stop (M4.0 §1.2).
   */
  syncGuestCartToServer: (authToken: string) => Promise<DroppedGuestLine[]>;
  itemCount: number;
  subtotal: number;
  total: number;
  /** Currency to display cart totals in — the store's, so it matches what the
   *  server will actually charge. */
  currency: string;
  /** Itemized tax lines from GET /cart (empty for guest carts — the server
   *  computes tax, nothing is derived client-side). */
  taxLines: TaxLine[];
  /** Sum of `taxLines` (`tax_total` from the API). */
  taxTotal: number;
  /** INCLUSIVE: `total` already contains tax; EXCLUSIVE: tax is added on top. */
  taxPricingMode: TaxPricingMode;
  /** True until an address is known (registration-country estimate or guest cart). */
  taxEstimated: boolean;
  /** Grand total incl. tax: `total_with_tax` in EXCLUSIVE mode, `total` in
   *  INCLUSIVE mode; null for a guest EXCLUSIVE cart (unknown until checkout). */
  totalWithTax: number | null;
  /** b2b app, company view: net figures from GET /cart (`b2b` block); null
   *  for guest carts, persons and stores without the app. */
  b2bNet: B2bNetTotals | null;
  /** Net item subtotal for the company view: the server's `net_items` when
   *  known, else a client estimate from the lines' rates, else null (no rate
   *  known — callers fall back to the gross subtotal). */
  netItems: number | null;
  /** True after a cross-market hand-off re-priced the lines (markets app). */
  pricesUpdated: boolean;
  /** Lines a cross-market hand-off had to drop (not purchasable here). */
  handoffDropped: number;
  /** Guest lines that could not be moved to the account cart on login
   *  because the server rejected their personalization (M4.0 §1.2). */
  migrationDropped: number;
  /** The coded API error of the first line counted in `migrationDropped`. */
  migrationDropError: unknown;
  /** True while any line is flagged `unavailableInMarket` — checkout is blocked. */
  hasUnavailableItems: boolean;
  /** Hide the hand-off and login-migration notices. */
  dismissPricesNotice: () => void;
  /** Coupon auto-apply (M5.1): the code captured from the URL and what
   *  happened to it; null when nothing was captured or the notice was hidden. */
  couponNotice: CouponAutoApplyNotice | null;
  dismissCouponNotice: () => void;
}

// ── Local-storage helpers (guest cart) ─────────────────

// Stable reference so consumers' effects don't re-run on every render.
const EMPTY_TAX_LINES: TaxLine[] = [];

/** `localStorage` when usable; null on the server or when access throws. */
function localStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadLocalCart(): CartItem[] {
  const store = localStore();
  if (!store) return [];
  try {
    return parseStoredGuestCart(store.getItem(GUEST_CART_KEY));
  } catch {
    return [];
  }
}

// Never throws (M5 D1): a full / disabled storage keeps the in-memory cart.
function saveLocalCart(items: CartItem[]) {
  safeStorageWrite(localStore(), GUEST_CART_KEY, JSON.stringify(items));
}

function loadLocalCoupon(): Coupon | null {
  const store = localStore();
  if (!store) return null;
  try {
    const raw = store.getItem(GUEST_COUPON_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalCoupon(coupon: Coupon | null) {
  safeStorageWrite(localStore(), GUEST_COUPON_KEY, coupon ? JSON.stringify(coupon) : null);
}

// ── Normalize API cart response ───────────────────────
// The API returns enriched items with camelCase keys from the backend.
// Map them to our CartItem interface.

// A cart line as the API sends it. Newer builds use camelCase, older ones
// snake_case; both spellings are read so either API version normalizes.
interface RawCartItem {
  id: string;
  productId?: string | null;
  product_id?: string | null;
  variantId?: string | null;
  variant_id?: string | null;
  customProductId?: string | null;
  custom_product_id?: string | null;
  title?: string | null;
  name?: string | null;
  price?: unknown;
  quantity?: number | null;
  imageUrl?: string | null;
  image_url?: string | null;
  image?: string | null;
  variant?: string | null;
  currency?: string | null;
  customFields?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
  customFieldDisplay?: unknown;
  custom_field_display?: unknown;
  customerFile?: string | null;
  bundleOfferId?: string | null;
  bundle_offer_id?: string | null;
  bundleOriginalUnitPrice?: unknown;
  bundle_original_unit_price?: unknown;
  bundleTitle?: string | null;
  bundle_title?: string | null;
  bundleLabel?: string | null;
  bundle_label?: string | null;
  bundleStickerText?: string | null;
  bundle_sticker_text?: string | null;
  bundleCartQuantity?: unknown;
  bundle_cart_quantity?: unknown;
  taxRateBp?: unknown;
  tax_rate_bp?: unknown;
  unavailableInMarket?: unknown;
  unavailable_in_market?: unknown;
  personalization_invalid?: unknown;
  personalizationInvalid?: unknown;
  design?: unknown;
  design_id?: string | null;
  designId?: string | null;
}

/** `design` block of a designer line in `GET /cart` (M4.2-CONTRACTS). */
export function readCartLineDesign(raw: unknown): { design: CartLineDesign; display: CartCustomFieldDisplay[] } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const d = raw as {
    id?: unknown;
    editable?: unknown;
    proof_url?: unknown;
    text_values?: unknown;
    product_slug?: unknown;
    invalid?: unknown;
    invalid_code?: unknown;
  };
  if (typeof d.id !== 'string' || d.id === '') return null;
  const display: CartCustomFieldDisplay[] = [];
  if (Array.isArray(d.text_values)) {
    for (const tv of d.text_values) {
      const v = tv as { element_id?: unknown; label?: unknown; value?: unknown } | null;
      if (v && typeof v.element_id === 'string' && typeof v.value === 'string' && v.value !== '') {
        display.push({ id: v.element_id, label: typeof v.label === 'string' ? v.label : v.element_id, value: v.value });
      }
    }
  }
  return {
    design: {
      id: d.id,
      editable: d.editable === true,
      proofUrl: typeof d.proof_url === 'string' && d.proof_url ? d.proof_url : null,
      // Optional keys only when sent, so older payloads keep their shape.
      ...(typeof d.product_slug === 'string' && d.product_slug ? { productSlug: d.product_slug } : {}),
      ...(d.invalid === true
        ? { invalid: true, invalidCode: typeof d.invalid_code === 'string' && d.invalid_code ? d.invalid_code : null }
        : {}),
    },
    display,
  };
}

export function normalizeCartItem(raw: RawCartItem): CartItem {
  const rawRate = raw.tax_rate_bp ?? raw.taxRateBp;
  const designBlock = readCartLineDesign(raw.design);
  const rawDisplay = Array.isArray(raw.customFieldDisplay)
    ? raw.customFieldDisplay
    : Array.isArray(raw.custom_field_display)
    ? raw.custom_field_display
    : undefined;
  return {
    id: raw.id,
    productId: raw.productId || raw.product_id || '',
    variantId: raw.variantId || raw.variant_id || undefined,
    customProductId: raw.customProductId || raw.custom_product_id || undefined,
    title: raw.title || undefined,
    name: raw.name || raw.title || undefined,
    price: typeof raw.price === 'number' ? raw.price : 0,
    quantity: raw.quantity || 1,
    imageUrl: raw.imageUrl || raw.image_url || undefined,
    image: raw.image || raw.imageUrl || raw.image_url || undefined,
    variant: raw.variant || undefined,
    currency: raw.currency || 'EUR',
    customFields: raw.customFields || raw.custom_fields || undefined,
    // Designer lines carry no field values: their text values are the display.
    customFieldDisplay:
      designBlock && (!rawDisplay || rawDisplay.length === 0) ? designBlock.display : rawDisplay,
    customerFile: raw.customerFile || undefined,
    bundleOfferId: raw.bundleOfferId ?? raw.bundle_offer_id ?? null,
    bundleOriginalUnitPrice:
      typeof raw.bundleOriginalUnitPrice === 'number'
        ? raw.bundleOriginalUnitPrice
        : typeof raw.bundle_original_unit_price === 'number'
        ? raw.bundle_original_unit_price
        : null,
    bundleTitle: raw.bundleTitle ?? raw.bundle_title ?? null,
    bundleLabel: raw.bundleLabel ?? raw.bundle_label ?? null,
    bundleStickerText: raw.bundleStickerText ?? raw.bundle_sticker_text ?? null,
    bundleCartQuantity:
      typeof raw.bundleCartQuantity === 'number'
        ? raw.bundleCartQuantity
        : typeof raw.bundle_cart_quantity === 'number'
        ? raw.bundle_cart_quantity
        : null,
    // Only present on b2b stores; absent keys leave the field undefined so
    // the item shape stays identical everywhere else.
    ...(rawRate !== undefined && rawRate !== null && Number.isFinite(Number(rawRate))
      ? { taxRateBp: Number(rawRate) }
      : {}),
    // Only set when flagged so unaffected carts keep the exact same shape.
    ...((raw.unavailable_in_market ?? raw.unavailableInMarket) === true ? { unavailableInMarket: true } : {}),
    // Personalization app: present only when the server flags the line.
    ...((raw.personalization_invalid ?? raw.personalizationInvalid) === true ? { personalizationInvalid: true } : {}),
    // Designer app: only on designer lines.
    ...(designBlock ? { designId: designBlock.design.id, design: designBlock.design } : {}),
  };
}

// `tax_lines` & co. are optional on GET /cart (older API builds omit them);
// null means "no server figures" and the UI falls back to the guest behaviour.
function normalizeCartTax(data: unknown): CartTax | null {
  const raw = (data ?? {}) as Record<string, unknown>;
  if (!('tax_lines' in raw) && !('tax_total' in raw) && !('tax_pricing_mode' in raw)) return null;
  const lines = normalizeTaxLines(raw.tax_lines ?? raw.taxLines);
  const rawTotal = Number(raw.tax_total ?? raw.taxTotal);
  const rawWithTax = Number(raw.total_with_tax ?? raw.totalWithTax);
  return {
    lines,
    total: Number.isFinite(rawTotal) ? rawTotal : sumTaxLines(lines),
    pricingMode: normalizeTaxPricingMode(raw.tax_pricing_mode ?? raw.taxPricingMode),
    estimated: (raw.tax_estimated ?? raw.taxEstimated) !== false,
    totalWithTax: Number.isFinite(rawWithTax) ? rawWithTax : null,
    b2b: normalizeB2bNetTotals(raw.b2b),
  };
}

function normalizeCartResponse(data: unknown): { items: CartItem[]; coupon: Coupon | null; tax: CartTax | null } {
  if (Array.isArray(data)) {
    return { items: data.map(normalizeCartItem), coupon: null, tax: null };
  }
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; coupon?: Coupon | null };
    const rawItems: RawCartItem[] = Array.isArray(obj.items) ? obj.items : [];
    return {
      items: rawItems.map(normalizeCartItem),
      coupon: obj.coupon ?? null,
      tax: normalizeCartTax(data),
    };
  }
  return { items: [], coupon: null, tax: null };
}

// ── Context ────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ───────────────────────────────────────────

interface CartProviderProps {
  children: ReactNode;
  token?: string | null;
  /** Active storefront locale — sent to the API so item titles come back in
   *  the right language (the server defaults to the wrong locale otherwise). */
  locale?: string;
  /** Store the cart belongs to — required when validating a coupon, since a
   *  coupon is only valid on the store whose owner issued it. */
  storeId?: string;
  /** The store's presentment currency. Authoritative for display: the server
   *  derives the order currency from the same store, whereas the currency
   *  stamped on a cart item is only the platform default. */
  storeCurrency?: string;
  /** The store's tax settings from `storefront.getStore`; gives the pricing
   *  mode for guest carts, which have no server figures. */
  storeTax?: StoreTaxConfig | null;
  /** Market the storefront is served in (markets app, M1-DESIGN §4.2):
   *  appended as `market=` to every /cart call so lines are priced in the
   *  market currency. Undefined for stores without the app. */
  marketKey?: string;
  /** b2b app (M2-DESIGN D1): `'company'` appends `buyer=company` to every
   *  /cart call so lines carry `tax_rate_bp` and the response a `b2b` net
   *  block. Undefined for persons and stores without the app. */
  buyer?: 'company';
  /** False while the auth provider is still hydrating the session; the
   *  cross-market hand-off waits for it (guest vs customer decision). Defaults
   *  to true so existing callers keep working. */
  authReady?: boolean;
}

export function CartProvider({ children, token, locale, storeId, storeCurrency, storeTax, marketKey, buyer, authReady = true }: CartProviderProps) {
  // Suffix appended to /cart endpoints so the API resolves product titles in
  // the storefront's active language rather than its default ordering (and,
  // for market stores, prices lines for the request market).
  const localeQuery = (() => {
    const params: string[] = [];
    if (locale) params.push(`locale=${encodeURIComponent(locale)}`);
    if (marketKey) params.push(`market=${encodeURIComponent(marketKey)}`);
    if (buyer === 'company') params.push('buyer=company');
    return params.length ? `?${params.join('&')}` : '';
  })();
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [serverTax, setServerTax] = useState<CartTax | null>(null);
  const [loading, setLoading] = useState(true);
  // Set after a cross-market hand-off (`?c=`, M1-DESIGN D10) re-priced the
  // lines, so the cart UI can show "prices updated for this market".
  const [pricesUpdated, setPricesUpdated] = useState(false);
  // Lines the hand-off could not carry over (rejected by the quote).
  const [handoffDropped, setHandoffDropped] = useState(0);
  // Guest lines rejected when moved to the server cart on login.
  const [migrationDropped, setMigrationDropped] = useState(0);
  const [migrationDropError, setMigrationDropError] = useState<unknown>(null);
  const dismissPricesNotice = useCallback(() => {
    setPricesUpdated(false);
    setHandoffDropped(0);
    setMigrationDropped(0);
    setMigrationDropError(null);
  }, []);
  const prevTokenRef = useRef<string | null | undefined>(undefined);

  // ── Coupon auto-apply (M5 W2-A, M5.1) ────────────────
  // A campaign link carries `?coupon=CODE` (or any key in `coupon_param`,
  // e.g. Namez's legacy `coupon1`). With `coupon_autoapply` on, the code is
  // captured on any store page, stripped from the URL, kept per store in
  // localStorage and applied through the regular coupon flow as soon as the
  // cart has a line (coupon rules such as a minimum subtotal are judged
  // against real lines). Stores on the defaults never read the URL.
  const checkoutSettings = useCheckoutSettings();
  const couponAutoapply = checkoutSettings.coupon_autoapply;
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [couponNotice, setCouponNotice] = useState<CouponAutoApplyNotice | null>(null);
  const dismissCouponNotice = useCallback(() => setCouponNotice(null), []);
  const autoApplyBusy = useRef(false);

  // ── Guest cart → server cart ────────────────────────
  // The login effect and the checkout sync share one in-flight run (no line
  // is posted twice). Only the lines the server accepted leave localStorage:
  // rejected lines (and lines that failed for another reason) stay local.
  const [moveGuestCart] = useState(() => createGuestCartMover({ load: loadLocalCart, save: saveLocalCart }));
  const migrateLocalCart = useCallback(async (authToken: string): Promise<GuestMigrationResult> => {
    const result = await moveGuestCart((body) =>
      api('/cart/items', { method: 'POST', token: authToken, body: JSON.stringify(body) }),
    );
    if (result.moved.length + result.dropped.length + result.failed.length === 0) return result;
    if (loadLocalCart().length === 0) saveLocalCoupon(null);
    // A set, not a sum: rejected lines stay local and are retried on the next
    // run, so they must not be counted twice.
    setMigrationDropped(result.dropped.length);
    setMigrationDropError(result.dropped[0]?.error ?? null);
    return result;
  }, [moveGuestCart]);

  const isAuthenticated = Boolean(token);

  // ── Guest cart persistence (M5 D1) ───────────────────
  // The guest cart is written from an effect on `items`, never inside a
  // state updater: a storage failure then only skips the write and the
  // in-memory cart survives. `guestLoaded` keeps the initial empty state from
  // wiping the stored cart before it was read.
  const [guestLoaded, setGuestLoaded] = useState(false);
  useEffect(() => {
    if (isAuthenticated || !guestLoaded) return;
    saveLocalCart(items);
  }, [items, isAuthenticated, guestLoaded]);

  // ── Cross-tab sync of the guest cart (M5 D12) ─────────
  // Another tab (same origin) changed the stored cart or coupon: mirror it.
  // Logged-in carts live on the server and refetch on their own.
  useEffect(() => {
    if (isAuthenticated || typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      const lines = guestCartFromStorageEvent(event);
      if (lines) setItems(lines);
      else if (event.key === GUEST_COUPON_KEY) setCoupon(loadLocalCoupon());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isAuthenticated]);

  // ── Cross-market cart hand-off landing (markets app only) ──
  // `?c=` carries a guest's lines from another market domain (D10 / L9).
  // Waits for auth hydration so the guest / customer decision is final.
  // Guests merge the lines into the local cart and re-price them through
  // POST /orders/quote for this market (batch first, then line-by-line so
  // one rejected line does not sink the rest); rejected lines are dropped
  // and counted. Logged-in customers only need the server-cart refetch the
  // effect below already performs. The param is stripped from the URL.
  useEffect(() => {
    if (!marketKey || !authReady || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const param = url.searchParams.get(CART_HANDOFF_PARAM);
    const senderDropped = Math.max(0, Number.parseInt(url.searchParams.get(CART_HANDOFF_DROPPED_PARAM) || '0', 10) || 0);
    if (!param && senderDropped === 0) return;
    url.searchParams.delete(CART_HANDOFF_PARAM);
    url.searchParams.delete(CART_HANDOFF_DROPPED_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());

    // Lines the sender could not fit into the 4 KB cap (L9).
    if (senderDropped > 0) setHandoffDropped(senderDropped);
    const lines = decodeGuestCart(param);
    if (lines.length === 0) return;
    if (isAuthenticated) {
      setPricesUpdated(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const toQuoteLine = (l: HandoffLine) => ({
        quantity: l.q,
        ...(l.c ? { custom_product_id: l.c } : { product_id: l.p }),
        ...(l.v ? { variant_id: l.v } : {}),
        ...(l.b ? { bundle_offer_id: l.b } : {}),
        ...(l.f ? { custom_fields: l.f } : {}),
      });
      type Quote = { items?: { unit_price?: number; tax_rate_bp?: number }[]; currency?: string };
      const quote = (qLines: HandoffLine[]) =>
        api<Quote>('/orders/quote', {
          method: 'POST',
          body: JSON.stringify({
            store_id: storeId,
            market_key: marketKey,
            lines: qLines.map(toQuoteLine),
            ...(buyer === 'company' ? { buyer_type: 'COMPANY' } : {}),
          }),
        });

      // price per line index; undefined = rejected
      const priced: ({ price: number; currency?: string; taxRateBp?: number } | undefined)[] = new Array(lines.length);
      try {
        const res = await quote(lines);
        lines.forEach((_, i) => {
          const unit = res.items?.[i]?.unit_price;
          const rate = res.items?.[i]?.tax_rate_bp;
          if (typeof unit === 'number') priced[i] = { price: unit, currency: res.currency, ...(typeof rate === 'number' ? { taxRateBp: rate } : {}) };
        });
      } catch {
        // Batch rejected (e.g. one product hidden in this market): re-quote
        // line-by-line so the valid lines survive.
        await Promise.all(
          lines.map(async (l, i) => {
            try {
              const res = await quote([l]);
              const unit = res.items?.[0]?.unit_price;
              const rate = res.items?.[0]?.tax_rate_bp;
              if (typeof unit === 'number') priced[i] = { price: unit, currency: res.currency, ...(typeof rate === 'number' ? { taxRateBp: rate } : {}) };
            } catch {
              priced[i] = undefined;
            }
          }),
        );
      }
      if (cancelled) return;

      const incoming: CartItem[] = [];
      let dropped = 0;
      lines.forEach((l, i) => {
        const p = priced[i];
        if (!p) { dropped += 1; return; }
        incoming.push({
          id: `local_${Date.now()}_${i}`,
          productId: l.c ?? l.p ?? '',
          variantId: l.v,
          customProductId: l.c,
          title: l.t,
          price: p.price,
          currency: p.currency,
          quantity: l.q,
          imageUrl: l.i,
          variant: l.l,
          customFields: l.f,
          bundleOfferId: l.b ?? null,
          ...(p.taxRateBp !== undefined ? { taxRateBp: p.taxRateBp } : {}),
        });
      });

      if (incoming.length > 0) {
        setItems((prev) => {
          // Same line = same product, variant, bundle and personalization.
          return mergeHandoffLines(prev, incoming);
        });
        setPricesUpdated(true);
      }
      if (dropped > 0) setHandoffDropped((n) => n + dropped);
    })();
    return () => { cancelled = true; };
    // Runs once auth is hydrated: the param is consumed on that pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketKey, authReady, buyer]);

  // ── Initial load + guest cart migration on login ────

  useEffect(() => {
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = token ?? null;

    if (isAuthenticated && token) {
      // The server cart is authoritative now: stop mirroring `items` to storage.
      setGuestLoaded(false);
      // Check if we just transitioned from guest to authenticated
      const wasGuest = prevToken === null || prevToken === undefined;
      const hasGuestItems = wasGuest && loadLocalCart().length > 0;

      // Fetch server cart
      api<unknown>(`/cart${localeQuery}`, { token })
        .then(async (data) => {
          const cart = normalizeCartResponse(data);

          // Migrate guest cart items to the server if any. Lines the server
          // rejects for their personalization stay local, counted and shown.
          if (hasGuestItems) {
            await migrateLocalCart(token);

            // Re-fetch the merged cart from server
            try {
              const refreshed = normalizeCartResponse(
                await api<unknown>(`/cart${localeQuery}`, { token })
              );
              setItems(refreshed.items);
              setCoupon(refreshed.coupon);
              setServerTax(refreshed.tax);
            } catch {
              setItems(cart.items);
              setCoupon(cart.coupon);
              setServerTax(cart.tax);
            }
          } else {
            setItems(cart.items);
            setCoupon(cart.coupon);
            setServerTax(cart.tax);
          }
        })
        .catch(() => {
          // API failed — fallback to local cart so the user doesn't lose items
          setItems(loadLocalCart());
          setCoupon(loadLocalCoupon());
          setServerTax(null);
        })
        .finally(() => setLoading(false));
    } else {
      // Guest: load from localStorage
      setItems(loadLocalCart());
      setCoupon(loadLocalCoupon());
      setServerTax(null);
      setLoading(false);
      setGuestLoaded(true);
    }
  }, [isAuthenticated, token, localeQuery, migrateLocalCart]);

  // ── Add item ───────────────────────────────────────

  const addItem = useCallback(
    async (
      productId: string,
      variantId: string | null,
      quantity: number,
      customFields?: Record<string, unknown>,
      metadata?: CartItemMetadata,
    ) => {
      const isCustomProduct = Boolean(metadata?.customProductId);
      const bundleOfferId = metadata?.bundleOfferId || undefined;
      // Designer app (M4.2): a design replaces the field values on the line.
      const design = metadata?.design?.id ? metadata.design : undefined;
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items${localeQuery}`,
          {
            method: 'POST',
            token,
            body: JSON.stringify({
              product_id: isCustomProduct ? null : productId,
              custom_product_id: isCustomProduct ? productId : undefined,
              variant_id: variantId,
              bundle_offer_id: bundleOfferId,
              quantity,
              ...(design
                ? { design_id: design.id, ...(design.token ? { design_token: design.token } : {}) }
                : { custom_fields: customFields }),
            }),
          }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        let fields = customFields;
        let meta = metadata;
        if (metadata?.personalizationCheck && !design) {
          // Personalization app (D14): the server normalizes the values and
          // prices the line; its canonical values make the line key.
          const raw = await api<unknown>(validatePath(metadata.personalizationCheck.storeSlug), {
            method: 'POST',
            body: JSON.stringify(
              buildValidateBody(productId, variantId, quantity, customFields, metadata.personalizationCheck),
            ),
          });
          const result = readValidateResult(raw);
          if (!result) throw new Error('PERSONALIZATION_VALIDATE_FAILED');
          if (!result.ok) throw personalizationInvalidError(result.errors);
          fields = result.custom_fields;
          meta = applyValidateResult(metadata, result);
        }
        setItems((prev) => {
          // Merges only into a line with the same personalization (line key).
          return addGuestLine(prev, productId, variantId, quantity, fields, meta);
        });
      }
    },
    [isAuthenticated, token, localeQuery]
  );

  // ── Update quantity ────────────────────────────────

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (isAuthenticated && token) {
        let data: unknown;
        try {
          data = await api<unknown>(
            `/cart/items/${itemId}${localeQuery}`,
            {
              method: 'PUT',
              token,
              body: JSON.stringify({ quantity }),
            }
          );
        } catch (err) {
          // The line became unavailable in this market since the cart was
          // loaded: reload so it shows flagged (remove-only) instead of failing.
          if ((err as { code?: string }).code !== 'CART_ITEM_NOT_AVAILABLE_IN_MARKET') throw err;
          data = await api<unknown>(`/cart${localeQuery}`, { token });
        }
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        setItems((prev) => {
          return prev.map((item) => (item.id === itemId ? { ...item, quantity } : item));
        });
      }
    },
    [isAuthenticated, token, localeQuery]
  );

  // ── Clear bundle on a line ─────────────────────────

  const clearBundle = useCallback(
    async (itemId: string) => {
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items/${itemId}${localeQuery}`,
          {
            method: 'PUT',
            token,
            body: JSON.stringify({ bundle_offer_id: null }),
          }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        setItems((prev) => {
          return prev.map((item) => {
            if (item.id !== itemId) return item;
            const restoredPrice =
              typeof item.bundleOriginalUnitPrice === 'number'
                ? item.bundleOriginalUnitPrice
                : item.price;
            return {
              ...item,
              price: restoredPrice,
              bundleOfferId: null,
              bundleOriginalUnitPrice: null,
              bundleTitle: null,
              bundleLabel: null,
              bundleStickerText: null,
              bundleCartQuantity: null,
            };
          });
        });
      }
    },
    [isAuthenticated, token, localeQuery]
  );

  // ── Remove item ────────────────────────────────────

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items/${itemId}${localeQuery}`,
          { method: 'DELETE', token }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        setItems((prev) => {
          return prev.filter((item) => item.id !== itemId);
        });
      }
    },
    [isAuthenticated, token, localeQuery]
  );

  // ── Designer lines ─────────────────────────────────

  const refreshDesignLine = useCallback(
    async (designId: string, patch: DesignLinePatch) => {
      if (isAuthenticated && token) {
        // The server block carries the new text values and a fresh proof.
        const data = await api<unknown>(`/cart${localeQuery}`, { token });
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
        return;
      }
      setItems((prev) => {
        return patchGuestDesignLine(prev, designId, patch);
      });
    },
    [isAuthenticated, token, localeQuery]
  );

  const replaceDesignLine = useCallback(
    async (oldDesignId: string, nextDesign: DesignLineReplacement) => {
      if (isAuthenticated && token) {
        const line = items.find((i) => i.designId === oldDesignId);
        if (!line) return;
        // Add the new design first so a failure never loses the line.
        await api<unknown>(`/cart/items${localeQuery}`, {
          method: 'POST',
          token,
          body: JSON.stringify(
            guestLineToServerBody({
              ...line,
              productId: line.customProductId || line.productId,
              designId: nextDesign.id,
              designToken: nextDesign.token ?? undefined,
            }),
          ),
        });
        const data = await api<unknown>(`/cart/items/${line.id}${localeQuery}`, { method: 'DELETE', token });
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
        return;
      }
      setItems((prev) => {
        return replaceGuestDesignLine(prev, oldDesignId, nextDesign);
      });
    },
    [isAuthenticated, token, localeQuery, items]
  );

  // ── Clear cart ─────────────────────────────────────

  const clearCart = useCallback(async () => {
    if (isAuthenticated && token) {
      try {
        await api('/cart', { method: 'DELETE', token });
      } catch {
        // Clear local state even if API fails
      }
    }
    setItems([]);
    setCoupon(null);
    setServerTax(null);
    setPricesUpdated(false);
    setHandoffDropped(0);
    setMigrationDropped(0);
    setMigrationDropError(null);
    // Also for logged-in customers (the guest effect does not run for them).
    saveLocalCart([]);
    saveLocalCoupon(null);
  }, [isAuthenticated, token]);

  // ── Coupon auto-apply: capture from the URL ─────────
  useEffect(() => {
    if (!couponAutoapply || typeof window === 'undefined') return;
    const key = pendingCouponStorageKey(storeId);
    const hit = captureCouponFromSearch(window.location.search, checkoutSettings);
    if (hit) {
      const url = new URL(window.location.href);
      url.search = hit.search;
      window.history.replaceState(window.history.state, '', url.toString());
      safeStorageWrite(localStore(), key, hit.code);
      setPendingCoupon(hit.code);
      setCouponNotice({ code: hit.code, status: 'pending' });
      return;
    }
    // A code captured on an earlier page load that could not be applied yet
    // (empty cart) is still waiting.
    try {
      const stored = localStore()?.getItem(key) ?? null;
      if (stored) {
        setPendingCoupon(stored);
        setCouponNotice((n) => n ?? { code: stored, status: 'pending' });
      }
    } catch {
      // Storage unavailable: nothing to resume.
    }
    // Runs once per store (the settings object is stable per page load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponAutoapply, storeId]);

  // ── Apply coupon ───────────────────────────────────

  const applyCoupon = useCallback(
    async (code: string) => {
      // Validate coupon and get discount amount (public endpoint)
      const validation = await api<{
        valid: boolean;
        type: string;
        value: number;
        discount_amount: number;
        free_shipping: boolean;
      }>('/promotions/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({
          coupon_code: code,
          store_id: storeId,
          subtotal: sumLineTotals(items),
          item_count: availableLines(items).reduce((sum, i) => sum + i.quantity, 0),
          product_ids: availableLines(items).map((i) => i.customProductId || i.productId).filter(Boolean),
        }),
      });

      const couponData: Coupon = {
        code,
        discount: validation.type === 'PERCENTAGE' || validation.type === 'COUPON'
          ? validation.value
          : validation.discount_amount,
        type: (validation.type === 'PERCENTAGE' || validation.type === 'COUPON')
          ? 'percentage'
          : 'fixed',
        freeShipping: validation.free_shipping,
      };

      if (isAuthenticated && token) {
        // Also persist in server cart session
        try {
          await api('/cart/apply-coupon', {
            method: 'POST',
            token,
            body: JSON.stringify({ code }),
          });
        } catch {
          // Non-critical: coupon is sent with order anyway
        }
      }

      setCoupon(couponData);
      saveLocalCoupon(couponData);
    },
    [isAuthenticated, token, items, storeId]
  );

  // ── Coupon auto-apply: apply once the cart has a line ──
  const applyCouponRef = useRef(applyCoupon);
  applyCouponRef.current = applyCoupon;
  const couponRef = useRef(coupon);
  couponRef.current = coupon;
  useEffect(() => {
    if (!couponAutoapply || !pendingCoupon || loading || autoApplyBusy.current) return;
    if (availableLines(items).length === 0) return;
    const code = pendingCoupon;
    const key = pendingCouponStorageKey(storeId);
    autoApplyBusy.current = true;
    (async () => {
      try {
        const current = couponRef.current?.code;
        if (!current || current.toUpperCase() !== code.toUpperCase()) await applyCouponRef.current(code);
        setCouponNotice({ code, status: 'applied' });
      } catch {
        setCouponNotice({ code, status: 'invalid' });
      } finally {
        // One attempt per captured code: a rejected code is not retried on
        // every cart change (the shopper can still type it manually).
        autoApplyBusy.current = false;
        setPendingCoupon(null);
        safeStorageWrite(localStore(), key, null);
      }
    })();
  }, [couponAutoapply, pendingCoupon, loading, items, storeId]);

  // ── Remove coupon ──────────────────────────────────

  const removeCoupon = useCallback(async () => {
    if (isAuthenticated && token) {
      try {
        const data = await api<unknown>(
          `/cart/remove-coupon${localeQuery}`,
          { method: 'DELETE', token }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } catch {
        setCoupon(null);
        setServerTax(null);
        saveLocalCoupon(null);
      }
    } else {
      setCoupon(null);
      setServerTax(null);
      saveLocalCoupon(null);
    }
  }, [isAuthenticated, token, localeQuery]);

  // ── Computed values ────────────────────────────────

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // Lines unavailable in the market are excluded, matching the server totals.
  const subtotal = useMemo(
    () => sumLineTotals(items),
    [items]
  );

  const total = useMemo(() => {
    if (!coupon) return subtotal;
    if (coupon.type === 'percentage') {
      return subtotal - subtotal * (coupon.discount / 100);
    }
    return Math.max(0, subtotal - coupon.discount);
  }, [subtotal, coupon]);

  // ── Sync guest cart to server (for checkout) ────────

  const syncGuestCartToServer = useCallback(async (authToken: string): Promise<DroppedGuestLine[]> => {
    // Lines in flight stay in localStorage, so an empty store means nothing to move.
    if (loadLocalCart().length === 0) return [];

    const { dropped } = await migrateLocalCart(authToken);

    // Refresh cart from server
    try {
      const data = await api<unknown>(`/cart${localeQuery}`, { token: authToken });
      const cart = normalizeCartResponse(data);
      setItems(cart.items);
      setCoupon(cart.coupon);
      setServerTax(cart.tax);
    } catch {
      // Keep current state
    }
    return dropped;
  }, [localeQuery, migrateLocalCart]);

  // ── Tax (server-computed; guest carts carry no figures) ─

  const currency = storeCurrency || items[0]?.currency || 'EUR';
  const taxPricingMode: TaxPricingMode =
    serverTax?.pricingMode ?? storeTax?.pricing_mode ?? 'INCLUSIVE';
  const taxLines = serverTax?.lines ?? EMPTY_TAX_LINES;
  const taxTotal = serverTax?.total ?? 0;
  // A guest cart (or an API without tax figures) is always an estimate.
  const taxEstimated = serverTax ? serverTax.estimated : true;
  const totalWithTax = useMemo(() => {
    if (taxPricingMode === 'INCLUSIVE') return total;
    if (serverTax?.totalWithTax !== null && serverTax?.totalWithTax !== undefined) return serverTax.totalWithTax;
    // EXCLUSIVE with lines but no explicit figure: add the tax on top.
    if (serverTax && serverTax.lines.length > 0) return total + serverTax.total;
    return null;
  }, [taxPricingMode, total, serverTax]);

  // ── Company view net figures (b2b app) ──────────────
  const b2bNet = serverTax?.b2b ?? null;
  const netItems = useMemo(() => {
    if (b2bNet) return b2bNet.net_items;
    // Guest / no server block: Σ net line prices when every line has a rate
    // (INCLUSIVE stores); EXCLUSIVE prices are already net.
    const lines = availableLines(items);
    if (lines.length === 0) return null;
    if (taxPricingMode === 'EXCLUSIVE') return subtotal;
    if (!lines.every((i) => isKnownRate(i.taxRateBp))) return null;
    return lines.reduce((sum, i) => sum + netFromGross(i.price, i.taxRateBp, currency) * i.quantity, 0);
  }, [b2bNet, items, taxPricingMode, subtotal, currency]);

  // ── Context value ──────────────────────────────────

  const value: CartContextValue = {
    items,
    loading,
    coupon,
    addItem,
    updateQuantity,
    clearBundle,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    syncGuestCartToServer,
    refreshDesignLine,
    replaceDesignLine,
    itemCount,
    subtotal,
    total,
    currency,
    taxLines,
    taxTotal,
    taxPricingMode,
    taxEstimated,
    totalWithTax,
    b2bNet,
    netItems,
    pricesUpdated,
    handoffDropped,
    migrationDropped,
    migrationDropError,
    hasUnavailableItems: hasUnavailableLines(items),
    dismissPricesNotice,
    couponNotice,
    dismissCouponNotice,
  };

  return createElement(CartContext.Provider, { value }, children);
}

// ── Hook ───────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}