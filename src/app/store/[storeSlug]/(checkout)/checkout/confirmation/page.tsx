'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { api, resolveMediaUrl } from '@/lib/api';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';

// ── Minimal order shape needed to render the receipt ───────────────────────
// Mirrors the storefront's /orders/:id response (OrdersService.findById uses
// the itemsWithProduct include). Kept narrow so the type stays maintainable.

interface Translation { locale: string; title: string }

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number | string;
  total_price?: number | string;
  product?: {
    translations?: Translation[];
    images?: { url: string }[];
  } | null;
  variant?: { options?: Record<string, string> } | null;
  custom_product?: {
    translations?: Translation[];
    mockup_images?: { url: string }[];
    product?: { images?: { url: string }[] } | null;
  } | null;
}

interface OrderDetail {
  id: string;
  order_number: string;
  subtotal: number | string;
  shipping_cost: number | string;
  discount_amount: number | string;
  total: number | string;
  currency?: string;
  items: OrderItem[];
}

function pickTitle(translations: Translation[] | undefined, locale: string): string {
  if (!translations?.length) return '';
  return (
    translations.find((t) => t.locale === locale)?.title ||
    translations.find((t) => t.locale === 'en')?.title ||
    translations[0]?.title ||
    ''
  );
}

function variantLabel(options?: Record<string, string>): string {
  if (!options || typeof options !== 'object') return '';
  return Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(' / ');
}

export default function OrderConfirmationPage() {
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { token } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);

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
        const data = await api<OrderDetail>(`/orders/${orderId}`, { token });
        if (!cancelled) setOrder(data);
      } catch {
        /* swallow — the page still shows the success message + buttons */
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, token]);

  const currency = order?.currency || 'EUR';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(v);

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

        {/* Order items — only shown once we have the full order. While loading
            we keep just the success message so the page stays snappy. */}
        {order && order.items?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              {t('checkout.orderSummary')}
            </h2>
            <div className="divide-y divide-gray-100">
              {order.items.map((item) => {
                const title =
                  pickTitle(item.custom_product?.translations, locale) ||
                  pickTitle(item.product?.translations, locale) ||
                  'Product';
                const imgUrl =
                  item.custom_product?.mockup_images?.[0]?.url ||
                  item.custom_product?.product?.images?.[0]?.url ||
                  item.product?.images?.[0]?.url;
                const vLabel = variantLabel(item.variant?.options);
                const unit = Number(item.unit_price ?? 0);
                const lineTotal = unit * item.quantity;
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    {imgUrl ? (
                      <img
                        src={resolveMediaUrl(imgUrl)}
                        alt={title}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">
                        No img
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                      {vLabel && <p className="text-xs text-gray-500">{vLabel}</p>}
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {fmt(lineTotal)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cart.subtotal')}</span>
                <span className="text-gray-900">{fmt(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cart.shipping')}</span>
                <span className="text-gray-900">{fmt(Number(order.shipping_cost))}</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-green-600">{t('cart.discount')}</span>
                  <span className="text-green-600">-{fmt(Number(order.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t border-gray-100 pt-2">
                <span>{t('cart.total')}</span>
                <span>{fmt(Number(order.total))}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
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
