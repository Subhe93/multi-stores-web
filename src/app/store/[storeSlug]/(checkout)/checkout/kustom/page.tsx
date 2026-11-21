'use client';

import { enter, useFlowMotion } from '@/components/cart/FlowMotion';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ChevronRight, Loader2, Lock } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { api, storefront } from '@/lib/api';
import { useMarket } from '@/hooks/useMarket';
import { apiErrorCode, kustomOrderFirstAction, type StorePaymentPayload } from '@/lib/checkoutPayment';
import { KustomSnippet } from '@/components/checkout/KustomSnippet';
import { navigateRespectingClarity } from '@/components/tracking/clarity';

// Response of POST /payments/kustom/session (see plans/kustom-integration/API-CONTRACT.md).
interface KustomSessionResponse {
  kustom_order_id: string;
  html_snippet: string;
  status: string;
}

interface SessionError {
  /** Server-provided message when available; empty means "use the generic copy". */
  message: string;
  /** Translation key that replaces the message (M157 coded refusals). */
  messageKey?: string;
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label}
    </div>
  );
}

// Order-first Kustom flow: the order already exists (awaiting payment) and this
// page asks the API for a Kustom checkout session, then mounts the returned
// snippet. Kustom's validation callback sends the customer back here with
// `?error=kustom_validation` when it rejects the purchase — in that case we
// surface the message and still (re)load the session so they can retry.
function KustomCheckoutContent() {
  const t = useTranslations();
  const motion = useFlowMotion();
  const lp = useLocalePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const validationFailed = searchParams.get('error') === 'kustom_validation';
  const { token, loading: authLoading } = useAuth();
  const storeSlug = (useParams<{ storeSlug: string }>()?.storeSlug as string) || '';
  // Markets app (M157): a market may not offer Kustom. The store payload of
  // the request market says so (`kustom_enabled: false`); the session is then
  // never requested and the shopper goes back to the checkout.
  const market = useMarket();
  const marketKey = market?.key;
  const [kustomAllowed, setKustomAllowed] = useState<boolean | null>(storeSlug ? null : true);
  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    storefront.getStore(storeSlug, market)
      .then((store) => {
        if (cancelled) return;
        const offersKustom = (store as StorePaymentPayload).kustom_enabled !== false;
        if (!offersKustom) router.replace(lp('/checkout'));
        setKustomAllowed(offersKustom);
      })
      // A failed read does not block: the session endpoint enforces the rule.
      .catch(() => { if (!cancelled) setKustomAllowed(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `market` only changes with its key
  }, [storeSlug, marketKey]);

  const [html, setHtml] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<SessionError | null>(null);
  const [loading, setLoading] = useState(true);
  // One session request per order id, shared across effect re-runs (React
  // strict mode, fast re-renders): two concurrent requests would make Kustom
  // open two sessions and the customer might pay in the one we discarded.
  const requestRef = useRef<{ orderId: string; promise: Promise<KustomSessionResponse> } | null>(null);

  // Same guard as the account area: the session endpoint is customer-scoped,
  // so a visitor without a token is sent to log in once auth has resolved.
  useEffect(() => {
    if (!authLoading && !token) router.replace(lp('/auth/login'));
  }, [authLoading, token, router, lp]);

  useEffect(() => {
    if (!token || !orderId || kustomAllowed !== true) return;
    let cancelled = false;
    let request = requestRef.current;
    if (!request || request.orderId !== orderId) {
      request = {
        orderId,
        promise: api<KustomSessionResponse>('/payments/kustom/session', {
          method: 'POST',
          token,
          body: JSON.stringify({ order_id: orderId }),
        }),
      };
      requestRef.current = request;
    }
    request.promise
      .then((res) => {
        if (cancelled) return;
        // Already paid (e.g. completed in another tab): the snippet Kustom
        // returns now is the confirmation one, which belongs on the
        // confirmation page — go there instead of embedding it here.
        if (res.status.toLowerCase() === 'checkout_complete') {
          // A full page load when Clarity ran here (never on confirmations).
          navigateRespectingClarity(
            lp(`/checkout/kustom/confirmation?orderId=${encodeURIComponent(orderId)}`),
            (href) => router.replace(href),
            true,
          );
          return;
        }
        setHtml(res.html_snippet);
        setSessionError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Allow a retry on the next render cycle (e.g. after a re-login).
        if (requestRef.current === request) requestRef.current = null;
        // M157: Kustom is not offered for this order here (market setting,
        // or Kustom off): back to the checkout. A currency Kustom cannot
        // take gets a friendly message instead of the raw one.
        const action = kustomOrderFirstAction(apiErrorCode(err));
        if (action === 'checkout') {
          router.replace(lp('/checkout'));
          return;
        }
        if (action === 'currency') {
          setSessionError({ message: '', messageKey: 'checkout.kustomCurrencyNotEnabledNoCard' });
          return;
        }
        // Our own API messages are written for customers; raw upstream
        // (Kustom) errors are not, so those fall back to the generic copy.
        const message = err instanceof Error ? err.message : '';
        setSessionError({ message: /^kustom /i.test(message) ? '' : message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, orderId, router, lp, kustomAllowed]);

  const missingOrder = !orderId;
  const showError = missingOrder || sessionError !== null;
  // Auth still resolving, redirect pending, or the session request in flight.
  const showLoading = !showError && (authLoading || !token || loading || kustomAllowed !== true);

  return (
    <div className="max-w-[1100px] mx-auto w-full px-5 sm:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center flex-wrap gap-1.5 text-xs text-gray-400 mb-7">
        <Link href={lp('/cart')} className="hover:text-gray-600 transition-colors">
          {t('cart.title')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={lp('/checkout')} className="hover:text-gray-600 transition-colors">
          {t('checkout.billingDetails')}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium text-sm">{t('checkout.payment')}</span>
      </nav>

      <h1 className="text-xl font-semibold text-gray-900 mb-5" {...enter(motion)}>{t('checkout.payment')}</h1>

      {validationFailed && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('checkout.kustomValidationFailed')}</span>
        </div>
      )}

      {showLoading && <LoadingState label={t('common.loading')} />}

      {showError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
          <p>{sessionError?.messageKey ? t(sessionError.messageKey) : sessionError?.message || t('checkout.kustomSessionFailed')}</p>
          <Link
            href={lp('/checkout')}
            className="inline-flex items-center gap-1.5 mt-3 font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
          >
            {t('checkout.backToCheckout')}
          </Link>
        </div>
      )}

      {!showError && html && (
        // The Kustom container must stay unstyled and free to grow with the
        // iframe, so only the wrapper receives layout classes.
        <KustomSnippet html={html} className="w-full" />
      )}

      <p className="mt-6 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        {t('checkout.allTransactionsSecure')}
      </p>
    </div>
  );
}

export default function KustomCheckoutPage() {
  const t = useTranslations();
  // useSearchParams needs a Suspense boundary on client pages so the static
  // shell can render before the query string is known.
  return (
    <Suspense fallback={<LoadingState label={t('common.loading')} />}>
      <KustomCheckoutContent />
    </Suspense>
  );
}
