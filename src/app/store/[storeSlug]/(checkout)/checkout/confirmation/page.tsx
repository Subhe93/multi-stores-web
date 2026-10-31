'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { CheckCircle2, UserRound } from 'lucide-react';
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
  const { token } = useAuth();
  const [order, setOrder] = useState<OrderReceiptOrder | null>(null);
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
        await api('/payments/confirm', {
          method: 'POST',
          token,
          body: JSON.stringify({ order_id: orderId }),
        }).catch(() => { /* webhook will reconcile as a fallback */ });
        const data = await api<OrderReceiptOrder>(`/orders/${orderId}`, { token });
        if (!cancelled) setOrder(data);
      } catch {
        /* swallow — the page still shows the success message + buttons */
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, token]);

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Success header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #22c55e) 15%, white)' }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.orderPlaced')}</h1>
          <p className="text-gray-500 text-sm">{t('checkout.thankYou')}</p>
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
