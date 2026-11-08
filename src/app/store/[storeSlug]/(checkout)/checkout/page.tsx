'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import type { Stripe, StripeElements, StripeElementsOptions, StripeError } from '@stripe/stripe-js';
import { Lock, Loader2, ShoppingBag, ChevronDown, ChevronUp, ChevronRight, Plus, Check, AlertTriangle } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth, isNotCustomerAccountError, isStoreMismatchError, readStoredAccessToken } from '@/hooks/useAuth';
import { createCheckoutAccount, guestAccountNoteKey } from '@/lib/checkoutAccount';
import { useCart } from '@/hooks/useCart';
import { useMarket, useMarkets, useMarketPreview } from '@/hooks/useMarket';
import { api, storefront, type ApiError } from '@/lib/api';
import { marketBody, marketQuery } from '@/lib/market';
import { MarketPreviewCheckoutNotice } from '@/components/layout/MarketPreviewBanner';
import { useApiError, useCodedApiError } from '@/lib/useApiError';
import { getStripe } from '@/lib/stripe';
import { checkoutViewerToken, storefrontViewerHeaders } from '@/lib/storePreview';
import { readEditHintToken } from '@/components/edit-hint/editHintStorage';
import {
  buildStripeBillingDetails,
  confirmErrorOutcome,
  intentStatusOutcome,
  STRIPE_BILLING_FIELDS,
  STRIPE_READY_TIMEOUT_MS,
  pendingAfterRouteChange,
  readCreateIntent,
  readStripeThemeFromDom,
  settleUncertainPayment,
  toStripeLocale,
  toStripeMinorAmount,
  type CreateIntentResponse,
  type PaymentRoute,
  type ReconcileResponse,
} from '@/lib/stripeElements';
import { formatPrice } from '@/lib/format';
import { normalizeB2bNetTotals, normalizeTaxExemptReason, normalizeTaxLines, normalizeTaxPricingMode, sumTaxLines, type TaxLine } from '@/lib/tax';
import { exemptLinePrices, normalizeQuoteTaxExemption } from '@/lib/taxExemption';
import { precheckVat, rememberReverseChargeHint, vatComparable, type VatCheckResult } from '@/lib/vatCheck';
import { toKustomCartLines } from '@/hooks/useKustomCheckout';
import { isLineErrorCode } from '@/lib/checkoutLineErrors';
import { validateEmail, validatePhone } from '@/lib/validators';
import { useBuyerType } from '@/hooks/useBuyerType';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { resolvePayButtonLabel } from '@/lib/checkoutSettings';
import { CouponAutoApplyNotice } from '@/components/checkout/CouponAutoApplyNotice';
import {
  normalizeOrgNumber,
  normalizeVatNumber,
  orgNumberFormatHint,
  validateCompanyName,
  validateOrgNumber,
  validateVatNumber,
} from '@/lib/b2bValidators';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { KustomCheckout } from '@/components/checkout/KustomCheckout';
import { VatNumberField } from '@/components/checkout/VatNumberField';
import { RemoveUnavailableHint } from '@/components/cart/UnavailableInMarket';
import { UnavailableRemovedNotice, useCartAvailabilityCheck } from '@/components/cart/UnavailableRemovedNotice';
import { readUnavailableError } from '@/lib/cartUnavailable';
import { InvalidPersonalizationHint, hasInvalidPersonalization } from '@/components/cart/InvalidPersonalizationHint';
import { availableLines } from '@/lib/cartAvailability';
import { checkoutCountryOptions } from '@/lib/checkoutCountries';
import { CUSTOMER_CAPTCHA_ON, CustomerCaptcha } from '@/components/auth/CustomerCaptcha';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddressResponse { id: string }
interface OrderResponse { id: string; order_number?: string }
interface PaymentConfig {
  stripeConfigured: boolean;
  publishableKey: string | null;
  stripeAccount: string | null;
  /** Kustom Checkout is offered (independent store with configured credentials). */
  kustomEnabled: boolean;
  /** Which Stripe account charges: the owner's own key, legacy Connect, or the platform. */
  route?: PaymentRoute;
  /** Owner preview with a Stripe test key: nothing real is charged. */
  test_mode?: boolean;
}
// The unpaid Stripe order of the last attempt, reused when the shopper retries
// without changing anything (no second order for the same cart).
interface PendingStripeOrder {
  signature: string;
  token: string;
  orderId: string;
  /** Null until create-intent succeeded for this order. */
  clientSecret: string | null;
  /** Consecutive payment-route changes seen for this order (loop guard). */
  routeChanges?: number;
}
// Own-key errors from the API that mean "card payments are down for this
// store right now" rather than a problem with the order itself.
const STRIPE_UNAVAILABLE_CODES = new Set(['OWN_KEY_NOT_ACTIVE', 'OWN_KEY_INVALID_OR_REVOKED']);
// Resolved once per visit (store flags + platform payment config) and shared
// by both checkout modes.
interface PaymentAvailability {
  storeId?: string;
  cod: boolean;
  stripe: boolean;
  kustom: boolean;
  publishableKey: string | null;
  stripeAccount: string | null;
  /** Route the publishable key belongs to (absent on older APIs). */
  route?: PaymentRoute;
  testMode: boolean;
  /** Owner / admin preview of a store that is not LIVE yet (`preview` payload). */
  ownerPreview: boolean;
}
// Store-level flags of the availability (the payment config is reloadable).
interface StorePaymentFlags {
  storeId?: string;
  cod: boolean;
  card: boolean;
  kustom: boolean;
  /** The full payload of a non-LIVE store was served to its owner / an admin. */
  ownerPreview: boolean;
}
function buildAvailability(flags: StorePaymentFlags, config: PaymentConfig | null): PaymentAvailability {
  // Before go-live the API takes an order only from the owner, paid with the
  // store's own TEST key (fix batch 1, item 4): COD and Kustom would be
  // refused (409 STORE_NOT_LIVE), so the preview offers only the test card.
  if (flags.ownerPreview) {
    const testCard = Boolean(config?.stripeConfigured) && config?.test_mode === true;
    return {
      storeId: flags.storeId,
      cod: false,
      stripe: testCard,
      kustom: false,
      publishableKey: testCard ? config?.publishableKey ?? null : null,
      stripeAccount: testCard ? config?.stripeAccount ?? null : null,
      route: config?.route,
      testMode: testCard,
      ownerPreview: true,
    };
  }
  return {
    storeId: flags.storeId,
    cod: flags.cod,
    // Card is offered only when Stripe is configured (and active) for the
    // store AND the store creator can accept charges. The public store read
    // says "no card" while only a TEST key is connected; the viewer-aware
    // config (`test_mode`, owner / admin only) overrides that for the owner.
    stripe: Boolean(config?.stripeConfigured) && (flags.card || config?.test_mode === true),
    // Kustom is offered only when the payment config says so AND the store
    // itself hasn't turned it off.
    kustom: config?.kustomEnabled === true && flags.kustom,
    publishableKey: config?.publishableKey ?? null,
    stripeAccount: config?.stripeAccount ?? null,
    route: config?.route,
    testMode: config?.test_mode === true,
    ownerPreview: false,
  };
}
// Live Stripe.js + Elements of the mounted Payment Element.
interface StripeHandles { stripe: Stripe; elements: StripeElements }

