'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth, readStoredAccessToken } from '@/hooks/useAuth';
import { readEditHintToken } from '@/components/edit-hint/editHintStorage';
import { checkoutViewerToken, storefrontViewerHeaders } from '@/lib/storePreview';
import { useCart } from '@/hooks/useCart';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { readStripeReturn, type StripeReturnState } from '@/lib/stripeElements';
import { CheckCircle2, Clock, UserRound, XCircle } from 'lucide-react';
import { guestAccountNoteKey } from '@/lib/checkoutAccount';
import { OrderReceipt, type OrderReceiptOrder } from '@/components/checkout/OrderReceipt';

const noopSubscribe = () => () => {};

function readGuestAccountEmail(orderId: string | null): string | null {
  if (!orderId) return null;
  try {
    return sessionStorage.getItem(guestAccountNoteKey(orderId));
  } catch {
    return null; // storage unavailable: no note
  }
}

export default function OrderConfirmationPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const storeSlug = (useParams<{ storeSlug: string }>()?.storeSlug as string) || '';
  const { token, loading: authLoading } = useAuth();
  const { clearCart } = useCart();
  const lp = useLocalePath();
  const [order, setOrder] = useState<OrderReceiptOrder | null>(null);
  // Stripe payments: the state from the return URL (redirect methods such as
  // Klarna append `redirect_status`), refined by the server reconcile below.
  // Null for COD / Kustom / an inline card payment that already succeeded.
  const urlPaymentState = readStripeReturn(searchParams);
  const [serverPaymentState, setServerPaymentState] = useState<StripeReturnState>(null);
  // The server could not check the payment with Stripe (the store's own key
  // is not active right now): neither paid nor failed can be claimed.
  const [serverUnverified, setServerUnverified] = useState(false);
  // A Stripe return without a session (Swish / BankID finished in another
  // browser or app): the URL's redirect_status cannot be verified here, so
  // a neutral "we're confirming" state is shown instead of trusting it.
  const unverifiedReturn = (urlPaymentState !== null && !authLoading && !token) || serverUnverified;
  const paymentState = unverifiedReturn ? null : (serverPaymentState ?? urlPaymentState);
  const cartClearedRef = useRef(false);
  // Email of the guest account created for this order (set by checkout).
  // Read on the client only; the server snapshot renders no note.
  const guestEmail = useSyncExternalStore(
    noopSubscribe,
    () => readGuestAccountEmail(orderId),
    () => null,
  );

  // Reconcile the payment from the front as a safety net: if the inline confirm
  // after card payment didn't complete, finalizing here keeps the order status
  // accurate without waiting for the webhook. Idempotent and a no-op for COD.
  // Then fetch the full order so the receipt can render line items inline —
  // before this users had to click "View order" to see what they bought.
  useEffect(() => {
    if (!orderId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        // Same viewer token as the checkout's payment calls (owner test mode).
        const viewerHeaders = storefrontViewerHeaders(checkoutViewerToken(storeSlug, {
          editHintToken: readEditHintToken(),
          sessionToken: readStoredAccessToken(),
        }));
        const reconciled = await api<{ payment_status?: string; code?: string }>('/payments/confirm', {
          method: 'POST',
          token,
          headers: viewerHeaders,
          body: JSON.stringify({ order_id: orderId }),
        }).catch(() => null /* webhook will reconcile as a fallback */);
        // After a Stripe redirect the live PaymentIntent decides: paid or
        // failed is final; anything else stays "processing".
        if (!cancelled && reconciled?.code === 'OWN_KEY_NOT_ACTIVE') setServerUnverified(true);
        if (!cancelled && urlPaymentState) {
          const ps = reconciled?.payment_status;
          if (ps === 'paid') setServerPaymentState('succeeded');
          else if (ps === 'failed') setServerPaymentState('failed');
        }
        const data = await api<OrderReceiptOrder>(`/orders/${orderId}`, { token });
        if (!cancelled) setOrder(data);
      } catch {
        /* swallow — the page still shows the success message + buttons */
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `urlPaymentState` is derived from the URL, read once per order
  }, [orderId, token]);

  // A redirect payment returns here with the cart still filled (checkout
  // only clears it for inline payments). Placed orders empty it once; a
  // failed payment keeps it for the retry.
  useEffect(() => {
    if (cartClearedRef.current || authLoading) return;
    if (paymentState !== 'succeeded' && paymentState !== 'processing') return;
    cartClearedRef.current = true;
    void clearCart();
  }, [paymentState, clearCart, authLoading]);

  if (unverifiedReturn) {
    return (
      <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
        <div role="status" className="w-full max-w-2xl text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #22c55e) 15%, white)' }}
          >
            <Clock className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.paymentConfirmingTitle')}</h1>
          <p className="text-gray-500 text-sm">{t('checkout.paymentConfirmingText')}</p>
        </div>
      </div>
    );
  }

  if (paymentState === 'failed') {
    return (
      <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-red-50">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.paymentFailedTitle')}</h1>
          <p className="text-gray-500 text-sm">{t('checkout.paymentFailedText')}</p>
          <Link
            href={lp('/checkout?method=classic')}
            className="mt-6 inline-block rounded-md px-6 py-2.5 text-sm font-medium hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
          >
            {t('checkout.retryPayment')}
          </Link>
        </div>
      </div>
    );
  }

  const processing = paymentState === 'processing';

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Success header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #22c55e) 15%, white)' }}
          >
            {processing
              ? <Clock className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />
              : <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {processing ? t('checkout.paymentProcessingTitle') : t('checkout.orderPlaced')}
          </h1>
          <p className="text-gray-500 text-sm">{processing ? t('checkout.paymentProcessingText') : t('checkout.thankYou')}</p>
          {processing && <p className="text-gray-500 text-sm mt-1">{t('checkout.bankPaymentDelay')}</p>}
          {order?.order_number && (
            <p className="text-xs text-gray-400 mt-3">
              {t('checkout.orderNumber')}:{' '}
              <span className="font-mono font-semibold text-gray-600">{order.order_number}</span>
            </p>
          )}
        </div>

        {/* Guest checkout: the server created the account and emailed the
            password with a one-click login link. */}
        {guestEmail && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-gray-700">
            <UserRound className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p>{t('checkout.accountCreatedNote', { email: guestEmail })}</p>
              <p className="mt-1">{t('checkout.accountEmailedNote')}</p>
            </div>
          </div>
        )}

        {/* Line items, totals and post-purchase actions */}
        <OrderReceipt order={order} orderId={orderId} />
      </div>
    </div>
  );
}
