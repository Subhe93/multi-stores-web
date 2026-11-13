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
  lineMatchesUnavailable,
  readUnavailableError,
  unavailableLines,
  unavailableRefKey,
  withoutUnavailable,
  type UnavailableRef,
} from '@/lib/cartUnavailable';
import { checkoutViewerHeaders, previewViewerHeaders } from '@/lib/storePreview';
import { readEditHintToken } from '@/components/edit-hint/editHintStorage';
import { toKustomCartLines } from '@/hooks/useKustomCheckout';
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
import { trackAddToCart } from '@/lib/trackEvents';
import {
  classifyCouponError,
  couponCartKey,
  couponDiscount,
  couponLineTotals,
  couponStorageKey,
  inferTargeted,
  parseStoredCoupon,
  type AppliedCoupon,
} from '@/lib/couponDiscount';

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
  /** Guest lines (M5.5): the per-unit add-on price included in the line price. */
  addonsUnitPrice?: number;
  /** M5.6: the line is double-sided ("Dubbelsidig" + both thumbnails). */
  doubleSided?: boolean;
  /** M5.6: signed back proof (relative API path); null until rendered. */
  proofBackUrl?: string | null;
}

/** New display / proof of a designer line after its design was edited. */
export interface DesignLinePatch {
  display?: CartCustomFieldDisplay[];
  proofUrl?: string | null;
  /** M5.6: the back proof of a double-sided design. */
  proofBackUrl?: string | null;
  /** M5.5 guest lines: the new per-unit add-on price (replaces the old one in the line price). */
  addonsUnitPrice?: number;
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
  design?: { id: string; token?: string | null; proofUrl?: string | null; addonsUnitPrice?: number; doubleSided?: true; proofBackUrl?: string | null };
}

/** Applied coupon (shape and discount rule live in `@/lib/couponDiscount`). */
export type Coupon = AppliedCoupon;

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
  /**
   * Drops the lines a `CART_ITEMS_UNAVAILABLE` error names (deleted /
   * unpublished products) from the guest cart and the server cart, and shows
   * the "removed" notice. `authToken` is the session the server cart belongs
   * to (defaults to the provider's). Resolves true when every named line is
   * gone (now or by an earlier call), false when one could not be matched.
   */
  removeUnavailableLines: (refs: UnavailableRef[], authToken?: string | null) => Promise<boolean>;
  /**
   * Asks the API (POST /orders/quote, no destination) whether every line can
   * still be bought and drops the ones that cannot. Cart / checkout load.
   */
  checkCartAvailability: () => Promise<void>;
  /** Lines removed because their product is no longer available (notice). */
  unavailableRemoved: number;
  dismissUnavailableRemoved: () => void;
  /** Hide the hand-off and login-migration notices. */
  dismissPricesNotice: () => void;
  /** Coupon auto-apply (M5.1): the code captured from the URL and what
   *  happened to it; null when nothing was captured or the notice was hidden. */
  couponNotice: CouponAutoApplyNotice | null;
  /** Hides the notice only; a pending code stays pending. */
  dismissCouponNotice: () => void;
  /** Coupon discount on the current lines (`couponDiscount` helper); 0 without a coupon. */
  discount: number;
  /** A campaign-link code waiting to be applied (cart empty or not yet
   *  qualifying: minimum amount / quantity, no matching product); null when none. */
  pendingCouponCode: string | null;
  /** Forgets the pending code (state + storage) and hides its notice. */
  discardPendingCoupon: () => void;
  /** Store the cart (and its coupon) belongs to. */
  storeId: string | undefined;
  /** Markets app: the request market key the cart prices and validates in
   *  (undefined for stores without the app). */
  marketKey: string | undefined;
  /** Market-preview host: `preview` goes with `market` (DRAFT market). */
  marketPreview: boolean;
}

// ── Local-storage helpers (guest cart) ─────────────────

/** A scheduled retry of a coupon request (see COUPON_TRANSIENT_RETRY_MS). */
interface CouponRetry {
  key: string;
  attempts: number;
  waiting: boolean;
}

// Quiet period after a cart change before an applied coupon is re-validated
// (quantity steppers fire several changes; the endpoint is throttled).
const COUPON_REVALIDATE_DELAY_MS = 600;

// Retries after a transient coupon failure (rate limit, 5xx, network drop),
// so a throttled check is repeated once the throttle window has passed even
// when the cart never changes again (add to cart -> straight to checkout).
// After the last one the code waits for the next cart change.
export const COUPON_TRANSIENT_RETRY_MS = [5_000, 15_000, 45_000, 120_000] as const;

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

