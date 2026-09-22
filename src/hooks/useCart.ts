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
import {
  normalizeTaxLines,
  normalizeTaxPricingMode,
  sumTaxLines,
  type StoreTaxConfig,
  type TaxLine,
  type TaxPricingMode,
} from '@/lib/tax';

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
}

export interface CartCustomFieldDisplay {
  id: string;
  label: string;
  value: unknown;
  /** Translated option label when the value is one of the field's options. */
  display?: string | null;
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
  /** Migrate localStorage cart items to the server and return the server cart */
  syncGuestCartToServer: (authToken: string) => Promise<void>;
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
}

// ── Local-storage helpers (guest cart) ─────────────────

const CART_KEY = 'guest_cart';
const COUPON_KEY = 'guest_coupon';
// Stable reference so consumers' effects don't re-run on every render.
const EMPTY_TAX_LINES: TaxLine[] = [];

function loadLocalCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function loadLocalCoupon(): Coupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUPON_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalCoupon(coupon: Coupon | null) {
  if (coupon) {
    localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
  } else {
    localStorage.removeItem(COUPON_KEY);
  }
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
}

function normalizeCartItem(raw: RawCartItem): CartItem {
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
    customFieldDisplay: Array.isArray(raw.customFieldDisplay)
      ? raw.customFieldDisplay
      : Array.isArray(raw.custom_field_display)
      ? raw.custom_field_display
      : undefined,
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
}

export function CartProvider({ children, token, locale, storeId, storeCurrency, storeTax }: CartProviderProps) {
  // Suffix appended to /cart endpoints so the API resolves product titles in
  // the storefront's active language rather than its default ordering.
  const localeQuery = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [serverTax, setServerTax] = useState<CartTax | null>(null);
  const [loading, setLoading] = useState(true);
  const prevTokenRef = useRef<string | null | undefined>(undefined);

  const isAuthenticated = Boolean(token);

  // ── Initial load + guest cart migration on login ────

  useEffect(() => {
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = token ?? null;

    if (isAuthenticated && token) {
      // Check if we just transitioned from guest to authenticated
      const wasGuest = prevToken === null || prevToken === undefined;
      const guestItems = wasGuest ? loadLocalCart() : [];

      // Fetch server cart
      api<unknown>(`/cart${localeQuery}`, { token })
        .then(async (data) => {
          const cart = normalizeCartResponse(data);

          // Migrate guest cart items to the server if any
          if (guestItems.length > 0) {
            for (const item of guestItems) {
              try {
                const isCustom = Boolean(item.customProductId);
                await api('/cart/items', {
                  method: 'POST',
                  token,
                  body: JSON.stringify({
                    product_id: isCustom ? null : item.productId,
                    custom_product_id: isCustom ? item.productId : undefined,
                    variant_id: item.variantId || null,
                    bundle_offer_id: item.bundleOfferId || undefined,
                    quantity: item.quantity,
                    custom_fields: item.customFields,
                  }),
                });
              } catch {
                // Skip items that fail to migrate
              }
            }
            // Clear local storage after migration
            saveLocalCart([]);
            saveLocalCoupon(null);

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
    }
  }, [isAuthenticated, token, localeQuery]);

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
              custom_fields: customFields,
            }),
          }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        setItems((prev) => {
          const idx = prev.findIndex(
            (i) =>
              i.productId === productId &&
              i.variantId === (variantId ?? undefined) &&
              (i.bundleOfferId ?? null) === (bundleOfferId ?? null),
          );
          let next: CartItem[];
          if (idx >= 0) {
            next = prev.map((item, i) =>
              i === idx ? { ...item, quantity: item.quantity + quantity } : item
            );
          } else {
            const newItem: CartItem = {
              id: `local_${Date.now()}`,
              productId,
              variantId: variantId ?? undefined,
              customProductId: metadata?.customProductId,
              title: metadata?.title,
              price: metadata?.price ?? 0,
              quantity,
              imageUrl: metadata?.imageUrl,
              variant: metadata?.variant,
              customerFile: metadata?.customerFile,
              currency: metadata?.currency,
              customFields,
              customFieldDisplay: metadata?.customFieldDisplay,
              bundleOfferId: bundleOfferId ?? null,
              bundleOriginalUnitPrice: metadata?.bundleOriginalUnitPrice ?? null,
              bundleTitle: metadata?.bundleTitle ?? null,
              bundleLabel: metadata?.bundleLabel ?? null,
              bundleStickerText: metadata?.bundleStickerText ?? null,
              bundleCartQuantity: metadata?.bundleCartQuantity ?? null,
            };
            next = [...prev, newItem];
          }
          saveLocalCart(next);
          return next;
        });
      }
    },
    [isAuthenticated, token, localeQuery]
  );

  // ── Update quantity ────────────────────────────────

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (isAuthenticated && token) {
        const data = await api<unknown>(
          `/cart/items/${itemId}${localeQuery}`,
          {
            method: 'PUT',
            token,
            body: JSON.stringify({ quantity }),
          }
        );
        const cart = normalizeCartResponse(data);
        setItems(cart.items);
        setCoupon(cart.coupon);
        setServerTax(cart.tax);
      } else {
        setItems((prev) => {
          const next = prev.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          );
          saveLocalCart(next);
          return next;
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
          const next = prev.map((item) => {
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
          saveLocalCart(next);
          return next;
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
          const next = prev.filter((item) => item.id !== itemId);
          saveLocalCart(next);
          return next;
        });
      }
    },
    [isAuthenticated, token, localeQuery]
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
    saveLocalCart([]);
    saveLocalCoupon(null);
  }, [isAuthenticated, token, localeQuery]);

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
          subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
          item_count: items.reduce((sum, i) => sum + i.quantity, 0),
          product_ids: items.map((i) => i.customProductId || i.productId).filter(Boolean),
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

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
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

  const syncGuestCartToServer = useCallback(async (authToken: string) => {
    const guestItems = loadLocalCart();
    if (guestItems.length === 0) return;

    // Clear localStorage BEFORE async API calls to prevent CartProvider's
    // useEffect from reading the same items and double-syncing them.
    saveLocalCart([]);
    saveLocalCoupon(null);

    for (const item of guestItems) {
      try {
        const isCustom = Boolean(item.customProductId);
        await api('/cart/items', {
          method: 'POST',
          token: authToken,
          body: JSON.stringify({
            product_id: isCustom ? null : item.productId,
            custom_product_id: isCustom ? item.productId : undefined,
            variant_id: item.variantId || null,
            bundle_offer_id: item.bundleOfferId || undefined,
            quantity: item.quantity,
            custom_fields: item.customFields,
          }),
        });
      } catch {
        // Skip items that fail
      }
    }

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
  }, [localeQuery]);

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
    itemCount,
    subtotal,
    total,
    currency,
    taxLines,
    taxTotal,
    taxPricingMode,
    taxEstimated,
    totalWithTax,
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