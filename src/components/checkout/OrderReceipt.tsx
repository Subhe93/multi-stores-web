'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Package, ArrowRight } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { resolveMediaUrl } from '@/lib/api';
import { formatTaxRate, hasTax, includedTax } from '@/lib/tax';

// ── Minimal order shape needed to render the receipt ───────────────────────
// Mirrors the storefront's /orders/:id response (OrdersService.findById uses
// the itemsWithProduct include). Kept narrow so the type stays maintainable.

interface Translation { locale: string; title: string }

export interface OrderReceiptItem {
  id: string;
  quantity: number;
  unit_price: number | string;
  total_price?: number | string;
  /** Server-resolved display image for this line (see OrdersService). */
  image_url?: string | null;
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

export interface OrderReceiptOrder {
  id: string;
  order_number: string;
  subtotal: number | string;
  shipping_cost: number | string;
  /** Display name of the shipping method chosen at checkout (phase C). */
  shipping_method_name?: string | null;
  /** DELIVERY vs in-store PICKUP; drives the label of the shipping row. */
  shipping_method_type?: 'DELIVERY' | 'PICKUP' | null;
  discount_amount: number | string;
  total: number | string;
  currency?: string;
  /** VAT snapshot taken at order creation (older orders may lack it). */
  tax_rate_bp?: number | null;
  tax_amount?: number | string | null;
  items: OrderReceiptItem[];
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

interface OrderReceiptProps {
  /** Full order; while null only the action buttons render. */
  order: OrderReceiptOrder | null;
  /** Order id for the "view order" link — may be known before the order loads. */
  orderId: string | null;
  /** Hide the "view order" link (guest-safe confirmation without a login). Defaults to shown. */
  showOrderLink?: boolean;
}

// Shared receipt block for the checkout confirmation pages (Stripe/COD and
// Kustom): line items, totals and the post-purchase action buttons.
export function OrderReceipt({ order, orderId, showOrderLink = true }: OrderReceiptProps) {
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();

  const currency = order?.currency || 'EUR';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(v);

  return (
    <>
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
              // Server-resolved per line (mockup → chosen option value's
              // image → product photo); the chain is a legacy fallback.
              const imgUrl =
                item.image_url ||
                item.custom_product?.mockup_images?.[0]?.url ||
                item.custom_product?.product?.images?.[0]?.url ||
                item.product?.images?.[0]?.url;
              const vLabel = variantLabel(item.variant?.options);
              const unit = Number(item.unit_price ?? 0);
              const lineTotal = unit * item.quantity;
              return (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
              <span className="text-gray-500">
                {order.shipping_method_type === 'PICKUP' ? t('checkout.pickUpInStore') : t('cart.shipping')}
                {order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}
              </span>
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
            {/* Informational: prices are tax inclusive, the total is unchanged. */}
            {hasTax(order.tax_rate_bp) && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>{t('cart.includesVat', { rate: formatTaxRate(order.tax_rate_bp) })}</span>
                <span>
                  {fmt(order.tax_amount != null
                    ? Number(order.tax_amount)
                    : includedTax(Number(order.total), order.tax_rate_bp, currency))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {orderId && showOrderLink && (
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
    </>
  );
}
