'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { api } from '@/lib/api';
import { KustomSnippet } from '@/components/checkout/KustomSnippet';
import { OrderReceipt, type OrderReceiptOrder } from '@/components/checkout/OrderReceipt';

// Response of GET /payments/kustom/confirmation (see plans/kustom-integration/API-CONTRACT.md).
interface KustomConfirmationResponse {
  order_id: string;
  order_number: string;
  kustom_order_id: string;
  status: string;
  /** Kustom's checkout status; `mismatch` when the payment could not be matched to this order. */
  checkout_status?: string;
  payment_status: string;
  html_snippet: string | null;
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label}
    </div>
  );
}

// Kustom redirects the customer here after the checkout completes. The API
// reads the Kustom order, marks ours paid (idempotent) and returns Kustom's
// confirmation snippet; the push callback finalizes the order independently,
// so a not-yet-paid response is shown as "confirming", never as a failure.
function KustomConfirmationContent() {
  const t = useTranslations();
  const lp = useLocalePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { token, loading: authLoading } = useAuth();
  const { clearCart } = useCart();

  const [confirmation, setConfirmation] = useState<KustomConfirmationResponse | null>(null);
  const [order, setOrder] = useState<OrderReceiptOrder | null>(null);
  const [loading, setLoading] = useState(true);
  // The cart is cleared exactly once per visit, even if the effect re-runs.
  const cartClearedRef = useRef(false);

  // Same guard as the account area: the confirmation endpoint is
  // customer-scoped, so send unauthenticated visitors to log in.
  useEffect(() => {
    if (!authLoading && !token) router.replace(lp('/auth/login'));
  }, [authLoading, token, router, lp]);

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<KustomConfirmationResponse>(
          `/payments/kustom/confirmation?order_id=${encodeURIComponent(orderId)}`,
          { token },
        );
        if (cancelled) return;
        setConfirmation(res);
        // The order is placed on our side as soon as Kustom sends the customer
        // here; the checkout page intentionally left the cart intact until now.
        if (!cartClearedRef.current) {
          cartClearedRef.current = true;
          clearCart().catch(() => { /* local state is cleared regardless */ });
        }
        // Fetch the full order so the receipt can render line items inline.
        try {
          const data = await api<OrderReceiptOrder>(`/orders/${orderId}`, { token });
          if (!cancelled) setOrder(data);
        } catch {
          /* swallow — the page still shows the confirmation + buttons */
        }
      } catch {
        // Leave `confirmation` empty: the page then shows the neutral
        // "confirming your payment" state — the push callback settles it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, orderId, clearCart]);

  if (!orderId) {
    return (
      <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
          <p>{t('checkout.kustomSessionFailed')}</p>
          <Link
            href={lp('/checkout')}
            className="inline-flex items-center gap-1.5 mt-3 font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
          >
            {t('checkout.backToCheckout')}
          </Link>
        </div>
      </div>
    );
  }

  if (authLoading || !token || loading) {
    return <LoadingState label={t('common.loading')} />;
  }

  const paid = confirmation?.payment_status === 'paid';
  // Authorized at Kustom but not for this order (amount/currency/reference
  // differ): the push will never mark it paid, so ask for support instead of
  // showing the neutral "confirming" state forever.
  const mismatch = !paid && confirmation?.checkout_status === 'mismatch';
  const orderNumber = order?.order_number || confirmation?.order_number;

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Kustom's own confirmation (order overview + payment details) */}
        {confirmation?.html_snippet && (
          <KustomSnippet html={confirmation.html_snippet} className="w-full mb-8" />
        )}

        {/* Status header */}
        <div className="text-center mb-8">
          {paid ? (
            <>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #22c55e) 15%, white)' }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.orderPlaced')}</h1>
              <p className="text-gray-500 text-sm">{t('checkout.thankYou')}</p>
            </>
          ) : mismatch ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.payment')}</h1>
              <p className="text-gray-600 text-sm">{t('checkout.paymentMismatch')}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.payment')}</h1>
              <p className="text-gray-500 text-sm">{t('checkout.confirmingPayment')}</p>
            </>
          )}
          {orderNumber && (
            <p className="text-xs text-gray-400 mt-3">
              {t('checkout.orderNumber')}:{' '}
              <span className="font-mono font-semibold text-gray-600">{orderNumber}</span>
            </p>
          )}
        </div>

        {/* Line items, totals and post-purchase actions. When the confirmation
            call itself failed there is no order to render yet, but the order
            link is still offered. */}
        <OrderReceipt order={order} orderId={orderId} />
      </div>
    </div>
  );
}

export default function KustomConfirmationPage() {
  const t = useTranslations();
  // useSearchParams needs a Suspense boundary on client pages so the static
  // shell can render before the query string is known.
  return (
    <Suspense fallback={<LoadingState label={t('common.loading')} />}>
      <KustomConfirmationContent />
    </Suspense>
  );
}
