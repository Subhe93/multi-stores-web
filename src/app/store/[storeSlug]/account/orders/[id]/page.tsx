'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api, resolveMediaUrl } from '@/lib/api';
import { ArrowLeft, Check } from 'lucide-react';

// ── Types matching backend Prisma response ──────────────────────────────────

interface Translation {
  locale: string;
  title: string;
  slug?: string;
  description?: string;
}

interface ProductImage {
  url: string;
  alt_text?: string;
  sort_order?: number;
}

interface OrderItemProduct {
  id: string;
  base_price?: number;
  translations: Translation[];
  images: ProductImage[];
}

interface OrderItemVariant {
  id: string;
  options: Record<string, string>;
  price_adjustment?: number;
}

interface CustomProduct {
  id: string;
  translations: Translation[];
  mockup_images?: { url: string; sort_order?: number }[];
  product?: {
    images: ProductImage[];
  };
}

interface CustomFieldValue {
  id: string;
  value?: string;
  file_url?: string;
  custom_field: {
    id: string;
    translations: { locale: string; label: string }[];
  };
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  original_unit_price?: number | null;
  total_price: number;
  product?: OrderItemProduct | null;
  variant?: OrderItemVariant | null;
  custom_product?: CustomProduct | null;
  custom_field_values?: CustomFieldValue[];
  customer_design_url?: string;
  design_notes?: string;
  bundle_offer_id?: string | null;
  bundle_offer?: {
    id: string;
    quantity: number;
    discount_type: string;
    discount_value: number | string;
    translations?: { locale: string; title: string; label?: string | null }[];
    bundle?: {
      id: string;
      translations?: { locale: string; name: string }[];
    };
  } | null;
}

interface Address {
  id: string;
  full_name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  phone?: string;
}

