'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface OrderDetail {
  id: string;
  orderNumber: string;
  order_number?: string;
  status: string;
  subtotal?: number;
  discount_amount?: number;
  shipping_cost?: number;
  total: number;
  currency?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export default function OrderConfirmationPage() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('auth_access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api<OrderDetail>(`/orders/${orderId}`, { token })
      .then((data) => setOrder(data))
      .catch(() => {
        // Order details not available, show generic confirmation
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto text-center">
            {/* Success icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-semibold text-slate-800 mb-2">
              {t('orderPlaced')}
            </h1>
            <p className="text-slate-500 mb-8">
              {t('thankYou')}
            </p>

            {loading ? (
              <div className="text-sm text-slate-400">Loading order details...</div>
            ) : order ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left mb-8">
                <h2 className="text-sm font-medium text-slate-500 mb-1">{t('orderNumber')}</h2>
                <p className="text-lg font-semibold text-slate-800 mb-4">
                  {order.order_number || order.orderNumber || order.id}
                </p>

                <h2 className="text-sm font-medium text-slate-500 mb-1">Status</h2>
                <p className="text-sm text-slate-800 capitalize mb-4">{order.status}</p>

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  {order.subtotal != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('subtotal')}</span>
                      <span className="text-slate-800">
                        {new Intl.NumberFormat('en', { style: 'currency', currency: order.currency || 'EUR' }).format(Number(order.subtotal))}
                      </span>
                    </div>
                  )}
                  {Number(order.discount_amount) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t('discount')}</span>
                      <span>-{new Intl.NumberFormat('en', { style: 'currency', currency: order.currency || 'EUR' }).format(Number(order.discount_amount))}</span>
                    </div>
                  )}
                  {Number(order.shipping_cost) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('shipping')}</span>
                      <span className="text-slate-800">
                        {new Intl.NumberFormat('en', { style: 'currency', currency: order.currency || 'EUR' }).format(Number(order.shipping_cost))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base border-t border-slate-200 pt-2">
                    <span className="text-slate-800">{t('total')}</span>
                    <span className="text-slate-800">
                      {new Intl.NumberFormat('en', { style: 'currency', currency: order.currency || 'EUR' }).format(Number(order.total))}
                    </span>
                  </div>
                </div>
              </div>
            ) : orderId ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                <p className="text-sm text-slate-500">Order ID: <span className="font-mono text-slate-700">{orderId}</span></p>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="inline-block rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition"
              >
                {t('backToShopping')}
              </Link>
              <Link
                href="/account/orders"
                className="inline-block rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                {t('viewOrder')}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