// The applied coupon is kept per store for guests AND logged-in customers:
// the server cart does not carry a coupon (GET /cart sends none), so the
// browser is where it survives page loads.
//
// A stored coupon is never trusted as-is: its server amount and cart
// signature are dropped in memory, so the re-validation effect checks it
// once per load (expired / deactivated / edited since) and the cart shows
// the live estimate meanwhile. The legacy global `guest_coupon` key (shared
// by every /store/<slug> store on one origin) is only adopted `unverified`:
// it shows no discount and is not exposed until this store validates it.
function loadLocalCoupon(storeId: string | undefined): Coupon | null {
  const store = localStore();
  if (!store) return null;
  try {
    const own = parseStoredCoupon(store.getItem(couponStorageKey(storeId)));
    if (own) return withoutServerFigures(own);
    const legacy = parseStoredCoupon(store.getItem(GUEST_COUPON_KEY));
    return legacy ? { ...withoutServerFigures(legacy), unverified: true } : null;
  } catch {
    return null;
  }
}

/** The coupon without its server amount / cart signature (re-validated before use). */
function withoutServerFigures(c: Coupon): Coupon {
  const out: Coupon = { ...c };
  delete out.cartKey;
  delete out.discountAmount;
  delete out.unverified;
  return out;
}

function saveLocalCoupon(storeId: string | undefined, coupon: Coupon | null) {
  const store = localStore();
  safeStorageWrite(store, couponStorageKey(storeId), coupon ? JSON.stringify(coupon) : null);
  // The legacy key is retired on any write so it can never resurrect a removed coupon.
  safeStorageWrite(store, GUEST_COUPON_KEY, null);
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
    addons?: unknown;
    product_slug?: unknown;
    invalid?: unknown;
    invalid_code?: unknown;
    double_sided?: unknown;
    proof_back_url?: unknown;
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
  // M5.5: the priced add-ons ("Dubbelsidig: +149 kr"), formatted by the server in the cart currency.
  if (Array.isArray(d.addons)) {
    for (const a of d.addons) {
      const v = a as { key?: unknown; label?: unknown; text?: unknown } | null;
      if (v && typeof v.key === 'string' && typeof v.text === 'string' && v.text !== '') {
        display.push({ id: `addon:${v.key}`, label: typeof v.label === 'string' && v.label ? v.label : v.key, value: v.text });
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
      // M5.6: double-sided lines carry their back proof.
      ...(d.double_sided === true
        ? { doubleSided: true, proofBackUrl: typeof d.proof_back_url === 'string' && d.proof_back_url ? d.proof_back_url : null }
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
    const obj = data as { items?: unknown; coupon?: unknown };
    const rawItems: RawCartItem[] = Array.isArray(obj.items) ? obj.items : [];
    return {
      items: rawItems.map(normalizeCartItem),
      // null = the response carries no coupon (GET /cart never does today):
      // callers then keep the locally applied one instead of wiping it.
      coupon: obj.coupon && typeof obj.coupon === 'object' ? parseStoredCoupon(JSON.stringify(obj.coupon)) : null,
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
  /** Market-preview host: `preview=1` goes with `market=` so a DRAFT market
   *  prices the cart (display only; the checkout is disabled there). */
  marketPreview?: boolean;
  /** Store slug (route param): the owner preview / viewer token is per slug. */
  storeSlug?: string;
  /** b2b app (M2-DESIGN D1): `'company'` appends `buyer=company` to every
   *  /cart call so lines carry `tax_rate_bp` and the response a `b2b` net
   *  block. Undefined for persons and stores without the app. */
  buyer?: 'company';
  /** False while the auth provider is still hydrating the session; the
   *  cross-market hand-off waits for it (guest vs customer decision). Defaults
   *  to true so existing callers keep working. */
  authReady?: boolean;
}

export function CartProvider({ children, token, locale, storeId, storeCurrency, storeTax, marketKey, marketPreview, storeSlug, buyer, authReady = true }: CartProviderProps) {
  // Suffix appended to /cart endpoints so the API resolves product titles in
  // the storefront's active language rather than its default ordering (and,
  // for market stores, prices lines for the request market).
  const localeQuery = (() => {
    const params: string[] = [];
    if (locale) params.push(`locale=${encodeURIComponent(locale)}`);
    if (marketKey) params.push(`market=${encodeURIComponent(marketKey)}`);
    if (marketKey && marketPreview) params.push('preview=1');
    if (buyer === 'company') params.push('buyer=company');
    return params.length ? `?${params.join('&')}` : '';
  })();
  // Owner preview of a store that is not LIVE: every cart write carries the
  // owner's preview token (cookie) as the viewer header, so the API lets the
  // owner's pre-live test checkout through. Empty for public visitors.
  // Read at call time (the cookie is set / dropped while the page is open).
  const ownerHeaders = useCallback(() => previewViewerHeaders(storeSlug), [storeSlug]);
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
  // One coupon request at a time (auto-apply or re-validation); `couponTick`
  // re-runs the coupon effects after a request so a cart change made while
  // it was in flight is picked up.
  const couponBusy = useRef(false);
  const [couponTick, setCouponTick] = useState(0);
  // Cart signature of the last attempt that failed softly (min amount /
  // quantity, no matching product, rate limit): the pending code is retried
  // only once the cart differs from it.
  const pendingAttemptKeyRef = useRef<string | null>(null);
  // Transient-failure retries (auto-apply and re-validation): the attempt
  // key (`code|cart`), how many retries ran and whether one is scheduled.
  const applyRetryRef = useRef<CouponRetry | null>(null);
  const revalidateRetryRef = useRef<CouponRetry | null>(null);
  const retryTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timers = retryTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);
  /**
   * Schedules the next retry for `key` after a transient failure. False when
   * the retries are used up (the caller then waits for a cart change).
   */
  const scheduleCouponRetry = useCallback((ref: { current: CouponRetry | null }, key: string): boolean => {
    const attempts = ref.current?.key === key ? ref.current.attempts : 0;
    if (attempts >= COUPON_TRANSIENT_RETRY_MS.length) {
      ref.current = null;
      return false;
    }
    const entry: CouponRetry = { key, attempts: attempts + 1, waiting: true };
    ref.current = entry;
    const id = setTimeout(() => {
      retryTimersRef.current.delete(id);
      entry.waiting = false;
      setCouponTick((n) => n + 1);
    }, COUPON_TRANSIENT_RETRY_MS[attempts]);
    retryTimersRef.current.add(id);
    return true;
  }, []);
  // `coupon` as of the latest commit (read by async coupon work).
  const couponRef = useRef<Coupon | null>(null);
  couponRef.current = coupon;

  /** Sets the applied coupon and persists it per store (guests and customers). */
  const commitCoupon = useCallback((next: Coupon | null) => {
    couponRef.current = next;
    setCoupon(next);
    saveLocalCoupon(storeId, next);
  }, [storeId]);

  /** Mirrors a server cart response. The coupon is only taken over when the
   *  response carries one: GET /cart and the line endpoints send none, and
   *  the locally applied coupon must survive them (logged-in carts). */
  const adoptServerCart = useCallback(
    (cart: { items: CartItem[]; coupon: Coupon | null; tax: CartTax | null }) => {
      setItems(cart.items);
      if (cart.coupon) commitCoupon(cart.coupon);
      setServerTax(cart.tax);
    },
    [commitCoupon],
  );

  const setPendingCode = useCallback((code: string | null) => {
    setPendingCoupon(code);
    safeStorageWrite(localStore(), pendingCouponStorageKey(storeId), code);
    if (code === null) pendingAttemptKeyRef.current = null;
  }, [storeId]);

  /** Reloads the stored coupon of this store (no write). */
  const restoreCoupon = useCallback(() => {
    const stored = loadLocalCoupon(storeId);
    couponRef.current = stored;
    setCoupon(stored);
  }, [storeId]);

  const discardPendingCoupon = useCallback(() => {
    setPendingCode(null);
    setCouponNotice((n) => (n && n.status === 'pending' ? null : n));
  }, [setPendingCode]);

  // ── Guest cart → server cart ────────────────────────
  // The login effect and the checkout sync share one in-flight run (no line
  // is posted twice). Only the lines the server accepted leave localStorage:
  // rejected lines (and lines that failed for another reason) stay local.
  const [moveGuestCart] = useState(() => createGuestCartMover({ load: loadLocalCart, save: saveLocalCart }));
  const migrateLocalCart = useCallback(async (authToken: string): Promise<GuestMigrationResult> => {
    const result = await moveGuestCart((body) =>
      // Owner preview of a store that is not LIVE: the viewer header lets the
      // API accept the owner's pre-live test checkout (empty for visitors).
      api('/cart/items', {
        method: 'POST', token: authToken, headers: ownerHeaders(), body: JSON.stringify(body),
      }),
    );
    if (result.moved.length + result.dropped.length + result.failed.length === 0) return result;
    // The applied coupon is kept: it is stored per store for customers too.
    // A set, not a sum: rejected lines stay local and are retried on the next
    // run, so they must not be counted twice.
    setMigrationDropped(result.dropped.length);
    setMigrationDropError(result.dropped[0]?.error ?? null);
    return result;
  }, [moveGuestCart, ownerHeaders]);

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
  // Logged-in carts live on the server and refetch on their own; their
  // coupon is stored locally, so it is mirrored for them too.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const couponKey = couponStorageKey(storeId);
    const onStorage = (event: StorageEvent) => {
      if (event.key === couponKey) {
        const next = parseStoredCoupon(event.newValue);
        couponRef.current = next;
        setCoupon(next);
        return;
      }
      if (isAuthenticated) return;
      const lines = guestCartFromStorageEvent(event);
      if (lines) setItems(lines);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isAuthenticated, storeId]);

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
            ...(marketPreview ? { preview: true } : {}),
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
  }, [marketKey, marketPreview, authReady, buyer]);

  // ── Initial load + guest cart migration on login ────

  useEffect(() => {
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = token ?? null;

    if (isAuthenticated && token) {
      // The server cart is authoritative now: stop mirroring `items` to storage.
      setGuestLoaded(false);
      // The coupon is kept in the browser for customers too (GET /cart
      // carries none), so it is restored before the server cart arrives.
      restoreCoupon();
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
              adoptServerCart(refreshed);
            } catch {
              adoptServerCart(cart);
            }
          } else {
            adoptServerCart(cart);
          }
        })
        .catch(() => {
          // API failed — fallback to local cart so the user doesn't lose items
          setItems(loadLocalCart());
          restoreCoupon();
          setServerTax(null);
        })
        .finally(() => setLoading(false));
    } else {
      // Guest: load from localStorage
      setItems(loadLocalCart());
      // Logout (a session token went away): the departed customer's coupon
      // must not carry over to the next visitor of a shared device.
      if (typeof prevToken === 'string' && prevToken !== '') commitCoupon(null);
      else restoreCoupon();
      setServerTax(null);
      setLoading(false);
      setGuestLoaded(true);
    }
  }, [isAuthenticated, token, localeQuery, migrateLocalCart, adoptServerCart, restoreCoupon, commitCoupon]);

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
      let trackedMeta = metadata;
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items${localeQuery}`,
          {
            method: 'POST',
            token,
            headers: ownerHeaders(),
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
        adoptServerCart(cart);
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
        // Guests: the validated metadata carries the server-priced unit price.
        trackedMeta = meta;
      }
      // The add is confirmed (server answered / guest line stored): report it
      // to the vendor tags. Every add path goes through here exactly once;
      // quantity changes and design edits of a cart line never do.
      const unitPrice = Number(trackedMeta?.price) || 0;
      trackAddToCart({
        productId,
        name: trackedMeta?.title,
        value: unitPrice * quantity,
        currency: storeCurrency || trackedMeta?.currency || 'EUR',
        quantity,
      });
    },
    [isAuthenticated, token, localeQuery, ownerHeaders, storeCurrency, adoptServerCart]
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
              headers: ownerHeaders(),
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
        adoptServerCart(cart);
      } else {
        setItems((prev) => {
          return prev.map((item) => (item.id === itemId ? { ...item, quantity } : item));
        });
      }
    },
    [isAuthenticated, token, localeQuery, ownerHeaders, adoptServerCart]
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
            headers: ownerHeaders(),
            body: JSON.stringify({ bundle_offer_id: null }),
          }
        );
        const cart = normalizeCartResponse(data);
        adoptServerCart(cart);
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
    [isAuthenticated, token, localeQuery, ownerHeaders, adoptServerCart]
  );

  // ── Remove item ────────────────────────────────────

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items/${itemId}${localeQuery}`,
          { method: 'DELETE', token, headers: ownerHeaders() }
        );
        const cart = normalizeCartResponse(data);
        adoptServerCart(cart);
      } else {
        setItems((prev) => {
          return prev.filter((item) => item.id !== itemId);
        });
      }
    },
    [isAuthenticated, token, localeQuery, ownerHeaders, adoptServerCart]
  );

  // ── Designer lines ─────────────────────────────────

  const refreshDesignLine = useCallback(
    async (designId: string, patch: DesignLinePatch) => {
      if (isAuthenticated && token) {
        // The server block carries the new text values and a fresh proof.
        const data = await api<unknown>(`/cart${localeQuery}`, { token });
        const cart = normalizeCartResponse(data);
        adoptServerCart(cart);
        return;
      }
      setItems((prev) => {
        return patchGuestDesignLine(prev, designId, patch);
      });
    },
    [isAuthenticated, token, localeQuery, adoptServerCart]
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
          headers: ownerHeaders(),
          body: JSON.stringify(
            guestLineToServerBody({
              ...line,
              productId: line.customProductId || line.productId,
              designId: nextDesign.id,
              designToken: nextDesign.token ?? undefined,
            }),
          ),
        });
        const data = await api<unknown>(`/cart/items/${line.id}${localeQuery}`, { method: 'DELETE', token, headers: ownerHeaders() });
        const cart = normalizeCartResponse(data);
        adoptServerCart(cart);
        return;
      }
      setItems((prev) => {
        return replaceGuestDesignLine(prev, oldDesignId, nextDesign);
      });
    },
    [isAuthenticated, token, localeQuery, items, ownerHeaders, adoptServerCart]
  );

  // ── Clear cart ─────────────────────────────────────

  const clearCart = useCallback(async () => {
    if (isAuthenticated && token) {
      try {
        await api('/cart', { method: 'DELETE', token, headers: ownerHeaders() });
      } catch {
        // Clear local state even if API fails
      }
    }
    setItems([]);
    commitCoupon(null);
    setServerTax(null);
    setPricesUpdated(false);
    setHandoffDropped(0);
    setMigrationDropped(0);
    setMigrationDropError(null);
    // Also for logged-in customers (the guest effect does not run for them).
    saveLocalCart([]);
  }, [isAuthenticated, token, ownerHeaders, commitCoupon]);

  // ── Coupon auto-apply: capture from the URL ─────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hit = couponAutoapply ? captureCouponFromSearch(window.location.search, checkoutSettings) : null;
    if (hit) {
      const url = new URL(window.location.href);
      url.search = hit.search;
      window.history.replaceState(window.history.state, '', url.toString());
      setPendingCode(hit.code);
      setCouponNotice({ code: hit.code, status: 'pending' });
      return;
    }
    // A code captured on an earlier page load that could not be applied yet
    // (empty or not yet qualifying cart) is still waiting.
    try {
      const stored = localStore()?.getItem(pendingCouponStorageKey(storeId)) ?? null;
      if (stored && !couponAutoapply) {
        // The merchant turned auto-apply off since: a captured code must not
        // apply itself any more.
        setPendingCode(null);
        return;
      }
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

  // Latest lines for async coupon work (validation always prices the cart
  // as it is when the request goes out).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /**
   * POST /promotions/validate-coupon for `lines`, the same inputs the order
   * path validates with (subtotal, item count, product ids and per-line
   * totals, so a targeted coupon is priced on its lines only). Resolves with
   * the coupon to apply; throws the API error otherwise.
   */
  const validateCouponFor = useCallback(
    async (code: string, lines: CartItem[]): Promise<Coupon> => {
      const subtotalNow = sumLineTotals(lines);
      const lineTotals = couponLineTotals(lines);
      const validation = await api<{
        valid: boolean;
        type: string;
        value: number;
        /** 'percentage' | 'fixed' | null (no line discount); absent from older APIs (type decides). */
        discount_kind?: 'percentage' | 'fixed' | null;
        discount_amount: number;
        free_shipping: boolean;
        /** Optional: targeted product ids / flag when the API sends them. */
        product_ids?: unknown;
        targeted?: unknown;
      }>('/promotions/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({
          coupon_code: code,
          store_id: storeId,
          subtotal: subtotalNow,
          item_count: availableLines(lines).reduce((sum, i) => sum + i.quantity, 0),
          product_ids: availableLines(lines).map((i) => i.customProductId || i.productId).filter(Boolean),
          line_totals: lineTotals,
          // Market stores: the subtotal is in the market currency; the API
          // converts so a fixed coupon is charged in that currency too.
          ...(marketKey ? { market: marketKey, ...(marketPreview ? { preview: true } : {}) } : {}),
        }),
      });

      const hasKind = validation.discount_kind !== undefined;
      const kind: 'percentage' | 'fixed' | null = hasKind
        ? validation.discount_kind ?? null
        : validation.type === 'PERCENTAGE' || validation.type === 'COUPON'
          ? 'percentage'
          : null;
      const amount = Number(validation.discount_amount) || 0;
      const value = Number(validation.value) || 0;
      // Percentage: the rate. Fixed (current API): the face value, capped per
      // cart by the helper. No kind (free shipping / older API fixed): the
      // amount the server computed.
      const discount = kind === 'percentage' ? value : kind === 'fixed' ? value : amount;
      const productIds = Array.isArray(validation.product_ids)
        ? validation.product_ids.filter((x): x is string => typeof x === 'string' && x !== '')
        : undefined;
      const targeted =
        typeof validation.targeted === 'boolean'
          ? validation.targeted
          : productIds && productIds.length > 0
            ? true
            : kind && lineTotals.length > 0
              ? inferTargeted(kind, value, amount, subtotalNow)
              : undefined;
      return {
        code,
        discount,
        type: kind === 'percentage' ? 'percentage' : 'fixed',
        freeShipping: validation.free_shipping === true,
        discountAmount: amount,
        cartKey: couponCartKey(lines),
        ...(targeted !== undefined ? { targeted } : {}),
        ...(productIds && productIds.length > 0 ? { productIds } : {}),
      };
    },
    [storeId, marketKey, marketPreview],
  );

  /** Validates, applies and persists `code` for the current lines. */
  const applyCouponNow = useCallback(
    async (code: string) => {
      const couponData = await validateCouponFor(code, itemsRef.current);

      if (isAuthenticated && token) {
        // Also persist in server cart session
        try {
          await api('/cart/apply-coupon', {
            method: 'POST',
            token,
            headers: ownerHeaders(),
            body: JSON.stringify({ coupon_code: code }),
          });
        } catch {
          // Non-critical: coupon is sent with order anyway
        }
      }

      commitCoupon(couponData);
    },
    [isAuthenticated, token, ownerHeaders, validateCouponFor, commitCoupon],
  );

  // Typed by the shopper: a link code still waiting would later replace it,
  // so the pending code goes (it is the same code or the shopper chose another).
  const applyCoupon = useCallback(
    async (code: string) => {
      await applyCouponNow(code);
      if (pendingCoupon !== null) discardPendingCoupon();
    },
    [applyCouponNow, pendingCoupon, discardPendingCoupon],
  );

  // ── Coupon auto-apply: apply once the cart qualifies ──
  // Soft failures (minimum amount / quantity, no matching product, rate
  // limit) keep the code pending and retry after the cart changes; only a
  // hard failure (unknown, inactive, expired, used up) discards it.
  const applyCouponNowRef = useRef(applyCouponNow);
  applyCouponNowRef.current = applyCouponNow;
  useEffect(() => {
    if (!pendingCoupon || loading || couponBusy.current) return;
    if (availableLines(items).length === 0) return;
    const cartKey = couponCartKey(items);
    if (pendingAttemptKeyRef.current === cartKey) return;
    const code = pendingCoupon;
    const retryKey = `${code}|${cartKey}`;
    if (applyRetryRef.current?.key === retryKey && applyRetryRef.current.waiting) return;
    const current = couponRef.current?.code;
    if (current && current.toUpperCase() === code.toUpperCase()) {
      setPendingCode(null);
      setCouponNotice({ code, status: 'applied' });
      return;
    }
    couponBusy.current = true;
    (async () => {
      try {
        await applyCouponNowRef.current(code);
        applyRetryRef.current = null;
        setPendingCode(null);
        setCouponNotice({ code, status: 'applied' });
      } catch (err) {
        const kind = classifyCouponError(err);
        if (kind === 'hard') {
          applyRetryRef.current = null;
          setPendingCode(null);
          setCouponNotice({ code, status: 'invalid' });
        } else if (kind === 'transient' && scheduleCouponRetry(applyRetryRef, retryKey)) {
          // Retried on a timer (the cart may never change again); a hidden
          // notice stays hidden.
        } else {
          // Soft, or transient with the retries used up: kept for the next
          // cart change.
          applyRetryRef.current = null;
          pendingAttemptKeyRef.current = cartKey;
        }
      } finally {
        couponBusy.current = false;
        setCouponTick((n) => n + 1);
      }
    })();
  }, [pendingCoupon, loading, items, couponTick, setPendingCode, scheduleCouponRetry]);

  // ── Applied coupon: re-validate when the lines change ──
  // The order path re-validates the coupon against the cart it is placed
  // with, so the cart re-checks it too: a fresh server amount for the new
  // lines, and a coupon the cart no longer qualifies for is taken off
  // (back to pending on a soft failure) instead of showing a discount the
  // order would reject.
  const revalidateSkipRef = useRef<string | null>(null);
  useEffect(() => {
    if (!coupon || loading || couponBusy.current) return;
    if (availableLines(items).length === 0) return;
    const cartKey = couponCartKey(items);
    if (coupon.cartKey === cartKey) return;
    const code = coupon.code;
    if (revalidateSkipRef.current === `${code}|${cartKey}`) return;
    const retry = revalidateRetryRef.current;
    if (retry?.key === `${code}|${cartKey}` && retry.waiting) return;
    const timer = setTimeout(() => {
      if (couponBusy.current) return;
      couponBusy.current = true;
      const lines = itemsRef.current;
      const linesKey = couponCartKey(lines);
      (async () => {
        try {
          const next = await validateCouponFor(code, lines);
          // Removed or replaced meanwhile: the newer state wins.
          if (couponRef.current?.code !== code) return;
          revalidateRetryRef.current = null;
          commitCoupon(next);
        } catch (err) {
          if (couponRef.current?.code !== code) return;
          const kind = classifyCouponError(err);
          if (kind === 'transient') {
            // Rate limit / server / network error: keep the coupon and retry
            // on a timer; once the retries are used up, wait for a cart change.
            if (!scheduleCouponRetry(revalidateRetryRef, `${code}|${linesKey}`)) {
              revalidateSkipRef.current = `${code}|${linesKey}`;
            }
            return;
          }
          revalidateRetryRef.current = null;
          // A legacy coupon (shared `guest_coupon` key) was never shown in
          // this store: when it does not apply here it goes without a notice.
          const legacy = couponRef.current?.unverified === true;
          commitCoupon(null);
          if (legacy) {
            if (kind === 'soft') {
              setPendingCode(code);
              pendingAttemptKeyRef.current = linesKey;
            }
            return;
          }
          if (kind === 'soft') {
            setPendingCode(code);
            pendingAttemptKeyRef.current = linesKey;
            setCouponNotice({ code, status: 'pending' });
          } else {
            setCouponNotice({ code, status: 'invalid' });
          }
        } finally {
          couponBusy.current = false;
          setCouponTick((n) => n + 1);
        }
      })();
    }, COUPON_REVALIDATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [coupon, loading, items, couponTick, validateCouponFor, commitCoupon, setPendingCode, scheduleCouponRetry]);

  // ── Remove coupon ──────────────────────────────────
  // Client-side only as far as the cart is concerned: the server endpoint
  // answers with a bare message (no cart), so its response never touches the
  // lines or the tax figures.
  const removeCoupon = useCallback(async () => {
    commitCoupon(null);
    if (isAuthenticated && token) {
      try {
        await api<unknown>(`/cart/remove-coupon${localeQuery}`, { method: 'DELETE', token, headers: ownerHeaders() });
      } catch {
        // Non-critical: the order only uses the coupon the cart sends.
      }
    }
  }, [isAuthenticated, token, localeQuery, ownerHeaders, commitCoupon]);

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

  // One discount formula for every surface (cart, drawer, checkout).
  const discount = useMemo(() => couponDiscount(coupon, items), [coupon, items]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  // ── Unavailable (deleted / unpublished) lines ───────

  const [unavailableRemoved, setUnavailableRemoved] = useState(0);
  // Line ids removed (the notice counts each line once, even when the load
  // probe and a checkout call report the same product) and the entries that
  // were resolved by a removal.
  const removedLineIdsRef = useRef<Set<string>>(new Set());
  const resolvedRefsRef = useRef<Set<string>>(new Set());
  const dismissUnavailableRemoved = useCallback(() => {
    removedLineIdsRef.current = new Set();
    setUnavailableRemoved(0);
  }, []);

  const removeUnavailableLines = useCallback(
    async (refs: UnavailableRef[], authToken?: string | null): Promise<boolean> => {
      const jwt = authToken ?? token ?? null;
      const removedNow: CartItem[] = [];
      // A named line is still in the cart (a DELETE failed / cart unreadable).
      let remaining = false;
      // Guest lines in storage (also lines a checkout sync left behind).
      const stored = loadLocalCart();
      const goneStored = unavailableLines(stored, refs);
      if (goneStored.length > 0) {
        saveLocalCart(withoutUnavailable(stored, refs));
        removedNow.push(...goneStored);
      }
      if (jwt) {
        try {
          let cart = normalizeCartResponse(await api<unknown>(`/cart${localeQuery}`, { token: jwt }));
          for (const line of unavailableLines(cart.items, refs)) {
            try {
              cart = normalizeCartResponse(
                await api<unknown>(`/cart/items/${line.id}${localeQuery}`, { method: 'DELETE', token: jwt, headers: ownerHeaders() }),
              );
              removedNow.push(line);
            } catch { /* the next quote / order call reports it again */ }
          }
          if (unavailableLines(cart.items, refs).length > 0) remaining = true;
          if (isAuthenticated && jwt === token) {
            adoptServerCart(cart);
          } else if (!isAuthenticated) {
            // The session was created mid-checkout and the provider has not
            // switched yet: keep the in-memory guest lines in step.
            setItems((prev) => withoutUnavailable(prev, refs));
          }
        } catch {
          // Cart unreadable: nothing more can be removed here.
          remaining = true;
        }
      } else {
        removedNow.push(...unavailableLines(items, refs));
        setItems((prev) => withoutUnavailable(prev, refs));
      }
      for (const ref of refs) {
        if (removedNow.some((line) => lineMatchesUnavailable(line, ref))) resolvedRefsRef.current.add(unavailableRefKey(ref));
      }
      if (removedNow.length > 0) {
        for (const line of removedNow) removedLineIdsRef.current.add(line.id);
        setUnavailableRemoved(removedLineIdsRef.current.size);
      }
      // Resolved when no named line is left and each was removed now or
      // before (the load probe and a stale quote can report the same product).
      return refs.length > 0 && !remaining && refs.every((ref) => resolvedRefsRef.current.has(unavailableRefKey(ref)));
    },
    [token, isAuthenticated, localeQuery, items, ownerHeaders, adoptServerCart],
  );

  const checkCartAvailability = useCallback(async () => {
    // Lines hidden in the market are flagged by GET /cart already; the probe
    // checks the others (a market rejection would hide a deleted product).
    const probeLines = availableLines(items);
    if (!storeId || probeLines.length === 0) return;
    try {
      await api('/orders/quote', {
        method: 'POST',
        token: token ?? undefined,
        headers: storeSlug
          ? checkoutViewerHeaders(storeSlug, { editHintToken: readEditHintToken(), sessionToken: token ?? null })
          : {},
        body: JSON.stringify({
          store_id: storeId,
          ...(marketKey ? { market_key: marketKey, ...(marketPreview ? { preview: true } : {}) } : {}),
          // A logged-in quote prices the server cart; a guest sends its lines.
          ...(token ? {} : { lines: toKustomCartLines(probeLines) }),
          ...(locale ? { locale } : {}),
        }),
      });
    } catch (err) {
      const refs = readUnavailableError(err);
      if (refs && refs.length > 0) await removeUnavailableLines(refs);
      // Any other answer (no destination yet, market rules...) is the
      // checkout's business; the probe only drops lines that are gone.
    }
  }, [storeId, items, token, storeSlug, marketKey, marketPreview, locale, removeUnavailableLines]);

  // ── Sync guest cart to server (for checkout) ────────

  const syncGuestCartToServer = useCallback(async (authToken: string): Promise<DroppedGuestLine[]> => {
    // Lines in flight stay in localStorage, so an empty store means nothing to move.
    if (loadLocalCart().length === 0) return [];

    const { dropped } = await migrateLocalCart(authToken);

    // Refresh cart from server
    try {
      const data = await api<unknown>(`/cart${localeQuery}`, { token: authToken });
      const cart = normalizeCartResponse(data);
      adoptServerCart(cart);
    } catch {
      // Keep current state
    }
    return dropped;
  }, [localeQuery, migrateLocalCart, adoptServerCart]);

  // ── Tax (server-computed; guest carts carry no figures) ─

  const currency = storeCurrency || items[0]?.currency || 'EUR';
  const taxPricingMode: TaxPricingMode =
    serverTax?.pricingMode ?? storeTax?.pricing_mode ?? 'INCLUSIVE';
  // The server cart carries no coupon, so its tax lines, tax-inclusive total
  // and b2b net block are computed without the discount. With a discount
  // they are not shown (tax at checkout / the cart's own net estimate),
  // never a coupon-less figure next to a discounted total.
  const cartTax = serverTax && !(discount > 0) ? serverTax : null;
  const taxLines = cartTax?.lines ?? EMPTY_TAX_LINES;
  const taxTotal = cartTax?.total ?? 0;
  // A guest cart (or an API without tax figures) is always an estimate.
  const taxEstimated = cartTax ? cartTax.estimated : true;
  const totalWithTax = useMemo(() => {
    if (taxPricingMode === 'INCLUSIVE') return total;
    if (cartTax?.totalWithTax !== null && cartTax?.totalWithTax !== undefined) return cartTax.totalWithTax;
    // EXCLUSIVE with lines but no explicit figure: add the tax on top.
    if (cartTax && cartTax.lines.length > 0) return total + cartTax.total;
    return null;
  }, [taxPricingMode, total, cartTax]);

  // ── Company view net figures (b2b app) ──────────────
  const b2bNet = cartTax?.b2b ?? null;
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
    // A legacy coupon still being validated for this store is not applied
    // yet: no surface shows it and no quote / order sends it.
    coupon: coupon?.unverified ? null : coupon,
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
    removeUnavailableLines,
    checkCartAvailability,
    unavailableRemoved,
    dismissUnavailableRemoved,
    dismissPricesNotice,
    couponNotice,
    dismissCouponNotice,
    discount,
    pendingCouponCode: pendingCoupon,
    discardPendingCoupon,
    storeId,
    marketKey,
    marketPreview: Boolean(marketPreview),
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