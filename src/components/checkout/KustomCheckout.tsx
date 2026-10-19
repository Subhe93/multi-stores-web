'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ChevronRight, Loader2, Lock, ShoppingBag } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { RemoveUnavailableHint } from '@/components/cart/UnavailableInMarket';
import { InvalidPersonalizationHint, hasInvalidPersonalization } from '@/components/cart/InvalidPersonalizationHint';
import { useMarket } from '@/hooks/useMarket';
import { useBuyerType } from '@/hooks/useBuyerType';
import { useKustomCheckout, type KustomCompanyPrefill } from '@/hooks/useKustomCheckout';
import { KustomSnippet } from '@/components/checkout/KustomSnippet';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { VatNumberField } from '@/components/checkout/VatNumberField';
import { normalizeVatNumber } from '@/lib/b2bValidators';
import { vatCheckMessageKey, vatComparable, type VatCheckResult } from '@/lib/vatCheck';
import { exemptLinePrices } from '@/lib/taxExemption';

// ── Kustom-first checkout ─────────────────────────────────────────────────────
// Address, shipping and payment all happen inside Kustom's iframe; this page
// only shows the editable order summary next to it and keeps the Kustom
// session in sync (see useKustomCheckout). The API creates the order from the
// session when Kustom's validation callback fires.

interface KustomCheckoutProps {
  storeSlug: string;
  /** COD or card is available, so a link to the classic form is offered. */
  classicAvailable: boolean;
}

// `reason` codes the API puts on `?error=kustom_validation` redirects
// (API-CONTRACT-B, "Order creation inside /validation").
const VALIDATION_REASON_KEYS: Record<string, string> = {
  amount_changed: 'checkout.kustomValidationReasons.amountChanged',
  out_of_stock: 'checkout.kustomValidationReasons.outOfStock',
  coupon_invalid: 'checkout.kustomValidationReasons.couponInvalid',
  unavailable: 'checkout.kustomValidationReasons.unavailable',
};

const inputCls = (err?: boolean) =>
  `w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 transition focus:outline-none focus:ring-2 ${
    err
      ? 'border-red-400 focus:ring-red-500/20 focus:border-red-400'
      : 'border-gray-300 focus:ring-blue-500/20 focus:border-blue-500'
  }`;

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label}
    </div>
  );
}

