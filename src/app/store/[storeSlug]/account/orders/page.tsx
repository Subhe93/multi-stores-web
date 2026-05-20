'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { Package, ChevronRight } from 'lucide-react';

interface Order {
  id: string;
  orderNumber?: string;
  order_number?: string;
  status: string;
  total?: number;
  total_amount?: number;
  currency?: string;
  createdAt?: string;
  created_at?: string;
}

function statusStyle(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PENDING': return 'bg-amber-50 text-amber-700';
    case 'CONFIRMED':
    case 'PROCESSING': return 'bg-blue-50 text-blue-700';
    case 'SHIPPED': return 'bg-purple-50 text-purple-700';
    case 'DELIVERED': return 'bg-green-50 text-green-700';
    case 'CANCELLED': return 'bg-red-50 text-red-700';
    case 'REFUNDED': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function StoreOrdersPage() {
  const t = useTranslations();
  const lp = useLocalePath();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_access_token');
    if (!token) return;
    api<any>('/orders/my', { token })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data || [];
        setOrders(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="store-surface store-bd rounded-2xl border p-8">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="store-surface store-bd rounded-2xl border overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">{t('account.orders')}</h1>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">{t('account.noOrders')}</p>
          <Link
            href={lp('/products')}
            className="inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
          >
            {t('cart.continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {orders.map((order) => {
            const num = order.orderNumber || order.order_number || order.id.slice(0, 8);
            const total = order.total ?? order.total_amount ?? 0;
            const date = order.createdAt || order.created_at;

            return (
              <Link
                key={order.id}
                href={lp(`/account/orders/${order.id}`)}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-sm font-semibold text-gray-900">#{num}</span>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusStyle(order.status)}`}>
                      {t(`orderStatus.${order.status}` as any) || order.status}
                    </span>
                  </div>
                  {date && (
                    <p className="text-xs text-gray-400">
                      {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {new Intl.NumberFormat('en', { style: 'currency', currency: order.currency || 'EUR' }).format(Number(total))}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
