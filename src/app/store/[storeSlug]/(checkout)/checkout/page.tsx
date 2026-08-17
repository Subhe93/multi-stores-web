'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Lock, Loader2, ShoppingBag, ChevronDown, ChevronUp, Tag, X, ChevronRight, MapPin, Plus, Check } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { api, storefront, resolveMediaUrl } from '@/lib/api';
import { getStripe } from '@/lib/stripe';
import { formatPrice } from '@/lib/format';
import { validateEmail, validatePhone } from '@/lib/validators';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddressResponse { id: string }
interface OrderResponse { id: string; order_number?: string }
interface PaymentConfig { stripeConfigured: boolean; publishableKey: string | null; stripeAccount: string | null }
interface SavedAddress {
  id: string;
  full_name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  phone?: string;
  is_default?: boolean;
}

const COUNTRIES = [
  { code: 'DE', name: 'Germany' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'FR', name: 'France' },
  { code: 'TR', name: 'Turkey' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SE', name: 'Sweden' },
  { code: 'NL', name: 'Netherlands' }, { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' }, { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'EG', name: 'Egypt' },
  { code: 'JO', name: 'Jordan' }, { code: 'KW', name: 'Kuwait' },
  { code: 'QA', name: 'Qatar' }, { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' }, { code: 'IQ', name: 'Iraq' },
  { code: 'LB', name: 'Lebanon' },
];

// ── Store slug resolution ─────────────────────────────────────────────────────
// Resolve store slug from subdomain (usePathname returns the user-visible URL
// after middleware rewrite, e.g. "/checkout" not "/store/ahmed-design/checkout",
// so we must read from the hostname instead).
const PLATFORM_DOMAINS = ['localhost', 'platform.com', 'www.platform.com'];
function resolveStoreSlug(pathname: string): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (PLATFORM_DOMAINS.includes(hostname)) return '';
    const parts = hostname.split('.');
    return parts.length >= 2 ? parts[0]! : '';
  }
  return pathname.match(/\/store\/([^/]+)/)?.[1] || '';
}

// Build the payment-config endpoint, scoped to the current store when known so
// the API can return the store's connected-account details (independent stores).
function paymentConfigPath(storeSlug: string): string {
  return storeSlug
    ? `/payments/config?store=${encodeURIComponent(storeSlug)}`
    : '/payments/config';
}

// ── Input style helper ────────────────────────────────────────────────────────
const inputCls = (err?: boolean) =>
  `w-full border rounded-md px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 transition focus:outline-none focus:ring-2 ${
    err
      ? 'border-red-400 focus:ring-red-500/20 focus:border-red-400'
      : 'border-gray-300 focus:ring-blue-500/20 focus:border-blue-500'
  }`;

// ── Field label ───────────────────────────────────────────────────────────────
function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <h2 className={`text-base font-semibold text-gray-900 pb-3 border-b border-gray-200 mb-4 ${first ? 'pt-0' : 'pt-6'}`}>
      {children}
    </h2>
  );
}