export function KustomCheckout({ storeSlug, classicAvailable }: KustomCheckoutProps) {
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();
  const searchParams = useSearchParams();
  const { token, user, loading: authLoading, refresh: refreshAuth } = useAuth();
  const {
    items, subtotal, total, coupon, currency, loading: cartLoading,
    taxLines: cartTaxLines, taxPricingMode, taxEstimated: cartTaxEstimated,
    b2bNet: cartB2bNet, netItems,
    updateQuantity, removeItem, applyCoupon, removeCoupon,
    hasUnavailableItems,
  } = useCart();
  // Personalization app: an invalid line personalization blocks the session
  // like an unavailable line, until it is fixed in the cart.
  const personalizationBlocked = hasInvalidPersonalization(items);
  // Markets app: request market, forwarded to the session (null otherwise).
  const market = useMarket();
  // b2b app (M2-DESIGN §4.4): buyer type + the account's company defaults go
  // to the session; Kustom collects / validates the organisation data in
  // its iframe. `enabled` is false without the app → nothing is sent.
  const { enabled: b2bEnabled, isCompany, settings: b2bSettings } = useBuyerType();
  const companyName = user?.customer?.company_name || '';
  const orgNumber = user?.customer?.org_number || '';
  const vatNumber = user?.customer?.vat_number || '';
  // M2.5 (reverse charge on): a small company panel above the iframe lets
  // the buyer enter / confirm name, org number and VAT number. All three go
  // to the session on blur (the session re-prices through `changeKey`); the
  // live check only explains the outcome, the API decides reverse charge.
  // Fields left untouched show the account defaults.
  const rcEnabled = b2bEnabled && isCompany && b2bSettings.reverse_charge_enabled;
  const [rcDraft, setRcDraft] = useState<{ company_name?: string; org_number?: string; vat_number?: string }>({});
  const [rcApplied, setRcApplied] = useState<{ company_name?: string; org_number?: string; vat_number?: string }>({});
  const [rcVat, setRcVat] = useState<VatCheckResult | null>(null);
  const rcName = (rcDraft.company_name ?? companyName);
  const rcOrg = (rcDraft.org_number ?? orgNumber);
  const rcVatInput = rcDraft.vat_number ?? vatNumber;
  const rcAppliedName = (rcApplied.company_name ?? companyName).trim();
  const rcAppliedOrg = (rcApplied.org_number ?? orgNumber).trim();
  const rcAppliedVat = normalizeVatNumber(rcApplied.vat_number ?? vatNumber);
  const rcValidVat =
    rcVat && rcVat.state === 'valid' && vatComparable(rcVat.vatNumber) === vatComparable(rcVatInput) ? rcVat.vatNumber : '';
  // A valid number cannot be applied without the company identity: say so.
  const rcMissingCompany = rcEnabled && Boolean(rcValidVat) && (!rcAppliedName || !rcAppliedOrg);
  const companyPrefill = useMemo<KustomCompanyPrefill | null>(() => {
    if (rcEnabled) {
      if (!rcAppliedName || !rcAppliedOrg) return null;
      return { company_name: rcAppliedName, org_number: rcAppliedOrg, ...(rcAppliedVat ? { vat_number: rcAppliedVat } : {}) };
    }
    if (!isCompany || !companyName || !orgNumber) return null;
    return { company_name: companyName, org_number: orgNumber, ...(vatNumber ? { vat_number: vatNumber } : {}) };
  }, [rcEnabled, rcAppliedName, rcAppliedOrg, rcAppliedVat, isCompany, companyName, orgNumber, vatNumber]);
  const onRcChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRcDraft((d) => ({ ...d, [name]: value }));
  };
  const applyRcCompany = () => setRcApplied({ company_name: rcName, org_number: rcOrg, vat_number: rcVatInput });

  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const discount = coupon
    ? coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount
    : 0;

  const { html, loading, updating, failed, syncFailed, totals, totalsBuyer, retry } = useKustomCheckout({
    storeSlug,
    locale,
    marketKey: market?.key ?? null,
    // Wait for auth (so the JWT is attached) and for the cart to be loaded.
    // Lines unavailable in the market, or with an invalid personalization,
    // block the session until removed or fixed.
    enabled: !authLoading && !cartLoading && !hasUnavailableItems && !personalizationBlocked,
    authToken: token,
    refreshAuth,
    items,
    couponCode: coupon?.code ?? null,
    notes: orderNotes,
    buyer: b2bEnabled ? (isCompany ? 'company' : 'person') : null,
    company: companyPrefill,
  });

  // The session's `totals` are what the iframe charges (shipping once Kustom
  // knows the address, tax for the destination), so the summary prefers them
  // over the client-side cart figures.
  const summarySubtotal = totals ? totals.subtotal : subtotal;
  const summaryDiscount = totals ? totals.discount_amount : discount;
  const summaryShipping = totals && totals.shipping_cost > 0 ? totals.shipping_cost : null;
  const summaryTotal = totals ? totals.total : total;
  const summaryPricingMode = totals ? totals.pricing_mode : taxPricingMode;
  const summaryTaxLines = totals
    ? totals.tax_lines
    : summaryPricingMode === 'INCLUSIVE' ? cartTaxLines : [];
  const summaryTaxEstimated = totals ? false : cartTaxEstimated;
  // Company view: the session's net block once there is one, else the cart's.
  const summaryB2bNet = totals ? totals.b2b ?? null : cartB2bNet;
  // M2.5: exemption the session priced with (Kustom knows the destination).
  // Ignored while the totals still belong to the previous buyer type.
  const currentBuyer = b2bEnabled ? (isCompany ? 'company' : 'person') : null;
  const summaryExemptReason = totals && totalsBuyer === currentBuyer ? totals.tax_exempt_reason ?? null : null;
  const totalsItems = totals?.items;
  const summaryExemptPrices = useMemo(
    () => (summaryExemptReason ? exemptLinePrices(totalsItems, items) : null),
    [summaryExemptReason, totalsItems, items],
  );
  const sessionWhy = totals?.tax_exemption?.why ?? null;
  const sessionRcMessage = !rcEnabled || !totals?.tax_exemption
    ? null
    : summaryExemptReason === 'REVERSE_CHARGE'
      ? { key: 'b2b.vat.reverseChargeApplied', tone: 'success' as const }
      : rcValidVat && sessionWhy !== 'NO_DESTINATION' && vatComparable(totals.tax_exemption.vat_number) === vatComparable(rcValidVat)
        ? vatCheckMessageKey('valid', false, sessionWhy)
        : null;
  // The session is priced in the store's charge currency, which is the one to
  // format its figures in; fall back to the cart currency on older API builds.
  const summaryCurrency = totals?.currency || currency;

  // Kustom's callbacks send the customer back here with an error code when
  // shipping is impossible or the order could not be created.
  const errorParam = searchParams.get('error');
  const reasonParam = searchParams.get('reason');
  const callbackMessage = useMemo(() => {
    if (errorParam === 'shipping_unavailable') return t('checkout.shippingUnavailable');
    if (errorParam === 'kustom_validation') {
      const key = reasonParam ? VALIDATION_REASON_KEYS[reasonParam] : undefined;
      return key ? t(key) : t('checkout.kustomValidationFailed');
    }
    return null;
  }, [errorParam, reasonParam, t]);

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

  // ── Empty cart guard ───────────────────────────────────────────────────────
  if (!cartLoading && items.length === 0) {
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

  const showSnippetLoading = loading || (!failed && !html);

  return (
    <div className="flex-1 max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center flex-wrap gap-1.5 text-xs text-gray-400 mb-7">
        <Link href={lp('/cart')} className="hover:text-gray-600 transition-colors">
          {t('cart.title')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium text-sm">{t('checkout.title')}</span>
      </nav>

      {callbackMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{callbackMessage}</span>
        </div>
      )}
      {syncFailed && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('checkout.kustomSyncFailed')}</span>
        </div>
      )}

      {/* Two columns from lg up; on smaller screens the summary comes first
          so the customer sees what they are paying for before the iframe. */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

        {/* ── Order summary (editable) ── */}
        <aside className="w-full lg:w-[45%] lg:shrink-0">
          <div className="rounded-lg store-surface border store-bd p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5 uppercase tracking-wide">
              {t('checkout.orderSummary')}
            </h2>
            <OrderSummary
              items={items} subtotal={summarySubtotal} discount={summaryDiscount}
              total={summaryTotal} currency={summaryCurrency} coupon={coupon}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponLoading={couponLoading} couponError={couponError}
              onApplyCoupon={handleApplyCoupon} onRemoveCoupon={() => removeCoupon()}
              shippingCost={summaryShipping} shippingEstimate={null}
              shippingLoading={false} shippingError=""
              effectiveShipping={summaryShipping ?? 0}
              shippingNote={summaryShipping === null ? t('checkout.shippingCalculatedInKustom') : undefined}
              taxLines={summaryTaxLines} pricingMode={summaryPricingMode}
              taxEstimated={summaryTaxEstimated} taxPending={!totals && updating}
              b2bNet={summaryB2bNet} netItems={netItems}
              exemptReason={summaryExemptReason} exemptPrices={summaryExemptPrices}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              t={t as (key: string) => string}
            />

            {/* Order notes */}
            <div className="mt-5">
              <label htmlFor="ck_notes" className="block text-xs font-medium text-gray-700 mb-1">
                {t('checkout.orderNotes')}
              </label>
              <textarea
                id="ck_notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                placeholder={t('checkout.orderNotesPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            {classicAvailable && (
              <Link
                href={lp('/checkout?method=classic')}
                className="inline-block mt-4 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
              >
                {t('checkout.payOtherWay')}
              </Link>
            )}
          </div>
        </aside>

        {/* ── Kustom checkout ── */}
        <section className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-4 min-h-[1.75rem]">
            <h2 className="text-base font-semibold text-gray-900">{t('checkout.payWithKustom')}</h2>
            {updating && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('checkout.kustomUpdating')}
              </span>
            )}
          </div>

          {rcEnabled && (
            <div className="mb-5 rounded-lg store-surface border store-bd p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('b2b.companyDetails')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="kc_company" className="block text-xs font-medium text-gray-700 mb-1">
                    {t('b2b.companyName')}<span className="text-red-500 ms-0.5">*</span>
                  </label>
                  <input id="kc_company" name="company_name" type="text" value={rcName} required aria-required
                    onChange={onRcChange} onBlur={applyRcCompany} className={inputCls(rcMissingCompany && !rcAppliedName)} autoComplete="organization" />
                </div>
                <div>
                  <label htmlFor="kc_org" className="block text-xs font-medium text-gray-700 mb-1">
                    {t('b2b.orgNumber')}<span className="text-red-500 ms-0.5">*</span>
                  </label>
                  <input id="kc_org" name="org_number" type="text" value={rcOrg} required aria-required
                    onChange={onRcChange} onBlur={applyRcCompany} className={inputCls(rcMissingCompany && !rcAppliedOrg)} />
                </div>
              </div>
              <label htmlFor="kc_vat" className="block text-xs font-medium text-gray-700 mb-1">{t('b2b.vatNumber')}</label>
              {/* No destination yet: Kustom collects the address, the session
                  decides reverse charge for it (message below). */}
              <VatNumberField
                id="kc_vat" value={rcVatInput} onChange={onRcChange}
                storeSlug={storeSlug} placeholder="DE123456789"
                inputClassName={inputCls} onResult={setRcVat} onBlur={applyRcCompany}
              />
              {rcMissingCompany && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700" role="alert">
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                  {t('b2b.vat.companyRequired')}
                </p>
              )}
              {sessionRcMessage && (
                <p className={`mt-2 text-xs ${sessionRcMessage.tone === 'success' ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                  {t(sessionRcMessage.key)}
                </p>
              )}
            </div>
          )}

          {hasUnavailableItems ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-4">
              <RemoveUnavailableHint />
            </div>
          ) : personalizationBlocked ? (
            <InvalidPersonalizationHint items={items} />
          ) : failed ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
              <p>{t('checkout.kustomSessionFailed')}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                <button
                  type="button"
                  onClick={retry}
                  className="font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                >
                  {t('checkout.retry')}
                </button>
                {classicAvailable && (
                  <Link
                    href={lp('/checkout?method=classic')}
                    className="font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                  >
                    {t('checkout.payOtherWay')}
                  </Link>
                )}
              </div>
            </div>
          ) : showSnippetLoading ? (
            <LoadingState label={t('checkout.kustomLoading')} />
          ) : (
            // The Kustom container must stay unstyled and free to grow with
            // the iframe, so only the wrapper receives layout classes.
            <KustomSnippet html={html!} className="w-full" />
          )}

          <p className="mt-6 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            {t('checkout.allTransactionsSecure')}
          </p>
        </section>
      </div>
    </div>
  );
}