// Lives inside the Elements provider: hands Stripe.js + Elements up to the
// form (which sits outside the provider so a remount after a payment-route
// change keeps everything the shopper typed) and renders the element.
function StripePaymentBridge({
  layout, onBind, onReady, onLoadError,
}: {
  layout: 'tabs' | 'accordion';
  onBind: (handles: StripeHandles | null) => void;
  onReady: () => void;
  onLoadError: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  useEffect(() => {
    onBind(stripe && elements ? { stripe, elements } : null);
    return () => onBind(null);
  }, [stripe, elements, onBind]);
  // Name, email, phone and address come from the checkout form and go with
  // confirmPayment, so the element never asks for them again.
  return (
    <PaymentElement
      options={{ layout, fields: STRIPE_BILLING_FIELDS }}
      onReady={onReady}
      onLoadError={onLoadError}
    />
  );
}
// One row of the shipping-method radio list, as quoted by POST /shipping/estimate.
interface ShippingMethod {
  id: string;
  name: string;
  type: 'DELIVERY' | 'PICKUP';
  cost: number;
  estimated_days: { min: number; max: number } | null;
  free_shipping: boolean;
  /** Synthesised from a legacy `{ cost, estimated_days }` response that carries
   *  no `methods`; it has no server id, so it is never sent with the order. */
  legacy?: boolean;
}
interface ShippingEstimateResponse {
  available: boolean;
  message?: string;
  methods?: ShippingMethod[];
  cost?: number;
  estimated_days?: { min: number; max: number } | null;
  free_shipping?: boolean;
}
// POST /orders/quote (API-CONTRACT-TAX §3): the order the server would create
// from the cart for this destination — totals + itemized tax. Only the fields
// the summary renders are typed.
interface OrderQuoteResponse {
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  /** Grand total; in EXCLUSIVE mode already includes the tax lines. */
  total: number;
  currency?: string;
  tax_lines?: unknown;
  tax_total?: number;
  tax_pricing_mode?: string;
  tax_basis_country?: string | null;
  shipping_method_id?: string | null;
  /** b2b app, company quote: net figures (M2-DESIGN D3); absent otherwise. */
  b2b?: unknown;
  /** Quoted lines; with an exemption their `unit_price` is what is paid. */
  items?: unknown;
  /** b2b app M2.5: why the quote carries no VAT (null = taxed); absent without the app. */
  tax_exempt_reason?: string | null;
  tax_exemption?: unknown;
}
// Typing a postcode or switching methods re-quotes; coalesce bursts of changes.
const QUOTE_DEBOUNCE_MS = 400;

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
  /** b2b app: company fields saved with the address (M2-DESIGN D8). */
  company_name?: string | null;
  org_number?: string | null;
  buyer_reference?: string | null;
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
// The proxy rewrites every store URL — platform subdomain AND custom CNAME —
// to /store/[storeSlug]/..., so the route param always carries the slug the
// API resolved. Guessing from the hostname (the previous approach) broke
// custom domains: "shop.merchant.com" yielded "shop", getStore 404'd, and on
// an independent store the connected Stripe account was never resolved.

// Flag the order for the confirmation page's "we emailed your login" note.
// Best-effort: storage may be unavailable (private mode).
function rememberGuestAccount(orderId: string, email: string) {
  try {
    sessionStorage.setItem(guestAccountNoteKey(orderId), email);
  } catch { /* the note is optional */ }
}

// Build the payment-config endpoint, scoped to the current store when known so
// the API can return the store's connected-account details (independent stores)
// and, for market stores, to the request market (`?market=`, `&preview=1` on a
// market-preview host) so `kustomEnabled` reflects the market currency.
function paymentConfigPath(storeSlug: string, market: ReturnType<typeof useMarket>): string {
  return storeSlug
    ? `/payments/config?store=${encodeURIComponent(storeSlug)}${marketQuery(market, true)}`
    : '/payments/config';
}

// The config read carries the owner preview / edit-hint token (or the
// shopper session) so an owner previewing with a Stripe TEST key gets it
// back with `test_mode`; never cached (the answer depends on the viewer).
function paymentConfigFetchOptions(storeSlug: string): { token?: string; cache: 'no-store' } {
  const token = checkoutViewerToken(storeSlug, {
    editHintToken: readEditHintToken(),
    sessionToken: readStoredAccessToken(),
  });
  return token ? { token, cache: 'no-store' } : { cache: 'no-store' };
}

// The same viewer token as a header on create-intent / confirm, so the API
// picks owner test mode exactly as it did for /payments/config. Read at call
// time (a guest account created mid-submit is the session from then on).
function paymentViewerHeaders(storeSlug: string): Record<string, string> {
  return storefrontViewerHeaders(checkoutViewerToken(storeSlug, {
    editHintToken: readEditHintToken(),
    sessionToken: readStoredAccessToken(),
  }));
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

// ── Checkout Form ─────────────────────────────────────────────────────────────
function CheckoutForm({
  availability, reloadPaymentConfig,
}: {
  availability: PaymentAvailability;
  /** Re-reads /payments/config (route / key changed); resolves when applied. */
  reloadPaymentConfig: () => Promise<void>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const apiError = useApiError();
  const codedError = useCodedApiError();
  const locale = useLocale();
  const lp = useLocalePath();
  // Stripe.js + Elements of the mounted Payment Element (null until ready).
  const [stripeHandles, setStripeHandles] = useState<StripeHandles | null>(null);
  // Bumped to remount Elements with a fresh Stripe.js after a route change.
  const [stripeEpoch, setStripeEpoch] = useState(0);
  const { token, user, login, register, registerGuest } = useAuth();
  const {
    items, subtotal, total, coupon, currency,
    taxLines: cartTaxLines, taxPricingMode, taxEstimated: cartTaxEstimated,
    b2bNet: cartB2bNet, netItems,
    clearCart, applyCoupon, removeCoupon, syncGuestCartToServer,
    removeItem, hasUnavailableItems, removeUnavailableLines,
  } = useCart();
  // Lines of deleted / unpublished products are dropped on checkout load.
  useCartAvailabilityCheck();
  // Personalization app: a line whose personalization no longer passes the
  // rules blocks checkout like an unavailable line, until it is fixed in the cart.
  const personalizationBlocked = hasInvalidPersonalization(items);

  // M4.0: prefix a personalization message with the product of its line.
  const withProduct = (title: string | undefined, message: string) =>
    title ? t('checkout.lineError', { product: title, message }) : message;
  // The line comes from `line_id` (server cart row) or, for a quote of the
  // local guest lines, from `line_index` (the lines are sent 1:1 from `items`).
  const lineErrorMessage = (err: ApiError, guestLines: boolean) => {
    const line = err.line_id
      ? items.find((i) => i.id === err.line_id)
      : guestLines && typeof err.line_index === 'number'
        ? items[err.line_index]
        : undefined;
    return withProduct(line?.title, apiError(err));
  };
  // b2b app (M2-DESIGN §4.4): company view adds the company section, sends
  // `buyer_type` + `company` with the quote / order and saves the company
  // defaults best-effort. `isCompany` is always false without the app, so
  // every request body below stays identical for other stores.
  const { isCompany, settings: b2bSettings } = useBuyerType();
  // Store checkout settings (M5.1): phone requirement + pay button label.
  // Defaults (today's behaviour) for stores that never set the card.
  const checkoutSettings = useCheckoutSettings();
  // M2.5: the VAT field validates live and the quote / order carry the
  // number only on stores with reverse charge on (off = M2 bodies).
  const rcEnabled = isCompany && b2bSettings.reverse_charge_enabled;
  const storeSlug = (useParams<{ storeSlug: string }>()?.storeSlug as string) || '';
  // Markets app: the request market (null otherwise). Quote and order bodies
  // then carry `market_key` + the hostname/locale the order was placed on
  // (M1-DESIGN D1); non-market stores send exactly the previous bodies.
  const market = useMarket();
  // Market preview host: every read below carries `preview: true`; the pay
  // button is disabled and the API would refuse the order anyway
  // (MARKET_NOT_LIVE — order creation is LIVE-only and never previews).
  const previewMode = useMarketPreview();
  // Evaluated at submit time: `window` is unavailable during SSR. Deliberately
  // NOT `marketBody()` of lib/market: the order body never carries `preview`.
  const orderMarketBody = () =>
    market ? { market_key: market.key, hostname: window.location.hostname, locale } : {};

  // ── State ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '',
    line1: '', line2: '', city: '', state: '',
    postal_code: '', country_code: '', phone: '',
    // b2b app: company section (only read when `isCompany`).
    company_name: '', org_number: '', vat_number: '', buyer_reference: '',
  });
  // Markets app: the market's countries (the default market also serves
  // every country no other market claims); the legacy list otherwise.
  const markets = useMarkets();
  const countryOptions = useMemo(
    () => checkoutCountryOptions(COUNTRIES, market, markets, locale, form.country_code),
    [market, markets, locale, form.country_code],
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe'>('cod');
  // Availability is resolved by CheckoutRouter before either mode mounts.
  // Kustom is its own mode; here it only drives the "pay with Kustom" link.
  const { cod: codAvailable, stripe: stripeAvailable, kustom: kustomAvailable, storeId } = availability;
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeLoadFailed, setStripeLoadFailed] = useState(false);
  // The element has not reported ready within STRIPE_READY_TIMEOUT_MS.
  const [stripeSlow, setStripeSlow] = useState(false);
  const pendingStripeRef = useRef<PendingStripeOrder | null>(null);
  // The desktop and mobile layouts each have their own payment panel, but Stripe
  // allows only one Payment Element per Elements provider — so we mount it in
  // whichever layout is active for the current viewport.
  const [isDesktop, setIsDesktop] = useState(true);
  const [orderNotes, setOrderNotes] = useState('');
  const [wantAccount, setWantAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  // Turnstile for the guest account created at checkout (when switched on).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // The error concerns a cart line (personalization): the box links to the cart.
  const [errorCartLink, setErrorCartLink] = useState(false);
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
  // Shipping: the quote lists every method the store offers for the address
  // country; the customer picks one and its cost becomes the shipping line.
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  // Bumped to force a fresh shipping quote (e.g. after the API rejected the
  // selected method); the quote effect below lists it as a dependency.
  const [requoteTick, setRequoteTick] = useState(0);
  // Server order quote (totals + tax lines) for the current destination /
  // method / coupon; null until a country is known or when the request failed,
  // in which case the summary falls back to the client-side figures.
  const [quote, setQuote] = useState<OrderQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  // M4.0: a personalization rejection of the quote (`CUSTOM_FIELD_*` /
  // `CUSTOMER_UPLOAD_*`) is shown instead of silently dropping the quote.
  // `guest` = the quote priced the local lines, so `line_index` maps to them.
  const [quoteLineError, setQuoteLineError] = useState<{ err: ApiError; guest: boolean } | null>(null);
  // Buyer type the current quote was made for: an exemption of the previous
  // buyer type is ignored at once after a toggle (M2.5 L5).
  const [quoteCompany, setQuoteCompany] = useState<boolean | null>(null);
  // b2b app M2.5 (reverse charge): last settled VAT check of the company
  // section, and whether the API refused an expected reverse charge (409),
  // which turns the error box amber and shows the re-quoted total.
  const [vatCheck, setVatCheck] = useState<VatCheckResult | null>(null);
  const [rcNotConfirmed, setRcNotConfirmed] = useState(false);

  const isLoggedIn = Boolean(token);
  const discount = coupon
    ? coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount
    : 0;
  // Fall back to the first method so a stale selection can never leave the
  // order without a shipping cost.
  const selectedShippingMethod =
    shippingMethods.find((m) => m.id === selectedShippingMethodId) ?? shippingMethods[0] ?? null;
  const shippingCost = selectedShippingMethod ? selectedShippingMethod.cost : null;
  // Pickup has no transit time, so the summary shows no day range for it.
  const shippingEstimate =
    selectedShippingMethod && selectedShippingMethod.type !== 'PICKUP'
      ? selectedShippingMethod.estimated_days
      : null;
  const effectiveShipping = coupon?.freeShipping ? 0 : (shippingCost ?? 0);
  const finalTotal = total + effectiveShipping;

  // Destination the quotes are made for: the selected saved address, else the form.
  const activeSavedAddress =
    savedAddresses.length > 0 && selectedAddressId && !showNewAddressForm
      ? savedAddresses.find((a) => a.id === selectedAddressId) ?? null
      : null;
  const shippingCountryCode = activeSavedAddress ? activeSavedAddress.country_code || '' : form.country_code;
  const shippingPostcode = (activeSavedAddress ? activeSavedAddress.postal_code : form.postal_code)?.trim() || '';
  // State / province: the order prices tax with the address state, so the
  // quote must see the same region to match it.
  const shippingRegion = (activeSavedAddress ? activeSavedAddress.state : form.state)?.trim() || '';

  // What the summary shows: the server quote once there is one (its `total`
  // already includes tax in EXCLUSIVE mode), else the client-side figures with
  // the cart's registration-country tax estimate (INCLUSIVE only — in
  // EXCLUSIVE mode nothing is added until the server has quoted).
  const displayTotal = quote ? Number(quote.total) : finalTotal;
  // The currency the API charges in (the order's, i.e. the quote's); the
  // cart's until the server has quoted.
  const paymentCurrency = (quote?.currency || currency || 'EUR').toUpperCase();
  // A fully discounted order has nothing to pay: Stripe is never mounted
  // or submitted for it (a PaymentIntent needs a positive amount).
  const nothingToPay = Number.isFinite(displayTotal) && displayTotal <= 0;

  // The publishable key is served by the API (/payments/config): the store
  // owner's own key (OWN_KEY), the platform key + `stripeAccount` for a
  // legacy Connect direct charge, or the platform key alone (marketplace).
  // `stripeEpoch` is a dependency so "Try again" after a failed script load
  // asks for a fresh Stripe.js (a rejected load is not cached).
  const stripePromise = useMemo(
    () => (availability.publishableKey ? getStripe(availability.publishableKey, availability.stripeAccount) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the epoch forces a new promise on retry
    [availability.publishableKey, availability.stripeAccount, stripeEpoch],
  );
  // Theme + locale of the element, read once: `fonts` cannot change after mount.
  const [stripeBaseOptions] = useState<Pick<StripeElementsOptions, 'appearance' | 'fonts' | 'locale'>>(() => {
    const theme = readStripeThemeFromDom();
    return {
      locale: toStripeLocale(locale),
      appearance: theme.appearance,
      ...(theme.fonts.length ? { fonts: theme.fonts } : {}),
    };
  });
  // Deferred-intent Elements (mode + amount, no clientSecret): the element
  // mounts before any order exists and the PaymentIntent is created at
  // submit. Amount / currency follow the quote (the provider applies option
  // changes through elements.update), so Klarna limits and the wallet sheet
  // total match what the API will charge.
  const stripeMinorAmount = toStripeMinorAmount(displayTotal, paymentCurrency);
  const stripeOptions = useMemo<StripeElementsOptions>(() => ({
    mode: 'payment',
    amount: stripeMinorAmount,
    currency: paymentCurrency.toLowerCase(),
    ...stripeBaseOptions,
  }), [stripeMinorAmount, paymentCurrency, stripeBaseOptions]);
  const stripeElementsKey = `${availability.publishableKey ?? ''}|${availability.stripeAccount ?? ''}|${stripeEpoch}`;
  const pricingMode = (quote && normalizeTaxPricingMode(quote.tax_pricing_mode)) || taxPricingMode;
  const taxLines: TaxLine[] = quote
    ? normalizeTaxLines(quote.tax_lines)
    : pricingMode === 'INCLUSIVE' ? cartTaxLines : [];
  const taxEstimated = quote ? false : cartTaxEstimated;
  const taxPending = !quote && quoteLoading;
  // Company view: net block of the quote once there is one, else the cart's.
  const b2bNet = quote ? normalizeB2bNetTotals(quote.b2b) : cartB2bNet;
  // M2.5: exempt quote → its line prices are shown as-is (never re-netted).
  const quoteForBuyer = quote !== null && quoteCompany === isCompany;
  const exemptReason = quote && quoteForBuyer ? normalizeTaxExemptReason(quote.tax_exempt_reason) : null;
  const quoteExemption = quote && quoteForBuyer ? normalizeQuoteTaxExemption(quote.tax_exemption) : null;
  // Exempt quote (any buyer): its subtotal / discount are what is paid.
  const summarySubtotal = exemptReason && quote ? Number(quote.subtotal) : subtotal;
  const summaryDiscount = exemptReason && quote ? Number(quote.discount_amount) : discount;
  const quoteItems = quote?.items;
  const exemptPrices = useMemo(
    () => (exemptReason ? exemptLinePrices(quoteItems, items) : null),
    [exemptReason, quoteItems, items],
  );
  // Keep the cart's "reverse charge applies at checkout" hint in step.
  // A quote without a destination decides nothing (`why: NO_DESTINATION`).
  const quoteHasExemption = quoteExemption !== null && quoteExemption.why !== 'NO_DESTINATION';
  useEffect(() => {
    if (!rcEnabled || !quoteHasExemption) return;
    rememberReverseChargeHint(storeSlug, exemptReason === 'REVERSE_CHARGE');
  }, [rcEnabled, quoteHasExemption, exemptReason, storeSlug]);

  // Pre-fill email from user profile
  useEffect(() => {
    if (user?.email && !form.email) setForm((p) => ({ ...p, email: user.email }));
  }, [user?.email, form.email]);

  // b2b app: prefill the company section from the selected saved address
  // (its own company fields) and the account defaults (/auth/me customer),
  // never overwriting what the shopper already typed.
  const prefillCompanyName = activeSavedAddress?.company_name || user?.customer?.company_name || '';
  const prefillOrgNumber = activeSavedAddress?.org_number || user?.customer?.org_number || '';
  const prefillVatNumber = user?.customer?.vat_number || '';
  const prefillReference = activeSavedAddress?.buyer_reference || '';
  useEffect(() => {
    if (!isCompany) return;
    setForm((p) => ({
      ...p,
      company_name: p.company_name || prefillCompanyName,
      org_number: p.org_number || prefillOrgNumber,
      vat_number: p.vat_number || prefillVatNumber,
      buyer_reference: p.buyer_reference || prefillReference,
    }));
  }, [isCompany, prefillCompanyName, prefillOrgNumber, prefillVatNumber, prefillReference]);

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

  // Quote shipping methods whenever the country (or the cart) changes.
  useEffect(() => {
    const countryCode = shippingCountryCode;
    if (!countryCode || items.length === 0) {
      setShippingMethods([]);
      setShippingError('');
      // An in-flight quote was cancelled by the cleanup; clear its spinner too.
      setShippingLoading(false);
      return;
    }
    // Lines unavailable in the market are not part of the order.
    const purchasable = availableLines(items);
    const productIds = purchasable.map((i) => i.customProductId || i.productId).filter(Boolean);
    if (productIds.length === 0) return;

    // Ignore a slow response that lands after the country changed again.
    let cancelled = false;
    setShippingLoading(true);
    setShippingError('');
    api<ShippingEstimateResponse>('/shipping/estimate', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        country_code: countryCode,
        item_count: purchasable.reduce((s, i) => s + i.quantity, 0),
        subtotal,
        locale,
        // Markets app: costs and the free threshold in the market currency
        // (`preview: true` on a market-preview host).
        ...(storeId && market?.key ? { store_id: storeId, ...marketBody(market) } : {}),
      }),
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.available) {
          setShippingError(res.message || t('checkout.shippingNotAvailable'));
          setShippingMethods([]);
          return;
        }
        // A pre-phase-C API answers with a single cost and no `methods`;
        // present it as one "Standard shipping" row so checkout still works.
        const methods: ShippingMethod[] = Array.isArray(res.methods) && res.methods.length > 0
          ? res.methods.map((m) => ({ ...m, cost: Number(m.cost) }))
          : [{
              id: 'legacy-standard',
              name: t('checkout.standardShipping'),
              type: 'DELIVERY',
              cost: Number(res.cost ?? 0),
              estimated_days: res.estimated_days ?? null,
              free_shipping: Number(res.cost ?? 0) === 0,
              legacy: true,
            }];
        setShippingMethods(methods);
        // Keep the customer's choice across re-quotes while it is still offered;
        // otherwise default to the first (cheapest / preselected) method.
        setSelectedShippingMethodId((prev) =>
          prev && methods.some((m) => m.id === prev) ? prev : methods[0]!.id,
        );
        setShippingError('');
      })
      .catch(() => {
        if (cancelled) return;
        setShippingError(t('checkout.shippingNotAvailable'));
        setShippingMethods([]);
      })
      .finally(() => { if (!cancelled) setShippingLoading(false); });
    return () => { cancelled = true; };
  }, [shippingCountryCode, items.length, subtotal, locale, requoteTick, storeId, market?.key]);

  // Quote the order (totals + itemized tax) once the destination country is
  // known, and again whenever the postcode, shipping method, coupon, cart or
  // login state changes. Guests send their local lines; a logged-in shopper
  // omits them so the server prices its cart. Debounced, stale responses dropped.
  const isLoggedInForQuote = Boolean(token);
  const quoteLinesKey = JSON.stringify(toKustomCartLines(items));
  const quoteShippingMethodId =
    selectedShippingMethod && !selectedShippingMethod.legacy ? selectedShippingMethod.id : null;
  const quoteCouponCode = coupon?.code ?? null;
  const quoteMarketKey = market?.key;
  const quoteMarketPreview = Boolean(market?.preview);
  // M2.5: the (format-valid) VAT number goes with a company quote on reverse
  // charge stores; each settled VIES check re-quotes so the server's cached
  // verdict is picked up.
  const vatPre = precheckVat(form.vat_number);
  const quoteVatNumber = rcEnabled && vatPre.kind === 'ok' ? vatPre.vatNumber : null;
  const vatCheckSettledKey = rcEnabled && vatCheck ? `${vatCheck.vatNumber}|${vatCheck.countryCode ?? ''}|${vatCheck.state}` : null;
  useEffect(() => {
    if (!storeId || !shippingCountryCode || items.length === 0) {
      setQuote(null);
      setQuoteLineError(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      api<OrderQuoteResponse>('/orders/quote', {
        method: 'POST',
        token: token ?? undefined,
        // Owner viewer token: the API quotes a non-LIVE store for its owner.
        headers: paymentViewerHeaders(storeSlug),
        body: JSON.stringify({
          store_id: storeId,
          ...(quoteMarketKey ? { market_key: quoteMarketKey, ...(quoteMarketPreview ? { preview: true } : {}) } : {}),
          // Guest lines travel as the serialised key so the effect depends on
          // their content, not on the array identity.
          ...(isLoggedInForQuote ? {} : { lines: JSON.parse(quoteLinesKey) }),
          country_code: shippingCountryCode,
          ...(shippingPostcode ? { postcode: shippingPostcode } : {}),
          ...(shippingRegion ? { region: shippingRegion } : {}),
          ...(quoteShippingMethodId ? { shipping_method_id: quoteShippingMethodId } : {}),
          ...(quoteCouponCode ? { coupon_code: quoteCouponCode } : {}),
          locale,
          // b2b app: the company quote carries the `b2b` net block.
          ...(isCompany ? { buyer_type: 'COMPANY' } : {}),
          ...(isCompany && quoteVatNumber ? { vat_number: quoteVatNumber } : {}),
        }),
      })
        .then((res) => { if (!cancelled) { setQuote(res); setQuoteCompany(isCompany); setQuoteLineError(null); } })
        .catch((err: unknown) => {
          if (cancelled) return;
          setQuote(null);
          // A deleted / unpublished product: drop its lines (the cart change
          // re-quotes). Nothing matched locally: say so and link to the cart.
          const gone = readUnavailableError(err);
          if (gone) {
            setQuoteLineError(null);
            void removeUnavailableLines(gone).then((resolved) => {
              if (!resolved) {
                setError(t('checkout.itemsUnavailable'));
                setErrorCartLink(true);
              }
            });
            return;
          }
          // Personalization errors are shown; other failures keep the
          // client-side fallback figures as before.
          setQuoteLineError(isLineErrorCode((err as ApiError | null)?.code)
            ? { err: err as ApiError, guest: !isLoggedInForQuote }
            : null);
        })
        .finally(() => { if (!cancelled) setQuoteLoading(false); });
    }, QUOTE_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [
    storeId, token, isLoggedInForQuote, quoteLinesKey, items.length,
    shippingCountryCode, shippingPostcode, shippingRegion, quoteShippingMethodId, quoteCouponCode, locale, requoteTick,
    quoteMarketKey, quoteMarketPreview, isCompany, quoteVatNumber, vatCheckSettledKey,
  ]);

  // The Payment Element remounts when the method, the layout or the Stripe
  // account changes; the button waits for the new instance's `ready`.
  useEffect(() => {
    setStripeReady(false);
    setStripeLoadFailed(false);
    setStripeSlow(false);
  }, [paymentMethod, isDesktop, stripeEpoch, availability.publishableKey, availability.stripeAccount]);

  // A Payment Element that is still not ready after the timeout gets the
  // "taking longer than usual" block with a retry (the load can hang).
  const stripeShown = paymentMethod === 'stripe' && stripeAvailable && !nothingToPay;
  useEffect(() => {
    if (!stripeShown || stripeReady || stripeLoadFailed) return;
    const timer = setTimeout(() => setStripeSlow(true), STRIPE_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stripeShown, stripeReady, stripeLoadFailed, stripeElementsKey, isDesktop]);

  // "Try again": remount Elements with a fresh Stripe.js (same form state).
  const retryStripe = useCallback(() => {
    setStripeHandles(null);
    setStripeEpoch((n) => n + 1);
  }, []);

  // A shown payment error is focused so screen readers and keyboard users
  // land on it (only the visible layout's box is focusable on screen).
  const [errorFocusTick, setErrorFocusTick] = useState(0);
  useEffect(() => {
    if (!errorFocusTick) return;
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('[data-checkout-error]'));
    boxes.find((el) => el.offsetParent !== null)?.focus();
  }, [errorFocusTick]);

  // Track viewport so only the active layout mounts the Payment Element.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Keep the selected method valid: COD is the initial default but may be
  // disabled for this store, in which case card is selected instead.
  useEffect(() => {
    const available = { cod: codAvailable, stripe: stripeAvailable } as const;
    if (available[paymentMethod]) return;
    const fallback = (['cod', 'stripe'] as const).find((m) => available[m]);
    if (fallback) setPaymentMethod(fallback);
  }, [codAvailable, stripeAvailable, paymentMethod]);

  // Kustom is handled by its own checkout mode, so the classic form only
  // counts COD and card.
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
      // Phone is optional unless the store requires it (M5.1 checkout settings).
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) errs.phone = t(phoneErr);
      else if (checkoutSettings.phone_required && !form.phone.trim()) errs.phone = t('checkout.errors.phoneRequired');
    }

    if (isCompany) {
      // Mirror of the API's B2B_* rules (M2-DESIGN D7); the API stays authoritative.
      const nameErr = validateCompanyName(form.company_name);
      if (nameErr) errs.company_name = t(nameErr);
      const orgErr = validateOrgNumber(shippingCountryCode, form.org_number, b2bSettings.org_number_countries);
      if (orgErr) errs.org_number = orgErr.format ? t(orgErr.key, { format: orgErr.format }) : t(orgErr.key);
      const vatErr = validateVatNumber(form.vat_number, b2bSettings.require_vat_number);
      if (vatErr) errs.vat_number = t(vatErr);
    }

    if (wantAccount && !isLoggedIn && accountPassword.length < 8) {
      errs.password = t('checkout.errors.fieldRequired');
    }
    if (CUSTOMER_CAPTCHA_ON && !isLoggedIn && !captchaToken) {
      errs.captcha = t('auth.captchaRequired');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // b2b app: company payload for the order (source of truth for the order
  // snapshot, D8) and the pieces saved best-effort on the address / customer.
  function companyPayload() {
    const vat = normalizeVatNumber(form.vat_number);
    return {
      company_name: form.company_name.trim(),
      org_number: normalizeOrgNumber(shippingCountryCode, form.org_number, b2bSettings.org_number_countries),
      ...(vat ? { vat_number: vat } : {}),
      ...(form.buyer_reference.trim() ? { buyer_reference: form.buyer_reference.trim() } : {}),
    };
  }
  // M2.5 (D8): when the shown quote removed VAT by reverse charge for this
  // very number, ask the API to refuse (409) rather than silently charge VAT.
  const b2bBody = () => {
    if (!isCompany) return {};
    const company = companyPayload();
    const expectReverseCharge =
      rcEnabled &&
      exemptReason === 'REVERSE_CHARGE' &&
      Boolean(company.vat_number) &&
      vatComparable(quoteExemption?.vat_number) === vatComparable(company.vat_number);
    return {
      buyer_type: 'COMPANY',
      company,
      ...(expectReverseCharge ? { expect_reverse_charge: true } : {}),
    };
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setShowLogin(false);
    } catch (err: unknown) {
      // Dashboard accounts and other stores' customers get a dedicated
      // message; wrong-password and other failures keep the API error path.
      // login() sends this store's context, so only this store's account matches.
      if (isNotCustomerAccountError(err)) {
        setLoginError(t('auth.dashboardAccountNotAllowed'));
      } else if (isStoreMismatchError(err)) {
        setLoginError(t('auth.wrongStoreAccount'));
      } else {
        setLoginError(apiError(err));
      }
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

  // Card and validation errors come localized from Stripe (Elements locale);
  // anything else gets the generic payment message.
  function stripeErrorMessage(err: StripeError): string {
    if ((err.type === 'card_error' || err.type === 'validation_error') && err.message) return err.message;
    return t('checkout.paymentFailed');
  }

  // The store's Stripe account changed since the page loaded (own key
  // activated / revoked): reload the config, remount Elements with the new
  // key / account and keep the same unpaid order for the retry (its intent
  // is re-requested on the new route). A second consecutive change for the
  // same order drops it, so the next submit creates a fresh order.
  async function handlePaymentRouteChanged() {
    pendingStripeRef.current = pendingAfterRouteChange(pendingStripeRef.current);
    try { await reloadPaymentConfig(); } catch { /* the remount retries with the current config */ }
    setStripeHandles(null);
    setStripeEpoch((n) => n + 1);
    setError(t('checkout.paymentSettingsChanged'));
    setErrorFocusTick((n) => n + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    // Defense in depth — the server rejects COD for stores that disabled it.
    if (noPaymentMethods || (paymentMethod === 'cod' && !codAvailable)) return;
    // Lines unavailable in this market must be removed first (the button is
    // disabled too; this guards an Enter-key submit).
    if (hasUnavailableItems || personalizationBlocked) return;
    // The server ties the order to this store (commission model, payout
    // routing, catalogue check), so don't submit before it has resolved.
    if (!storeId) {
      setError(t('checkout.storeNotReady'));
      return;
    }
    // Stripe: the charged amount comes from the order, so never submit while
    // the quote (the total shown on the button) is being refreshed, and
    // never for an order with nothing to pay.
    if (paymentMethod === 'stripe' && (quoteLoading || nothingToPay)) return;
    if (!validate()) return;
    setError('');
    setErrorCartLink(false);
    setRcNotConfirmed(false);
    submittingRef.current = true;
    setLoading(true);

    let activeToken = token;
    // Set when this submit created a guest account (server-made password).
    let createdGuestAccount = false;
    const fullName = `${form.first_name} ${form.last_name}`.trim();
    // Billing details for the Payment Element: the selected saved address,
    // else what was typed. The billing address is the order address.
    const billingAddress = usingSavedAddress ? activeSavedAddress : null;
    const billingDetails = buildStripeBillingDetails(billingAddress
      ? {
          name: billingAddress.full_name || fullName, email: form.email, phone: billingAddress.phone || form.phone,
          line1: billingAddress.line1, line2: billingAddress.line2, city: billingAddress.city,
          state: billingAddress.state, postal_code: billingAddress.postal_code, country: billingAddress.country_code,
        }
      : {
          name: fullName, email: form.email, phone: form.phone,
          line1: form.line1, line2: form.line2, city: form.city,
          state: form.state, postal_code: form.postal_code, country: form.country_code,
        });
    // The server re-quotes for the address country and rejects an id it no
    // longer offers; a legacy single-cost quote has no id, so nothing is sent
    // and the server picks its default method.
    const shippingMethodBody =
      selectedShippingMethod && !selectedShippingMethod.legacy
        ? { shipping_method_id: selectedShippingMethod.id }
        : {};
    // Everything the Stripe order is made of: an unchanged retry reuses the
    // unpaid order of the previous attempt instead of creating another one.
    const stripeSignature = JSON.stringify({
      form, saved: usingSavedAddress ? selectedAddressId : null, lines: quoteLinesKey,
      shipping: shippingMethodBody, coupon: coupon?.code ?? null, notes: orderNotes,
      b2b: b2bBody(), market: market?.key ?? null, total: displayTotal, currency: paymentCurrency,
    });
    // Handles captured for this attempt (a remount mid-submit must not mix
    // two Stripe.js instances).
    const handles = stripeHandles;
    // A payment-stage error: shown and focused (role="alert" box).
    const failPayment = (message: string) => {
      setError(message);
      setErrorFocusTick((n) => n + 1);
    };
    const pendingCandidate = pendingStripeRef.current;
    const reusable =
      paymentMethod === 'stripe' && token && pendingCandidate &&
      pendingCandidate.signature === stripeSignature && pendingCandidate.token === token
        ? pendingCandidate
        : null;

    try {
      // Stripe: validate the Payment Element first, inside the click, so
      // wallet sheets (Apple Pay / Google Pay) open from the user gesture and
      // nothing is created server-side for incomplete payment details.
      if (paymentMethod === 'stripe') {
        if (!handles) {
          setError(t('checkout.stripeNotLoaded'));
          return;
        }
        const { error: submitError } = await handles.elements.submit();
        if (submitError) {
          failPayment(stripeErrorMessage(submitError));
          return;
        }
      }

      // Guest: auto-register then sync cart
      if (!activeToken) {
        // No password is made in the browser: without a chosen password the
        // server generates one and emails it with a one-click login link.
        try {
          const created = await createCheckoutAccount(
            {
              wantAccount, password: accountPassword,
              email: form.email, first_name: form.first_name, last_name: form.last_name,
              phone: form.phone || undefined,
              storeSlug, hostname: window.location.hostname, locale,
              turnstileToken: captchaToken,
            },
            { register, registerGuest },
          );
          activeToken = created.token;
          createdGuestAccount = created.guest;
        } catch (regErr: unknown) {
          // The captcha token was spent by this attempt.
          if (CUSTOMER_CAPTCHA_ON) setCaptchaReset((n) => n + 1);
          // Accounts are per store: "email exists" means it exists in this
          // store, so the shopper is asked to log in here.
          const regMessage = (regErr as { code?: string } | null)?.code === 'AUTH_EMAIL_EXISTS'
            ? t('auth.emailExistsInStore')
            : apiError(regErr);
          if (wantAccount && accountPassword) {
            try {
              // Same store context as the register call (useAuth adds it).
              await login(form.email, accountPassword);
              activeToken = readStoredAccessToken();
            } catch {
              setError(regMessage);
              setLoading(false);
              return;
            }
          } else {
            setError(regMessage);
            setLoading(false);
            return;
          }
        }

        if (!activeToken) {
          setError(t('checkout.authFailed'));
          setLoading(false);
          return;
        }
        // Lines the server rejects for their personalization stay in the
        // guest cart: stop before any payment and send the buyer to the cart.
        const dropped = await syncGuestCartToServer(activeToken);
        if (dropped.length > 0) {
          const first = dropped[0]!;
          const reason = codedError(first.error);
          setError([
            t('cart.linesNotMoved', { count: dropped.length }),
            reason ? withProduct(first.item.title, reason) : '',
          ].filter(Boolean).join(' '));
          setErrorCartLink(true);
          return;
        }
      }

      // 1. Resolve shipping address
      let addressId = '';
      if (reusable) {
        // Retrying the same unpaid order: its address already exists.
      } else if (usingSavedAddress) {
        addressId = selectedAddressId!;
      } else {
        const company = isCompany ? companyPayload() : null;
        const address = await api<AddressResponse>('/customers/me/addresses', {
          method: 'POST', token: activeToken,
          body: JSON.stringify({
            full_name: fullName, line1: form.line1,
            line2: form.line2 || undefined, city: form.city,
            state: form.state || undefined, postal_code: form.postal_code,
            country_code: form.country_code, phone: form.phone || undefined,
            // b2b app: company fields travel with the (billing) address.
            ...(company
              ? { company_name: company.company_name, org_number: company.org_number, buyer_reference: company.buyer_reference }
              : {}),
          }),
        });
        addressId = address.id;
      }

      // 1b. b2b app: remember the company defaults on the customer (prefill
      // for the next checkout). Best-effort — the order carries the snapshot.
      if (isCompany && !reusable) {
        try {
          const company = companyPayload();
          await api('/customers/me', {
            method: 'PUT', token: activeToken,
            body: JSON.stringify({
              customer_type: 'COMPANY',
              company_name: company.company_name,
              org_number: company.org_number,
              vat_number: company.vat_number ?? null,
            }),
          });
        } catch { /* prefill only */ }
      }

      // 2. Payment
      if (paymentMethod === 'stripe') {
        if (!handles) return;
        const { stripe, elements } = handles;
        // Order-first flow: create the order (awaiting payment) so the server
        // derives the charge amount + the Stripe account, then pay for it.
        let pending = reusable;
        if (!pending) {
          const order = await api<OrderResponse>('/orders', {
            method: 'POST', token: activeToken, headers: paymentViewerHeaders(storeSlug),
            body: JSON.stringify({
              address_id: addressId,
              store_id: storeId,
              payment_method: 'STRIPE',
              ...orderMarketBody(),
              ...b2bBody(),
              ...shippingMethodBody,
              ...(coupon?.code ? { coupon_code: coupon.code } : {}),
              ...(orderNotes ? { notes: orderNotes } : {}),
            }),
          });
          pending = { signature: stripeSignature, token: activeToken, orderId: order.id, clientSecret: null };
          pendingStripeRef.current = pending;
        }
        const orderId = pending.orderId;
        // Set before confirming: a redirect method leaves this page.
        if (createdGuestAccount) rememberGuestAccount(orderId, form.email);
        const confirmationPath = (extra: string) =>
          lp(`/checkout/confirmation?orderId=${encodeURIComponent(orderId)}${extra}`);
        const tokenForOrder = activeToken;
        // The order is placed (paid, or a payment that settles later).
        const finishPlaced = async (state: 'paid' | 'processing') => {
          pendingStripeRef.current = null;
          if (state === 'paid') {
            // Finalize the order server-side immediately (don't depend on
            // the webhook arriving). The webhook remains as a backup.
            try {
              await api('/payments/confirm', {
                method: 'POST', token: tokenForOrder, headers: paymentViewerHeaders(storeSlug),
                body: JSON.stringify({ order_id: orderId }),
              });
            } catch { /* webhook will reconcile as a fallback */ }
          }
          await clearCart();
          router.push(confirmationPath(state === 'processing' ? '&stripe_return=1&redirect_status=processing' : ''));
        };

        let clientSecret = pending.clientSecret;
        if (!clientSecret) {
          const intent = await api<CreateIntentResponse>(
            '/payments/create-intent',
            {
              method: 'POST', token: activeToken, headers: paymentViewerHeaders(storeSlug),
              body: JSON.stringify({ order_id: orderId }),
            },
          );
          const outcome = readCreateIntent(intent, availability.route);
          if (outcome.kind === 'paid' || outcome.kind === 'processing') {
            await finishPlaced(outcome.kind);
            return;
          }
          if (outcome.kind === 'route_changed') {
            // The intent lives on another Stripe account than the one this
            // page loaded Stripe.js for: reload, keep the same order.
            await handlePaymentRouteChanged();
            return;
          }
          if (outcome.kind === 'invalid') {
            failPayment(t('checkout.paymentFailed'));
            return;
          }
          clientSecret = outcome.clientSecret;
          // An intent on the page's route ends a route-change streak.
          pendingStripeRef.current = { ...pending, clientSecret, routeChanges: 0 };
        }

        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            // Redirect methods (Klarna, iDEAL, bank redirects...) come back
            // here; Stripe appends payment_intent + redirect_status.
            return_url: `${window.location.origin}${confirmationPath('&stripe_return=1')}`,
            // The element collects no billing fields (STRIPE_BILLING_FIELDS):
            // all of them come from the form (Klarna needs email + country).
            payment_method_data: { billing_details: billingDetails },
          },
          redirect: 'if_required',
        });
        if (stripeError) {
          const errOutcome = confirmErrorOutcome(stripeError);
          if (errOutcome === 'invalid_details') {
            // Nothing was attempted: same order, same intent.
            failPayment(stripeErrorMessage(stripeError));
            return;
          }
          if (errOutcome === 'declined') {
            // A definitive decline marks the order failed server-side
            // (stock released): the next attempt creates a new order.
            pendingStripeRef.current = null;
            failPayment(stripeErrorMessage(stripeError));
            return;
          }
          if (errOutcome === 'paid' || errOutcome === 'processing') {
            await finishPlaced(errOutcome);
            return;
          }
          // Network / Stripe / unknown error: the charge may have gone
          // through. Check the intent before offering a retry, and keep
          // the order (and intent) so a retry can never charge twice.
          // The server reconcile is asked only when Stripe.js cannot read the
          // intent (it would mark a never-confirmed intent's order failed).
          const retrieved = await stripe.retrievePaymentIntent(clientSecret)
            .then((r) => r.paymentIntent ?? null)
            .catch(() => null);
          const reconciled = retrieved
            ? null
            : await api<ReconcileResponse>('/payments/confirm', {
                method: 'POST', token: tokenForOrder, headers: paymentViewerHeaders(storeSlug),
                body: JSON.stringify({ order_id: orderId }),
              }).catch(() => null);
          const settled = settleUncertainPayment(retrieved, reconciled);
          if (settled === 'paid' || settled === 'processing') {
            await finishPlaced(settled);
            return;
          }
          if (settled === 'failed') {
            pendingStripeRef.current = null;
            failPayment(t('checkout.paymentFailed'));
            return;
          }
          failPayment(t('checkout.paymentUncertain'));
          return;
        }
        const placed = intentStatusOutcome(paymentIntent?.status);
        if (placed === 'paid' || placed === 'processing') {
          // `processing`: bank debits and some methods settle later.
          await finishPlaced(placed);
          return;
        }
        // A failed intent ends the attempt; an open one (e.g. an abandoned
        // authentication) can be retried on the same order and intent.
        if (placed === 'failed') pendingStripeRef.current = null;
        failPayment(t('checkout.paymentFailed'));
      } else {
        const order = await api<OrderResponse>('/orders', {
          method: 'POST', token: activeToken, headers: paymentViewerHeaders(storeSlug),
          body: JSON.stringify({
            address_id: addressId,
            store_id: storeId,
            payment_method: 'COD',
            ...orderMarketBody(),
            ...b2bBody(),
            ...shippingMethodBody,
            ...(coupon?.code ? { coupon_code: coupon.code } : {}),
            ...(orderNotes ? { notes: orderNotes } : {}),
          }),
        });
        await clearCart();
        if (createdGuestAccount) rememberGuestAccount(order.id, form.email);
        router.push(lp(`/checkout/confirmation?orderId=${order.id}`));
      }
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const gone = readUnavailableError(err);
      if (gone) {
        // A product of the cart was deleted / unpublished: drop its lines
        // (guest storage + server cart of this session) and re-quote. The
        // order of this attempt (if any) is not reused.
        pendingStripeRef.current = null;
        const resolved = await removeUnavailableLines(gone, activeToken);
        if (!resolved) {
          setError(t('checkout.itemsUnavailable'));
          setErrorCartLink(true);
          setErrorFocusTick((n) => n + 1);
        }
        setRequoteTick((n) => n + 1);
      } else if (code === 'B2B_REVERSE_CHARGE_NOT_CONFIRMED') {
        // The number could not be confirmed at order time (VIES down, the
        // destination changed…): nothing was charged. Re-quote with VAT and
        // let the buyer confirm the new total.
        setRcNotConfirmed(true);
        // `why: CUSTOMER_EXEMPT`: the account's own exemption applies instead.
        const why = (err as { why?: string } | null)?.why;
        setError(why === 'CUSTOMER_EXEMPT' ? t('b2b.vat.notConfirmedCustomerExempt') : t('errors.B2B_REVERSE_CHARGE_NOT_CONFIRMED'));
        // Mark the quote as loading now so the old (VAT-free) total is never
        // shown as the "new" one and submit waits for the re-quote.
        setQuoteLoading(true);
        setRequoteTick((n) => n + 1);
      } else if (code === 'PAYMENT_ROUTE_CHANGED_RETRY') {
        await handlePaymentRouteChanged();
      } else if (code && STRIPE_UNAVAILABLE_CODES.has(code)) {
        // The store's own Stripe key stopped working: other methods stay,
        // and the reloaded config hides the card option if it is off now.
        setError(t('errors.OWN_KEY_NOT_ACTIVE'));
        setErrorFocusTick((n) => n + 1);
        void reloadPaymentConfig().catch(() => { /* keep the current options */ });
      } else if (code === 'ORDER_SHIPPING_METHOD_INVALID') {
        // The chosen method was removed/disabled meanwhile: show a friendly
        // message and re-quote so the list (and the selection) refresh.
        setError(t('errors.ORDER_SHIPPING_METHOD_INVALID'));
        setRequoteTick((n) => n + 1);
      } else if (isLineErrorCode(code) && t.has(`errors.${code}`)) {
        // A cart line's personalization fails the field rules (M4.0 K2, or
        // the personalization app's evaluator) or its uploaded file expired:
        // the message names the product line (the order is created from the
        // server cart) and links back to the cart.
        setError(lineErrorMessage(err as ApiError, false));
        setErrorCartLink(true);
      } else if (code && code.startsWith('B2B_') && t.has(`errors.${code}`)) {
        // b2b app: the API rejected the company data (format / app off).
        setError(t(`errors.${code}`));
      } else {
        setError(apiError(err));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  // ── Empty cart guard ───────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen store-page flex flex-col items-center justify-center px-4 py-20">
        <UnavailableRemovedNotice className="mb-6 w-full max-w-md" />
        <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
        <p className="text-gray-500 mb-4 text-sm">{t('cart.empty')}</p>
        <Link
          href={lp('/products')}
          className="inline-block rounded-md px-6 py-2.5 text-sm font-medium hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
        >
          {t('cart.continueShopping')}
        </Link>
      </div>
    );
  }

  // Error box shared by both layouts. A refused reverse charge (409) is a
  // warning, not a failure: it shows the re-quoted total to confirm. Without
  // a submit error, a personalization rejection of the quote is shown (M4.0).
  const cartLink = (
    <Link href={lp('/cart')} className="mt-1 block font-medium underline underline-offset-2 hover:opacity-80">
      {t('checkout.returnToCart')}
    </Link>
  );
  const quoteLineMessage = quoteLineError ? lineErrorMessage(quoteLineError.err, quoteLineError.guest) : '';
  const errorBox = (spacing: string) => {
    if (!error) {
      return quoteLineMessage ? (
        <div role="alert" className={`rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 ${spacing}`}>
          <p>{quoteLineMessage}</p>
          {cartLink}
        </div>
      ) : null;
    }
    return rcNotConfirmed ? (
      <div role="alert" tabIndex={-1} data-checkout-error=""
        className={`rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 focus:outline-none ${spacing}`}>
        <p>{error}</p>
        {quote && !quoteLoading && (
          <p className="mt-1 font-semibold">
            {sumTaxLines(taxLines) > 0
              ? t('b2b.vat.newTotal', { total: formatPrice(displayTotal, currency) })
              : t('b2b.vat.newTotalNoVat', { total: formatPrice(displayTotal, currency) })}
          </p>
        )}
      </div>
    ) : (
      <div role="alert" tabIndex={-1} data-checkout-error=""
        className={`rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 focus:outline-none ${spacing}`}>
        {errorCartLink ? <p>{error}</p> : error}
        {errorCartLink && cartLink}
      </div>
    );
  };

  // Submit label per method: card pays inline, COD just places the order.
  // A store may override the card label per locale (M5.1, e.g. Namez's
  // "Betala med kort"); the translated key stays the fallback.
  const payButtonLabel = resolvePayButtonLabel(checkoutSettings, locale);
  // The card button names the amount that will be charged.
  const payAmount = formatPrice(displayTotal, paymentCurrency);
  const submitLabel = paymentMethod === 'stripe'
    ? (payButtonLabel ? `${payButtonLabel} · ${payAmount}` : t('checkout.payAmount', { amount: payAmount }))
    : t('checkout.placeOrder');
  // Card submit waits for a settled quote (the amount on the button).
  const stripeSubmitBlocked = paymentMethod === 'stripe' && (!stripeReady || quoteLoading || nothingToPay);
  // Load error, or not ready in time: offer a remount instead of the spinner.
  const stripeNeedsRetry = !stripeReady && (stripeLoadFailed || stripeSlow);
  const handleStripeReady = () => { setStripeReady(true); setStripeSlow(false); };
  const handleStripeLoadError = () => setStripeLoadFailed(true);

  // Only one Payment Element may be mounted (one Elements provider per
  // layout), so the active layout (desktop tabs / mobile accordion) renders
  // it. A provider keyed by key / account / epoch remounts with a fresh
  // Stripe.js after a payment-route change without touching the form.
  const paymentElement = (layout: 'tabs' | 'accordion') => (
    nothingToPay ? (
      <p className="text-xs text-gray-600">{t('checkout.zeroTotalNoCard')}</p>
    ) : (
      <>
        {stripeNeedsRetry ? (
          <div role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
              {t('checkout.paymentFormSlow')}
            </p>
            {stripeLoadFailed && <p className="mt-1 text-xs text-amber-800">{t('checkout.stripeLoadFailed')}</p>}
            <button
              type="button"
              onClick={retryStripe}
              className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
            >
              {t('checkout.retry')}
            </button>
          </div>
        ) : !stripeReady ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: 'var(--store-primary, #2563eb)' }} aria-hidden />
            {t('checkout.paymentFormLoading')}
          </div>
        ) : null}
        {/* Kept mounted while loading (hidden, so no faint skeleton bars);
            shown once the element reports ready. */}
        <div
          aria-hidden={!stripeReady}
          className={stripeReady ? '' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}
        >
          <Elements key={stripeElementsKey} stripe={stripePromise} options={stripeOptions}>
            <StripePaymentBridge
              layout={layout}
              onBind={setStripeHandles}
              onReady={handleStripeReady}
              onLoadError={handleStripeLoadError}
            />
          </Elements>
        </div>
      </>
    )
  );
  // Owner preview with a Stripe test key (the API only says so to the owner),
  // and the pre-live preview note (only test card payments are accepted).
  const testModeBanner = (availability.testMode && stripeAvailable) || availability.ownerPreview ? (
    <div role="status" className="mb-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
      {availability.ownerPreview && <p>{t('checkout.ownerPreviewNotice')}</p>}
      {availability.testMode && stripeAvailable && <p>{t('checkout.testModeBanner')}</p>}
    </div>
  ) : null;
  // Card is off for this store: no selectable option, just a short note
  // when another method is offered.
  const stripeUnavailableNote = !stripeAvailable && !noPaymentMethods ? (
    <p className="text-xs text-gray-500">{t('checkout.stripeNotConfigured')}</p>
  ) : null;

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
          <span className="text-sm font-bold text-gray-900">{formatPrice(displayTotal, currency)}</span>
        </button>
        {summaryOpen && (
          <div className="px-4 pb-5 pt-3 border-t border-gray-200">
            <OrderSummary
              items={items} subtotal={summarySubtotal} discount={summaryDiscount}
              total={displayTotal} currency={currency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={shippingCost} shippingEstimate={shippingEstimate}
              shippingLoading={shippingLoading} shippingError={shippingError}
              effectiveShipping={effectiveShipping}
              shippingMethodName={selectedShippingMethod?.name}
              taxLines={taxLines} pricingMode={pricingMode}
              taxEstimated={taxEstimated} taxPending={taxPending}
              b2bNet={b2bNet} netItems={netItems}
              exemptReason={exemptReason} exemptPrices={exemptPrices}
              onRemoveUnavailable={removeItem}
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

            {testModeBanner}

            {/* Coupon captured from a campaign link (M5.1) */}
            <CouponAutoApplyNotice className="mb-5" />
            {/* Lines of deleted / unpublished products were dropped. */}
            <UnavailableRemovedNotice className="mb-5" />

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
                        className={inputCls(!!fieldErrors.password)} placeholder={t('checkout.passwordPlaceholder')} />
                      {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
                    </div>
                  )}
                  <CustomerCaptcha className="mt-3" onToken={setCaptchaToken} resetSignal={captchaReset} />
                  {fieldErrors.captcha && <p className="mt-1 text-xs text-red-500">{fieldErrors.captcha}</p>}
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
                              {addr.company_name && (
                                <p className="text-xs text-gray-700">{addr.company_name}</p>
                              )}
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
                      {countryOptions.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
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
                      <Label htmlFor="ck_phone" required={checkoutSettings.phone_required}>{t('checkout.phone')}</Label>
                      <input id="ck_phone" name="phone" type="tel" value={form.phone}
                        onChange={handleChange} className={inputCls(!!fieldErrors.phone)} />
                      {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
                    </div>
                  </div>
                </>
              )}

              {/* ── Company details (b2b app, company view) ── */}
              {/* Shown for saved addresses too: a saved address may lack the
                  company fields; the order body is the snapshot's source. */}
              {isCompany && (
                <>
                  <SectionHeading>{t('b2b.companyDetails')}</SectionHeading>

                  <div className="mb-3">
                    <Label htmlFor="ck_company" required>{t('b2b.companyName')}</Label>
                    <input id="ck_company" name="company_name" type="text" value={form.company_name}
                      onChange={handleChange} className={inputCls(!!fieldErrors.company_name)} autoComplete="organization" />
                    {fieldErrors.company_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.company_name}</p>}
                  </div>

                  <div className={rcEnabled ? 'space-y-3 mb-3' : 'grid grid-cols-2 gap-3 mb-3'}>
                    <div>
                      <Label htmlFor="ck_org" required>{t('b2b.orgNumber')}</Label>
                      <input id="ck_org" name="org_number" type="text" value={form.org_number}
                        onChange={handleChange} className={inputCls(!!fieldErrors.org_number)}
                        placeholder={orgNumberFormatHint(shippingCountryCode, b2bSettings.org_number_countries)} />
                      {fieldErrors.org_number
                        ? <p className="mt-1 text-xs text-red-500">{fieldErrors.org_number}</p>
                        : <p className="mt-1 text-xs text-gray-400">{t('b2b.orgNumberFormat', { format: orgNumberFormatHint(shippingCountryCode, b2bSettings.org_number_countries) })}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ck_vat" required={b2bSettings.require_vat_number}>{t('b2b.vatNumber')}</Label>
                      {rcEnabled ? (
                        // M2.5: live VIES check for the shipping destination.
                        <VatNumberField
                          id="ck_vat" value={form.vat_number} onChange={handleChange}
                          storeSlug={storeSlug} countryCode={shippingCountryCode}
                          error={fieldErrors.vat_number} placeholder="SE556677889901"
                          inputClassName={inputCls} onResult={setVatCheck}
                        />
                      ) : (
                        <>
                          <input id="ck_vat" name="vat_number" type="text" value={form.vat_number}
                            onChange={handleChange} className={inputCls(!!fieldErrors.vat_number)} placeholder="SE556677889901" />
                          {fieldErrors.vat_number && <p className="mt-1 text-xs text-red-500">{fieldErrors.vat_number}</p>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <Label htmlFor="ck_ref">{t('b2b.reference')}</Label>
                    <input id="ck_ref" name="buyer_reference" type="text" value={form.buyer_reference}
                      onChange={handleChange} className={inputCls()} maxLength={100} />
                  </div>
                </>
              )}

              {/* ── Shipping method ── */}
              {/* The form column is shared by the desktop and mobile layouts,
                  so a single list serves both. Rendered once a country is
                  known; each row shows name, transit time and price. */}
              {shippingCountryCode && (
                <>
                  <SectionHeading>{t('checkout.shippingMethod')}</SectionHeading>
                  <div className="mb-5">
                    {shippingLoading ? (
                      <p className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.loading')}
                      </p>
                    ) : shippingError ? (
                      <div className="p-3 rounded-lg border-2 border-red-200 bg-red-50 text-xs text-red-700">
                        {shippingError}
                      </div>
                    ) : (
                      <div role="radiogroup" aria-label={t('checkout.shippingMethod')} className="space-y-2">
                        {shippingMethods.map((method) => {
                          const isActive = selectedShippingMethod?.id === method.id;
                          const daysLabel = method.type === 'PICKUP'
                            ? t('checkout.pickUpInStore')
                            : method.estimated_days
                              ? `${method.estimated_days.min === method.estimated_days.max
                                  ? method.estimated_days.min
                                  : `${method.estimated_days.min}–${method.estimated_days.max}`} ${t('checkout.businessDays')}`
                              : '';
                          return (
                            <label
                              key={method.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                                isActive ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="shipping_method"
                                value={method.id}
                                checked={isActive}
                                onChange={() => setSelectedShippingMethodId(method.id)}
                                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800">{method.name}</p>
                                {daysLabel && <p className="text-xs text-gray-500 mt-0.5">{daysLabel}</p>}
                              </div>
                              <span className={`text-sm font-medium shrink-0 ${method.cost === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {method.cost === 0 ? t('checkout.free') : formatPrice(method.cost, currency)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
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
              items={items} subtotal={summarySubtotal} discount={summaryDiscount}
              total={displayTotal} currency={currency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={shippingCost} shippingEstimate={shippingEstimate}
              shippingLoading={shippingLoading} shippingError={shippingError}
              effectiveShipping={effectiveShipping}
              shippingMethodName={selectedShippingMethod?.name}
              taxLines={taxLines} pricingMode={pricingMode}
              taxEstimated={taxEstimated} taxPending={taxPending}
              b2bNet={b2bNet} netItems={netItems}
              exemptReason={exemptReason} exemptPrices={exemptPrices}
              onRemoveUnavailable={removeItem}
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
                        <p className="text-sm font-medium text-gray-800">{t('checkout.stripeMethods')}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('checkout.stripeDescription')}</p>
                      </div>
                    </label>
                    {paymentMethod === 'stripe' && isDesktop && (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
                        {paymentElement('tabs')}
                      </div>
                    )}
                  </div>
                ) : stripeUnavailableNote}

                {kustomAvailable && (
                  <Link
                    href={lp('/checkout')}
                    className="block pt-1 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
                  >
                    {t('checkout.payWithKustomInstead')}
                  </Link>
                )}
              </div>
            </div>

            {/* Error */}
            {errorBox('mt-4')}

            {/* Submit */}
            <button
              type="submit"
              disabled={previewMode || loading || hasUnavailableItems || personalizationBlocked || noPaymentMethods || stripeSubmitBlocked || !!shippingError || shippingLoading || (rcNotConfirmed && quoteLoading)}
              className="w-full mt-5 py-4 text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('checkout.processing')}</>
                : <><Lock className="w-4 h-4" />{submitLabel}</>
              }
            </button>
            {previewMode && <MarketPreviewCheckoutNotice className="mt-2" />}
            {hasUnavailableItems && <RemoveUnavailableHint className="mt-2" />}
            {personalizationBlocked && <InvalidPersonalizationHint items={items} className="mt-2" />}

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
              {stripeUnavailableNote}
              {stripeAvailable && (
                <div>
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <input type="radio" name="payment_mobile" value="stripe"
                      checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t('checkout.stripeMethods')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t('checkout.stripeDescription')}</p>
                    </div>
                  </label>
                  {paymentMethod === 'stripe' && !isDesktop && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
                      {paymentElement('accordion')}
                    </div>
                  )}
                </div>
              )}
              {kustomAvailable && (
                <Link
                  href={lp('/checkout')}
                  className="block pt-1 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
                >
                  {t('checkout.payWithKustomInstead')}
                </Link>
              )}
            </div>
            {errorBox('mb-4')}
            <button
              type="submit"
              disabled={previewMode || loading || hasUnavailableItems || personalizationBlocked || noPaymentMethods || stripeSubmitBlocked || !!shippingError || shippingLoading || (rcNotConfirmed && quoteLoading)}
              className="w-full py-4 text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('checkout.processing')}</>
                : <><Lock className="w-4 h-4" />{submitLabel}</>
              }
            </button>
            {previewMode && <MarketPreviewCheckoutNotice className="mt-2" />}
            {hasUnavailableItems && <RemoveUnavailableHint className="mt-2" />}
            {personalizationBlocked && <InvalidPersonalizationHint items={items} className="mt-2" />}
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

function LoadingState() {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      {t('common.loading')}
    </div>
  );
}

// ── Mode router ────────────────────────────────────────────────────────────────
// Resolves what this store can accept, then picks the checkout mode: Kustom
// (address + payment inside Kustom's iframe) is the default whenever the store
// offers it; `?method=classic` — or a store without Kustom — gets the form
// above. Availability is fetched once here so neither mode flashes the wrong UI.
function CheckoutRouter() {
  const storeSlug = (useParams<{ storeSlug: string }>()?.storeSlug as string) || '';
  const searchParams = useSearchParams();
  const wantsClassic = searchParams.get('method') === 'classic';
  const [availability, setAvailability] = useState<PaymentAvailability | null>(null);
  // Markets app: `kustom_enabled` / currency must reflect the request market.
  const routerMarket = useMarket();
  const routerMarketKey = routerMarket?.key;
  // Market preview: a Kustom session is LIVE-only (the API refuses it), so
  // the preview always shows the classic form with its pay button disabled.
  const previewMode = useMarketPreview();

  // Store flags of this visit; the payment config part is reloadable
  // (the store's Stripe route can change while the page is open).
  const storeFlagsRef = useRef<StorePaymentFlags | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const flags: StorePaymentFlags = { storeId: undefined, cod: false, card: true, kustom: true, ownerPreview: false };
      if (storeSlug) {
        try {
          const store = await storefront.getStore(storeSlug, routerMarket) as {
            id: string;
            card_payments_enabled?: boolean;
            cod_enabled?: boolean;
            kustom_enabled?: boolean;
            preview?: boolean;
          };
          flags.storeId = store.id;
          // `preview: true` = a non-LIVE store served to its owner / an admin.
          flags.ownerPreview = store.preview === true;
          // The creator must have completed Stripe onboarding for this
          // store to accept card payments.
          flags.card = store.card_payments_enabled !== false;
          // Cash on delivery is opt-in per store (off by default server-side):
          // strict check so COD stays hidden for stores that haven't enabled it.
          flags.cod = store.cod_enabled === true;
          flags.kustom = store.kustom_enabled !== false;
        } catch { /* ignore */ }
      }
      let config: PaymentConfig | null = null;
      try {
        config = await api<PaymentConfig>(paymentConfigPath(storeSlug, routerMarket), paymentConfigFetchOptions(storeSlug));
      } catch {
        config = null;
      }
      if (cancelled) return;
      storeFlagsRef.current = flags;
      setAvailability(buildAvailability(flags, config));
    }
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `routerMarket` only changes with its key
  }, [storeSlug, routerMarketKey]);

  // Re-read only the payment config (no loading state: the form stays).
  const reloadPaymentConfig = useCallback(async () => {
    const flags = storeFlagsRef.current;
    if (!flags) return;
    const config = await api<PaymentConfig>(paymentConfigPath(storeSlug, routerMarket), paymentConfigFetchOptions(storeSlug));
    setAvailability(buildAvailability(flags, config));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `routerMarket` only changes with its key
  }, [storeSlug, routerMarketKey]);

  if (!availability) return <LoadingState />;

  const classicPossible = availability.cod || availability.stripe;
  // `?method=classic` is honoured only when there is something to pay with there.
  const mode = !previewMode && availability.kustom && (!wantsClassic || !classicPossible) ? 'kustom' : 'classic';

  if (mode === 'kustom') {
    return <KustomCheckout storeSlug={storeSlug} classicAvailable={classicPossible} />;
  }
  return <CheckoutForm availability={availability} reloadPaymentConfig={reloadPaymentConfig} />;
}

export default function StoreCheckoutPage() {
  // useSearchParams needs a Suspense boundary on client pages so the static
  // shell can render before the query string is known.
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckoutRouter />
    </Suspense>
  );
}
