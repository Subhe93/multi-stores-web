'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';

export default function OrderConfirmationPage() {
  const t = useTranslations();
  const lp = useLocalePath();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { token } = useAuth();

  // Reconcile the payment from the front as a safety net: if the inline confirm
  // after card payment didn't complete, finalizing here keeps the order status
  // accurate without waiting for the webhook. Idempotent and a no-op for COD.
  useEffect(() => {
    if (!orderId || !token) return;
    api('/payments/confirm', {
      method: 'POST',
      token,
      body: JSON.stringify({ order_id: orderId }),
    }).catch(() => { /* webhook will reconcile as a fallback */ });
  }, [orderId, token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #22c55e) 15%, white)' }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--store-primary, #22c55e)' }} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.orderPlaced')}</h1>
        <p className="text-gray-500 text-sm mb-8">{t('checkout.thankYou')}</p>

        {orderId && (
          <p className="text-xs text-gray-400 mb-6">
            {t('checkout.orderNumber')}: <span className="font-mono font-semibold text-gray-600">{orderId.slice(0, 8)}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderId && (
            <Link
              href={lp(`/account/orders/${orderId}`)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              <Package className="w-4 h-4" />
              {t('checkout.viewOrder')}
            </Link>
          )}
          <Link
            href={lp('/products')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('checkout.backToShopping')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