interface TimelineEntry {
  id: string;
  status: string;
  note?: string;
  created_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  currency?: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
  items: OrderItem[];
  address?: Address;
  timeline?: TimelineEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pickTranslation(translations: Translation[] | undefined, locale: string): string {
  if (!translations?.length) return '';
  const match = translations.find((t) => t.locale === locale);
  return match?.title || translations[0]?.title || '';
}

function pickFieldLabel(translations: { locale: string; label: string }[] | undefined, locale: string): string {
  if (!translations?.length) return '';
  const match = translations.find((t) => t.locale === locale);
  return match?.label || translations[0]?.label || '';
}

function buildVariantLabel(options?: Record<string, string>): string {
  if (!options || typeof options !== 'object') return '';
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ');
}

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function statusStyle(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PENDING': return 'bg-amber-50 text-amber-700';
    case 'CONFIRMED':
    case 'PROCESSING': return 'bg-blue-50 text-blue-700';
    case 'SHIPPED': return 'bg-purple-50 text-purple-700';
    case 'DELIVERED': return 'bg-green-50 text-green-700';
    case 'CANCELLED': return 'bg-red-50 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StoreOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_access_token');
    if (!token || !orderId) return;
    api<OrderDetail>(`/orders/${orderId}`, { token })
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="store-surface store-bd rounded-2xl border p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="store-surface store-bd rounded-2xl border p-8 text-center">
        <p className="text-sm text-gray-500 mb-3">Order not found</p>
        <Link href={lp('/account/orders')} className="text-sm font-medium hover:underline"
          style={{ color: 'var(--store-primary, #2563eb)' }}>
          Back to Orders
        </Link>
      </div>
    );
  }

  const num = order.order_number || order.id.slice(0, 8);
  const total = Number(order.total ?? 0);
  const subtotal = Number(order.subtotal ?? total);
  const shipping = Number(order.shipping_cost ?? 0);
  const discount = Number(order.discount_amount ?? 0);
  const currency = order.currency || 'EUR';
  const date = order.created_at;
  const items = order.items || [];
  const address = order.address;
  const status = order.status?.toUpperCase();
  const isCancelled = status === 'CANCELLED' || status === 'REFUNDED';
  const currentIdx = STATUS_STEPS.indexOf(status);

  const fmt = (v: number) => new Intl.NumberFormat('en', { style: 'currency', currency }).format(v);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="store-surface store-bd rounded-2xl border p-5">
        <Link href={lp('/account/orders')} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3">
          <ArrowLeft className="w-3 h-3" /> {t('account.orders')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Order #{num}</h1>
            {date && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
          <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full ${statusStyle(status)}`}>
            {t(`orderStatus.${order.status}` as any) || order.status}
          </span>
        </div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="store-surface store-bd rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => (
              <div key={step} className="flex-1 flex flex-col items-center relative">
                {idx > 0 && (
                  <div className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${idx <= currentIdx ? 'bg-gray-900' : 'bg-gray-200'}`} />
                )}
                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx <= currentIdx ? 'text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                  style={idx <= currentIdx ? { backgroundColor: 'var(--store-primary, #111)' } : undefined}
                >
                  {idx < currentIdx ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : idx + 1}
                </div>
                <span className="mt-2 text-[10px] text-gray-500 capitalize">{step.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="store-surface store-bd rounded-2xl border p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('checkout.orderSummary')}</h2>
        <div className="divide-y divide-gray-100">
          {items.map((item) => {
            const title =
              pickTranslation(item.custom_product?.translations, locale) ||
              pickTranslation(item.product?.translations, locale) ||
              'Product';
            // Image priority: custom product mockup → base product image (via custom_product.product) → direct product image
            const imgUrl =
              item.custom_product?.mockup_images?.[0]?.url ||
              item.custom_product?.product?.images?.[0]?.url ||
              item.product?.images?.[0]?.url;
            const variantLabel = buildVariantLabel(item.variant?.options);
            const price = Number(item.unit_price ?? 0);
            const originalPrice =
              item.original_unit_price != null ? Number(item.original_unit_price) : null;
            const lineTotal = price * item.quantity;
            const originalLineTotal =
              originalPrice !== null ? originalPrice * item.quantity : null;
            const fieldValues = item.custom_field_values || [];
            const bundleTr = item.bundle_offer?.translations?.find((tr) => tr.locale === locale)
              || item.bundle_offer?.translations?.[0];

            return (
              <div key={item.id} className="py-3 space-y-1">
                <div className="flex items-center gap-3">
                  {imgUrl ? (
                    <img src={resolveMediaUrl(imgUrl)} alt={title} className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-[10px]">No img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                    {variantLabel && (
                      <p className="text-xs text-gray-500">{variantLabel}</p>
                    )}
                    {item.bundle_offer && (
                      <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        {bundleTr?.title || 'Bundle'}
                        {bundleTr?.label ? ` · ${bundleTr.label}` : ''}
                      </span>
                    )}
                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {fmt(lineTotal)}
                    </p>
                    {originalLineTotal !== null && originalLineTotal > lineTotal && (
                      <p className="text-[10px] text-gray-400 line-through tabular-nums">
                        {fmt(originalLineTotal)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom field values */}
                {fieldValues.length > 0 && (
                  <div className="ml-15 pl-3 border-l-2 border-gray-100 space-y-0.5">
                    {fieldValues.map((fv) => {
                      const label = pickFieldLabel(fv.custom_field?.translations, locale);
                      return (
                        <p key={fv.id} className="text-[11px] text-gray-500">
                          <span className="font-medium text-gray-600">{label}:</span>{' '}
                          {fv.value || (fv.file_url ? 'File uploaded' : '—')}
                        </p>
                      );
                    })}
                  </div>
                )}

                {/* Design notes */}
                {item.design_notes && (
                  <p className="ml-15 text-[11px] text-gray-400 italic">Note: {item.design_notes}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('cart.subtotal')}</span>
            <span className="text-gray-900">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('cart.shipping')}</span>
            <span className="text-gray-900">{fmt(shipping)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-green-600">{t('cart.discount')}</span>
              <span className="text-green-600">-{fmt(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base border-t border-gray-100 pt-2">
            <span>{t('cart.total')}</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      {address && (
        <div className="store-surface store-bd rounded-2xl border p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('checkout.shippingAddress')}</h2>
          <div className="text-sm text-gray-600 space-y-0.5">
            {address.full_name && <p className="font-medium text-gray-800">{address.full_name}</p>}
            {address.line1 && <p>{address.line1}</p>}
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {[address.city, address.state].filter(Boolean).join(', ')}{' '}
              {address.postal_code}
            </p>
            {address.country_code && <p>{address.country_code}</p>}
            {address.phone && <p className="text-gray-400">{address.phone}</p>}
          </div>
        </div>
      )}

      {/* Order notes */}
      {order.notes && (
        <div className="store-surface store-bd rounded-2xl border p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('checkout.orderNotes')}</h2>
          <p className="text-sm text-gray-600">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