// ── Order Summary Sidebar (right panel) ──────────────────────────────────────
interface OrderSummaryProps {
  items: Array<{
    id: string; title?: string; name?: string; price: number; quantity: number;
    imageUrl?: string; image?: string; variant?: string; currency?: string;
    bundleOfferId?: string | null;
    bundleOriginalUnitPrice?: number | null;
    bundleTitle?: string | null;
    bundleLabel?: string | null;
    bundleStickerText?: string | null;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  coupon: { code: string; type: string; discount: number; freeShipping?: boolean } | null;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponLoading: boolean;
  couponError: string;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  shippingCost: number | null;
  shippingEstimate: { min: number; max: number } | null;
  shippingLoading: boolean;
  shippingError: string;
  effectiveShipping: number;
  t: (key: string) => string;
}

function OrderSummary({
  items, subtotal, discount, total, currency,
  coupon, couponCode, setCouponCode, couponLoading, couponError,
  onApplyCoupon, onRemoveCoupon,
  shippingCost, shippingEstimate, shippingLoading, shippingError, effectiveShipping,
  t,
}: OrderSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Item list */}
      <div className="space-y-3">
        {items.map((item) => {
          const img = resolveMediaUrl(item.imageUrl || item.image);
          const title = item.title || item.name || 'Product';
          const lineTotal = item.price * item.quantity;
          const originalUnit =
            typeof item.bundleOriginalUnitPrice === 'number'
              ? item.bundleOriginalUnitPrice
              : null;
          const originalLineTotal =
            originalUnit !== null ? originalUnit * item.quantity : null;
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-white">
                  {img ? (
                    <img src={img} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-600 text-white text-[10px] font-bold flex items-center justify-center z-10">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug line-clamp-2">{title}</p>
                {item.variant && <p className="text-xs text-gray-500">{item.variant}</p>}
                {item.bundleOfferId && (
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      <Tag className="w-2.5 h-2.5" />
                      {item.bundleTitle || 'Bundle'}
                      {item.bundleLabel ? ` · ${item.bundleLabel}` : ''}
                    </span>
                    {item.bundleStickerText && (
                      <span className="inline-flex items-center rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {item.bundleStickerText}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {formatPrice(lineTotal, currency)}
                </p>
                {originalLineTotal !== null && originalLineTotal > lineTotal && (
                  <p className="text-[10px] text-gray-400 line-through tabular-nums">
                    {formatPrice(originalLineTotal, currency)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-1">
        {/* Coupon input */}
        {coupon?.code ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-green-600" />
              <span className="text-sm font-medium text-green-700">{coupon.code}</span>
            </div>
            <button
              type="button"
              onClick={onRemoveCoupon}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onApplyCoupon(); } }}
                placeholder={t('cart.couponPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              />
            </div>
            <button
              type="button"
              onClick={onApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-40 transition flex items-center gap-1 shrink-0"
            >
              {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('cart.applyCoupon')}
            </button>
          </div>
        )}
        {couponError && <p className="text-xs text-red-500 mb-2">{couponError}</p>}

        {/* Price rows */}
        <div className="flex justify-between text-sm py-1">
          <span className="text-gray-600">{t('cart.subtotal')}</span>
          <span className="text-gray-900 font-medium">{formatPrice(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-gray-600">{t('cart.shipping')}</span>
          <span className={`font-medium ${effectiveShipping === 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {shippingLoading ? '...'
              : coupon?.freeShipping ? t('checkout.freeShippingLabel')
              : shippingCost === null ? t('cart.calculatedAtCheckout')
              : shippingCost === 0 ? t('checkout.freeShippingLabel')
              : formatPrice(shippingCost, currency)}
          </span>
        </div>
        {shippingEstimate && !coupon?.freeShipping && shippingCost !== null && shippingCost > 0 && (
          <p className="text-xs text-gray-500 text-right -mt-1">{shippingEstimate.min}-{shippingEstimate.max} {t('checkout.businessDays')}</p>
        )}
        {shippingError && (
          <p className="text-xs text-red-500 mt-1">{shippingError}</p>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-green-600">{t('cart.discount')}</span>
            <span className="text-green-600 font-medium">-{formatPrice(discount, currency)}</span>
          </div>
        )}

        <div className="flex justify-between pt-3 border-t border-gray-200 mt-1">
          <span className="text-base font-semibold text-gray-900">{t('cart.total')}</span>
          <span className="text-base font-bold text-gray-900">{formatPrice(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Checkout Form ─────────────────────────────────────────────────────────────
function CheckoutForm() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const lp = useLocalePath();
  const stripe = useStripe();
  const elements = useElements();
  const { token, user, login, register } = useAuth();
  const { items, subtotal, total, coupon, currency, clearCart, applyCoupon, removeCoupon, syncGuestCartToServer } = useCart();

  const storeSlug = resolveStoreSlug(pathname);

  // ── State ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '',
    line1: '', line2: '', city: '', state: '',
    postal_code: '', country_code: '', phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe'>('cod');
  const [stripeAvailable, setStripeAvailable] = useState(false);
  // Cash on delivery is opt-in per store (off by default server-side).
  const [codAvailable, setCodAvailable] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  // The desktop and mobile layouts each have their own payment panel, but Stripe
  // allows only one CardElement per Elements provider — so we mount the card in
  // whichever layout is active for the current viewport.
  const [isDesktop, setIsDesktop] = useState(true);
  const [storeId, setStoreId] = useState<string | undefined>();
  const [orderNotes, setOrderNotes] = useState('');
  const [wantAccount, setWantAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // `loading` only disables the button on the next render, so a fast double
  // click (or Enter + click) can enter handleSubmit twice and place two orders
  // — two charges on the same card. This ref rejects re-entry synchronously.
  const submittingRef = useRef(false);
  // Login panel
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  // Saved addresses (logged-in users)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  // Mobile summary toggle
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Shipping
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [shippingEstimate, setShippingEstimate] = useState<{ min: number; max: number } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');

  const isLoggedIn = Boolean(token);
  const discount = coupon
    ? coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount
    : 0;
  const effectiveShipping = coupon?.freeShipping ? 0 : (shippingCost ?? 0);
  const finalTotal = total + effectiveShipping;

  // Pre-fill email from user profile
  useEffect(() => {
    if (user?.email && !form.email) setForm((p) => ({ ...p, email: user.email }));
  }, [user?.email, form.email]);

  // Fetch saved addresses for logged-in users
  useEffect(() => {
    if (!token) return;
    api<SavedAddress[]>('/customers/me/addresses', { token })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setSavedAddresses(list);
        if (list.length > 0) {
          setSelectedAddressId(list[0]!.id);
          setShowNewAddressForm(false);
        } else {
          setShowNewAddressForm(true);
        }
      })
      .catch(() => { setShowNewAddressForm(true); });
  }, [token]);

  // Calculate shipping when country changes
  useEffect(() => {
    let countryCode = '';
    if (savedAddresses.length > 0 && selectedAddressId && !showNewAddressForm) {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      countryCode = addr?.country_code || '';
    } else {
      countryCode = form.country_code;
    }
    if (!countryCode || items.length === 0) {
      setShippingCost(null);
      setShippingEstimate(null);
      setShippingError('');
      return;
    }
    const productIds = items.map((i) => i.customProductId || i.productId).filter(Boolean);
    if (productIds.length === 0) return;

    setShippingLoading(true);
    setShippingError('');
    api<any>('/shipping/estimate', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        country_code: countryCode,
        item_count: items.reduce((s, i) => s + i.quantity, 0),
        subtotal,
      }),
    })
      .then((res) => {
        if (!res.available) {
          setShippingError(res.message || t('checkout.shippingNotAvailable'));
          setShippingCost(null);
          setShippingEstimate(null);
        } else {
          setShippingCost(res.cost);
          setShippingEstimate(res.estimated_days || null);
          setShippingError('');
        }
      })
      .catch(() => setShippingError(t('checkout.shippingNotAvailable')))
      .finally(() => setShippingLoading(false));
  }, [selectedAddressId, showNewAddressForm, form.country_code, items.length, subtotal]);

  // Track viewport so only the active layout mounts the CardElement.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Fetch store ID + Stripe config
  useEffect(() => {
    async function init() {
      let storeCardEnabled = true;
      if (storeSlug) {
        try {
          const store = await storefront.getStore(storeSlug) as {
            id: string;
            card_payments_enabled?: boolean;
            cod_enabled?: boolean;
          };
          setStoreId(store.id);
          // The creator must have completed Stripe Connect onboarding for this
          // store to accept card payments.
          storeCardEnabled = store.card_payments_enabled !== false;
          // COD is opt-in per store; strict check so it stays hidden for
          // stores that haven't enabled it.
          setCodAvailable(store.cod_enabled === true);
        } catch { /* ignore */ }
      }
      try {
        const config = await api<PaymentConfig>(paymentConfigPath(storeSlug));
        // Card is offered only when Stripe is configured platform-wide AND the
        // store creator can accept charges.
        setStripeAvailable(config.stripeConfigured && storeCardEnabled);
      } catch {
        setStripeAvailable(false);
      }
    }
    init();
  }, [storeSlug]);

  // Keep the selected method valid as availability resolves: COD is the
  // initial default but may be disabled for this store.
  useEffect(() => {
    if (paymentMethod === 'cod' && !codAvailable && stripeAvailable) {
      setPaymentMethod('stripe');
    } else if (paymentMethod === 'stripe' && !stripeAvailable && codAvailable) {
      setPaymentMethod('cod');
    }
  }, [codAvailable, stripeAvailable, paymentMethod]);

  const noPaymentMethods = !codAvailable && !stripeAvailable;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((p) => ({ ...p, [name]: value }));
      if (fieldErrors[name]) setFieldErrors((p) => { const n = { ...p }; delete n[name]; return n; });
    },
    [fieldErrors],
  );

  const usingSavedAddress = isLoggedIn && selectedAddressId && !showNewAddressForm;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = t(emailErr);

    if (!usingSavedAddress) {
      if (!form.first_name.trim()) errs.first_name = t('checkout.errors.nameRequired');
      if (!form.last_name.trim()) errs.last_name = t('checkout.errors.nameRequired');
      if (!form.line1.trim()) errs.line1 = t('checkout.errors.addressRequired');
      if (!form.city.trim()) errs.city = t('checkout.errors.cityRequired');
      if (!form.postal_code.trim()) errs.postal_code = t('checkout.errors.postalCodeRequired');
      if (!form.country_code) errs.country_code = t('checkout.errors.countryRequired');
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errs.phone = t(phoneErr);
    }

    if (wantAccount && !isLoggedIn && accountPassword.length < 8) {
      errs.password = t('checkout.errors.fieldRequired');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setShowLogin(false);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      await applyCoupon(code);
      setCouponCode('');
    } catch {
      setCouponError(t('cart.couponInvalid'));
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    // Defense in depth — the server rejects COD for stores that disabled it.
    if (noPaymentMethods || (paymentMethod === 'cod' && !codAvailable)) return;
    // The server ties the order to this store (commission model, payout
    // routing, catalogue check), so don't submit before it has resolved.
    if (!storeId) {
      setError(t('checkout.storeNotReady'));
      return;
    }
    if (!validate()) return;
    setError('');
    submittingRef.current = true;
    setLoading(true);

    let activeToken = token;
    const fullName = `${form.first_name} ${form.last_name}`.trim();

    try {
      // Guest: auto-register then sync cart
      if (!activeToken) {
        const pwd = wantAccount && accountPassword.length >= 8
          ? accountPassword
          : `Guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        try {
          activeToken = await register({
            email: form.email, password: pwd, role: 'CUSTOMER',
            first_name: form.first_name, last_name: form.last_name,
            phone: form.phone || undefined,
          });
        } catch (regErr: unknown) {
          if (wantAccount && accountPassword) {
            try {
              await login(form.email, accountPassword);
              activeToken = localStorage.getItem('auth_access_token');
            } catch {
              setError(regErr instanceof Error ? regErr.message : 'Registration failed.');
              setLoading(false);
              return;
            }
          } else {
            setError(regErr instanceof Error ? regErr.message : 'Could not create account. Please log in above.');
            setLoading(false);
            return;
          }
        }

        if (!activeToken) {
          setError('Authentication failed. Please try logging in.');
          setLoading(false);
          return;
        }
        await syncGuestCartToServer(activeToken);
      }

      // 1. Resolve shipping address
      let addressId: string;
      if (usingSavedAddress) {
        addressId = selectedAddressId!;
      } else {
        const address = await api<AddressResponse>('/customers/me/addresses', {
          method: 'POST', token: activeToken,
          body: JSON.stringify({
            full_name: fullName, line1: form.line1,
            line2: form.line2 || undefined, city: form.city,
            state: form.state || undefined, postal_code: form.postal_code,
            country_code: form.country_code, phone: form.phone || undefined,
          }),
        });
        addressId = address.id;
      }

      // 2. Payment
      if (paymentMethod === 'stripe') {
        if (!stripe || !elements) {
          setError('Stripe is not loaded yet. Please try again.');
          setLoading(false);
          return;
        }
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) { setError('Card element not found.'); setLoading(false); return; }

        // Order-first flow: create the order (awaiting payment) so the server
        // derives the charge amount + Connect destination, then pay for it.
        const order = await api<OrderResponse>('/orders', {
          method: 'POST', token: activeToken,
          body: JSON.stringify({
            address_id: addressId,
            store_id: storeId,
            payment_method: 'STRIPE',
            ...(coupon?.code ? { coupon_code: coupon.code } : {}),
            ...(orderNotes ? { notes: orderNotes } : {}),
          }),
        });

        const { clientSecret } = await api<{ clientSecret: string; paymentIntentId: string }>(
          '/payments/create-intent',
          { method: 'POST', token: activeToken, body: JSON.stringify({ order_id: order.id }) },
        );

        const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } });
        if (stripeError) { setError(stripeError.message || t('checkout.paymentFailed')); setLoading(false); return; }

        // Finalize the order server-side immediately (don't depend on the
        // webhook arriving). The webhook remains as a backup.
        try {
          await api('/payments/confirm', {
            method: 'POST', token: activeToken,
            body: JSON.stringify({ order_id: order.id }),
          });
        } catch { /* webhook will reconcile as a fallback */ }

        await clearCart();
        router.push(lp(`/checkout/confirmation?orderId=${order.id}`));
      } else {
        const order = await api<OrderResponse>('/orders', {
          method: 'POST', token: activeToken,
          body: JSON.stringify({
            address_id: addressId,
            store_id: storeId,
            payment_method: 'COD',
            ...(coupon?.code ? { coupon_code: coupon.code } : {}),
            ...(orderNotes ? { notes: orderNotes } : {}),
          }),
        });
        await clearCart();
        router.push(lp(`/checkout/confirmation?orderId=${order.id}`));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  // ── Empty cart guard ───────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen store-page flex flex-col items-center justify-center px-4 py-20">
        <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
        <p className="text-gray-500 mb-4 text-sm">{t('cart.empty')}</p>
        <Link
          href={lp('/products')}
          className="inline-block rounded-md px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          {t('cart.continueShopping')}
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════ MOBILE: collapsible order summary bar ══════ */}
      <div className="lg:hidden border-b store-bd store-surface">
        <button
          type="button"
          onClick={() => setSummaryOpen(!summaryOpen)}
          className="w-full flex items-center justify-between px-4 py-3.5"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ShoppingBag className="w-4 h-4" style={{ color: 'var(--store-primary, #2563eb)' }} />
            {summaryOpen ? t('checkout.hideOrderSummary') : t('checkout.showOrderSummary')}
            {summaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
          <span className="text-sm font-bold text-gray-900">{formatPrice(finalTotal, currency)}</span>
        </button>
        {summaryOpen && (
          <div className="px-4 pb-5 pt-3 border-t border-gray-200">
            <OrderSummary
              items={items} subtotal={subtotal} discount={discount}
              total={finalTotal} currency={currency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={shippingCost} shippingEstimate={shippingEstimate}
              shippingLoading={shippingLoading} shippingError={shippingError}
              effectiveShipping={effectiveShipping}
              t={t as (key: string) => string}
            />
          </div>
        )}
      </div>

      {/* ══════ DESKTOP TWO-PANEL LAYOUT ══════ */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col lg:flex-row max-w-[1100px] mx-auto w-full">

        {/* ── LEFT PANEL — white, form ── */}
        <div className="flex-1 store-page">
          <div className="max-w-[540px] mx-auto px-5 sm:px-8 py-8">

            {/* Breadcrumbs */}
            <nav className="flex items-center flex-wrap gap-1.5 text-xs text-gray-400 mb-7">
              <Link href={lp('/cart')} className="hover:text-gray-600 transition-colors">
                {t('cart.title')}
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-900 font-medium text-sm">{t('checkout.billingDetails')}</span>
              <ChevronRight className="w-3 h-3" />
              <span>{t('checkout.paymentMethod')}</span>
            </nav>

              {/* ── Returning customer login ── */}
              {!isLoggedIn && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowLogin(!showLogin)}
                    className="text-sm text-gray-600"
                  >
                    {t('checkout.returningCustomer')}{' '}
                    <span className="font-medium text-blue-600 hover:text-blue-700">
                      {t('checkout.clickToLogin')}
                    </span>
                  </button>
                  {showLogin && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <input type="email" value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder={t('auth.email')} className={inputCls()} />
                      <input type="password" value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder={t('auth.password')} className={inputCls()} />
                      <button type="button" disabled={loginLoading}
                        onClick={(e) => handleLogin(e as unknown as React.FormEvent)}
                        className="px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shrink-0">
                        {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('auth.signIn')}
                      </button>
                      {loginError && <p className="text-xs text-red-500 self-center">{loginError}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ── Contact ── */}
              <SectionHeading first>{t('checkout.email')}</SectionHeading>

              <div className="mb-4">
                <Label htmlFor="ck_email" required>{t('checkout.email')}</Label>
                <input id="ck_email" name="email" type="email" value={form.email}
                  onChange={handleChange} className={inputCls(!!fieldErrors.email)}
                  placeholder="you@example.com" />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Create account */}
              {!isLoggedIn && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={wantAccount}
                      onChange={(e) => setWantAccount(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-600">{t('checkout.createAccount')}</span>
                  </label>
                  {wantAccount && (
                    <div className="mt-3">
                      <Label htmlFor="ck_pwd" required>{t('checkout.password')}</Label>
                      <input id="ck_pwd" type="password" value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className={inputCls(!!fieldErrors.password)} placeholder="Min 8 characters" />
                      {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ── Delivery ── */}
              <SectionHeading>{t('checkout.billingDetails')}</SectionHeading>

              {/* Saved addresses (logged-in users) */}
              {isLoggedIn && savedAddresses.length > 0 && (
                <div className="mb-5">
                  <div className="space-y-2">
                    {savedAddresses.map((addr) => {
                      const isActive = selectedAddressId === addr.id && !showNewAddressForm;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => { setSelectedAddressId(addr.id); setShowNewAddressForm(false); }}
                          className={`w-full text-left rounded-lg border-2 p-3 transition ${
                            isActive
                              ? 'border-blue-500 bg-blue-50/40'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isActive ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}>
                              {isActive && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">{addr.full_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {addr.line1}
                                {addr.line2 ? `, ${addr.line2}` : ''}
                              </p>
                              <p className="text-xs text-gray-500">
                                {[addr.city, addr.state].filter(Boolean).join(', ')} {addr.postal_code}
                                {addr.country_code ? ` · ${addr.country_code}` : ''}
                              </p>
                              {addr.phone && <p className="text-xs text-gray-400 mt-0.5">{addr.phone}</p>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowNewAddressForm(true); setSelectedAddressId(null); }}
                    className={`mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-3 text-sm font-medium transition ${
                      showNewAddressForm
                        ? 'border-blue-500 bg-blue-50/40 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {t('checkout.newAddress')}
                  </button>
                </div>
              )}

              {/* Address form (guests always, logged-in only when adding new) */}
              {(!isLoggedIn || showNewAddressForm || savedAddresses.length === 0) && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label htmlFor="ck_fn" required>{t('checkout.firstName')}</Label>
                      <input id="ck_fn" name="first_name" type="text" value={form.first_name}
                        onChange={handleChange} className={inputCls(!!fieldErrors.first_name)} />
                      {fieldErrors.first_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.first_name}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ck_ln" required>{t('checkout.lastName')}</Label>
                      <input id="ck_ln" name="last_name" type="text" value={form.last_name}
                        onChange={handleChange} className={inputCls(!!fieldErrors.last_name)} />
                      {fieldErrors.last_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.last_name}</p>}
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label htmlFor="ck_cc" required>{t('checkout.country')}</Label>
                    <select id="ck_cc" name="country_code" value={form.country_code}
                      onChange={handleChange} className={inputCls(!!fieldErrors.country_code)}>
                      <option value="">{t('checkout.country')}...</option>
                      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    {fieldErrors.country_code && <p className="mt-1 text-xs text-red-500">{fieldErrors.country_code}</p>}
                  </div>

                  <div className="mb-3">
                    <Label htmlFor="ck_l1" required>{t('checkout.address')}</Label>
                    <input id="ck_l1" name="line1" type="text" value={form.line1}
                      onChange={handleChange} className={inputCls(!!fieldErrors.line1)}
                      placeholder={t('checkout.address')} />
                    {fieldErrors.line1 && <p className="mt-1 text-xs text-red-500">{fieldErrors.line1}</p>}
                    <input name="line2" type="text" value={form.line2} onChange={handleChange}
                      placeholder="Apartment, suite, etc. (optional)"
                      className={`mt-2 ${inputCls()}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label htmlFor="ck_city" required>{t('checkout.city')}</Label>
                      <input id="ck_city" name="city" type="text" value={form.city}
                        onChange={handleChange} className={inputCls(!!fieldErrors.city)} />
                      {fieldErrors.city && <p className="mt-1 text-xs text-red-500">{fieldErrors.city}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ck_state">{t('checkout.state')}</Label>
                      <input id="ck_state" name="state" type="text" value={form.state}
                        onChange={handleChange} className={inputCls()} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label htmlFor="ck_pc" required>{t('checkout.postalCode')}</Label>
                      <input id="ck_pc" name="postal_code" type="text" value={form.postal_code}
                        onChange={handleChange} className={inputCls(!!fieldErrors.postal_code)} />
                      {fieldErrors.postal_code && <p className="mt-1 text-xs text-red-500">{fieldErrors.postal_code}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ck_phone">{t('checkout.phone')}</Label>
                      <input id="ck_phone" name="phone" type="tel" value={form.phone}
                        onChange={handleChange} className={inputCls(!!fieldErrors.phone)} />
                      {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                    </div>
                  </div>
                </>
              )}

              <div className="mb-3">
                <Label htmlFor="ck_notes">{t('checkout.orderNotes')}</Label>
                <textarea id="ck_notes" value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2} placeholder={t('checkout.orderNotesPlaceholder')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>

          </div>
        </div>

        {/* ── RIGHT PANEL — gray, order summary + payment (desktop) ── */}
        <div className="hidden lg:block lg:w-[460px] lg:shrink-0 store-surface border-l store-bd">
          <div className="pl-10 pr-12 py-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-5 uppercase tracking-wide">
              {t('checkout.orderSummary')}
            </h2>
            <OrderSummary
              items={items} subtotal={subtotal} discount={discount}
              total={finalTotal} currency={currency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={shippingCost} shippingEstimate={shippingEstimate}
              shippingLoading={shippingLoading} shippingError={shippingError}
              effectiveShipping={effectiveShipping}
              t={t as (key: string) => string}
            />

            {/* ── Payment Method ── */}
            <div className="border-t border-gray-200 mt-5 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('checkout.paymentMethod')}</h3>
              <div className="space-y-2">
                {codAvailable && (
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <input type="radio" name="payment" value="cod"
                      checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t('checkout.cashOnDelivery')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t('checkout.codDescription')}</p>
                    </div>
                  </label>
                )}
                {noPaymentMethods && (
                  <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50 text-xs text-amber-800">
                    {t('checkout.noPaymentMethods')}
                  </div>
                )}

                {stripeAvailable ? (
                  <div>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <input type="radio" name="payment" value="stripe"
                        checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t('checkout.creditCard')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('checkout.stripeDescription')}</p>
                      </div>
                    </label>
                    {paymentMethod === 'stripe' && isDesktop && (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
                        <CardElement
                          options={{ style: { base: { fontSize: '14px', color: '#1a1a1a', '::placeholder': { color: '#9ca3af' } }, invalid: { color: '#ef4444' } } }}
                          onChange={(e) => setStripeReady(e.complete && !e.error)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed">
                    <div className="mt-0.5 w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-400">{t('checkout.creditCard')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t('checkout.stripeNotConfigured')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mt-4">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || noPaymentMethods || (paymentMethod === 'stripe' && !stripeReady) || !!shippingError || shippingLoading}
              className="w-full mt-5 py-4 text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('checkout.processing')}</>
                : <><Lock className="w-4 h-4" />{paymentMethod === 'stripe' ? t('checkout.payAndPlaceOrder') : t('checkout.placeOrder')}</>
              }
            </button>

            <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              {t('checkout.allTransactionsSecure')}
            </p>
          </div>
        </div>

        {/* ── MOBILE: payment + submit (shown below form) ── */}
        <div className="lg:hidden px-5 sm:px-8 pb-8">
          <div className="max-w-[540px] mx-auto">
            <h3 className="text-base font-semibold text-gray-900 pt-4 pb-3 border-b border-gray-200 mb-4">{t('checkout.paymentMethod')}</h3>
            <div className="space-y-2.5 mb-5">
              {noPaymentMethods && (
                <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50 text-xs text-amber-800">
                  {t('checkout.noPaymentMethods')}
                </div>
              )}
              {codAvailable && (
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <input type="radio" name="payment_mobile" value="cod"
                    checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t('checkout.cashOnDelivery')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('checkout.codDescription')}</p>
                  </div>
                </label>
              )}
              {stripeAvailable && (
                <div>
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <input type="radio" name="payment_mobile" value="stripe"
                      checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t('checkout.creditCard')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t('checkout.stripeDescription')}</p>
                    </div>
                  </label>
                  {paymentMethod === 'stripe' && !isDesktop && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
                      <CardElement
                        options={{ style: { base: { fontSize: '14px', color: '#1a1a1a', '::placeholder': { color: '#9ca3af' } }, invalid: { color: '#ef4444' } } }}
                        onChange={(e) => setStripeReady(e.complete && !e.error)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || noPaymentMethods || (paymentMethod === 'stripe' && !stripeReady) || !!shippingError || shippingLoading}
              className="w-full py-4 text-white text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('checkout.processing')}</>
                : <><Lock className="w-4 h-4" />{paymentMethod === 'stripe' ? t('checkout.payAndPlaceOrder') : t('checkout.placeOrder')}</>
              }
            </button>
            <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              {t('checkout.allTransactionsSecure')}
            </p>
          </div>
        </div>

      </form>
    </>
  );
}

// ── Stripe wrapper ─────────────────────────────────────────────────────────────
function CheckoutWithStripe() {
  const pathname = usePathname();
  const storeSlug = resolveStoreSlug(pathname);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof getStripe>>(null);
  useEffect(() => {
    // The publishable key is admin-managed and served by the API, so load
    // Stripe.js with the key returned by /payments/config (not a build-time env).
    // Independent stores charge directly on the owner's connected account, so
    // Stripe.js must be initialised with that same `stripeAccount`.
    api<PaymentConfig>(paymentConfigPath(storeSlug))
      .then((cfg) => {
        if (cfg.publishableKey) setStripePromise(getStripe(cfg.publishableKey, cfg.stripeAccount));
      })
      .catch(() => { /* Stripe stays unavailable; checkout falls back to COD */ });
  }, [storeSlug]);
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}

export default function StoreCheckoutPage() {
  return <CheckoutWithStripe />;
}
