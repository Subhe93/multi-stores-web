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
import { includedTax } from '@/lib/tax';

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
  customFields?: Record<string, any>;
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

/** VAT figures the cart API returns for the cart's store (GET /cart). */
interface CartTax {
  rateBp: number;
  /** Null when the API only sent the rate. */
  amount: number | null;
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
    customFields?: Record<string, any>,
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
  /** Resolved VAT rate in basis points (server cart > store > 0). Prices are
   *  tax inclusive, so this only drives the informational "Includes VAT" line. */
  taxRateBp: number;
  /** VAT included in `total` — the API's figure when it sent one, else computed. */
  taxAmount: number;
}

// ── Local-storage helpers (guest cart) ─────────────────

const CART_KEY = 'guest_cart';
const COUPON_KEY = 'guest_coupon';

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
function normalizeCartItem(raw: any): CartItem {
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

// `tax_rate_bp` / `tax_amount` are optional on GET /cart (older API builds
// omit them); a missing rate means "fall back to the store's rate".
function normalizeCartTax(data: unknown): CartTax | null {
  const raw = (data ?? {}) as Record<string, unknown>;
  const rate = Number(raw.tax_rate_bp ?? raw.taxRateBp);
  if (!Number.isFinite(rate)) return null;
  const rawAmount = raw.tax_amount ?? raw.taxAmount;
  const amount = rawAmount === undefined || rawAmount === null ? NaN : Number(rawAmount);
  return { rateBp: rate, amount: Number.isFinite(amount) ? amount : null };
}

function normalizeCartResponse(data: any): { items: CartItem[]; coupon: Coupon | null; tax: CartTax | null } {
  if (Array.isArray(data)) {
    return { items: data.map(normalizeCartItem), coupon: null, tax: null };
  }
  if (data && typeof data === 'object') {
    const rawItems = Array.isArray(data.items) ? data.items : [];
    return {
      items: rawItems.map(normalizeCartItem),
      coupon: data.coupon ?? null,
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
  /** The store's resolved VAT rate (basis points) from `storefront.getStore`;
   *  used until / unless the cart API reports its own. */
  storeTaxRateBp?: number | null;
}

export function CartProvider({ children, token, locale, storeId, storeCurrency, storeTaxRateBp }: CartProviderProps) {
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
      api<any>(`/cart${localeQuery}`, { token })
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
                await api<any>(`/cart${localeQuery}`, { token })
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
      customFields?: Record<string, any>,
      metadata?: CartItemMetadata,
    ) => {
      const isCustomProduct = Boolean(metadata?.customProductId);
      const bundleOfferId = metadata?.bundleOfferId || undefined;
      if (isAuthenticated && token) {
        const data = await api<any>(
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
        const data = await api<any>(
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
        const data = await api<any>(
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
        const data = await api<any>(
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
        const data = await api<any>(
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
      const data = await api<any>(`/cart${localeQuery}`, { token: authToken });
      const cart = normalizeCartResponse(data);
      setItems(cart.items);
      setCoupon(cart.coupon);
      setServerTax(cart.tax);
    } catch {
      // Keep current state
    }
  }, [localeQuery]);

  // ── Tax (informational — prices are tax inclusive) ─

  const currency = storeCurrency || items[0]?.currency || 'EUR';
  const taxRateBp = serverTax?.rateBp ?? storeTaxRateBp ?? 0;
  const taxAmount = useMemo(() => {
    // Prefer the API's figure when it matches the rate we display; otherwise
    // derive it from the total shown (guest carts, older API builds).
    if (serverTax && serverTax.amount !== null && serverTax.rateBp === taxRateBp) {
      return serverTax.amount;
    }
    return includedTax(total, taxRateBp, currency);
  }, [serverTax, taxRateBp, total, currency]);

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
    taxRateBp,
    taxAmount,
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