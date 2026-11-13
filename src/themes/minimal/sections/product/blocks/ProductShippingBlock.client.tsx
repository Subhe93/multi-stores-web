'use client';

// `product-shipping` block: the product's shipping zones and their methods
// as a table, with the same markup as ProductDetailClient's "Shipping &
// delivery". One row per method; a zone without methods falls back to its
// legacy single cost / days so old data still renders.

import { useTranslations } from 'next-intl';
import { Globe, Package, Truck } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import type { ProductData } from '@/components/product/ProductDetailClient';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

type Zone = NonNullable<ProductData['shipping_profile']>['zones'][number];

export interface ShippingRow {
  key: string;
  title: string;
  pickup: boolean;
  cost: number;
  freeOver: number | null;
  daysMin: number;
  daysMax: number;
}

/** The rows of one zone: its methods, else the zone's legacy cost / days. */
export function shippingRowsForZone(zone: Zone, locale: string): ShippingRow[] {
  if (zone.methods?.length) {
    return zone.methods.map((m) => ({
      key: m.id,
      title: m.translations?.[locale] || m.name,
      pickup: m.type === 'PICKUP',
      cost: Number(m.base_cost),
      freeOver: m.free_threshold != null ? Number(m.free_threshold) : null,
      daysMin: m.estimated_days_min,
      daysMax: m.estimated_days_max,
    }));
  }
  return [
    {
      key: zone.id,
      title: zone.name,
      pickup: false,
      cost: Number(zone.base_cost),
      freeOver: zone.free_threshold ? Number(zone.free_threshold) : null,
      daysMin: zone.estimated_days_min,
      daysMax: zone.estimated_days_max,
    },
  ];
}

export function ProductShippingBlock({ settings, locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const zones = state?.product.shipping_profile?.zones ?? [];
  if (!state || zones.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Shipping info', 'معلومات الشحن')}
        hint={state ? blockLabel(locale, 'This product has no shipping profile.', 'لا يوجد ملف شحن لهذا المنتج.') : undefined}
      />
    );
  }
  const { currency } = state;
  const lang = state.locale;
  const showHeading = settings.show_heading !== false;

  return (
    <ProductBlockScope>
      {showHeading && (
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4" style={{ color: 'var(--store-primary, #2563eb)' }} />
          {t('product.shippingAndDelivery')}
        </h2>
      )}
      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {zones.flatMap((zone) => {
          const rows = shippingRowsForZone(zone, lang);
          const countries =
            zone.countries.length > 0
              ? ` · ${zone.countries.slice(0, 3).join(', ')}${zone.countries.length > 3 ? ` +${zone.countries.length - 3}` : ''}`
              : '';
          return rows.map((row) => (
            <div key={row.key} className="px-4 py-3.5 flex items-center justify-between gap-4" data-shipping-row="">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  {row.pickup ? <Package className="w-4 h-4 text-gray-400" /> : <Globe className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {row.title}
                    {rows.length > 1 || row.title !== zone.name ? (
                      <span className="text-gray-400 font-normal"> · {zone.name}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.pickup ? t('product.pickup') : t('product.estimatedDays', { min: row.daysMin, max: row.daysMax })}
                    <span className="text-gray-400">{countries}</span>
                  </p>
                </div>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-semibold text-gray-800">
                  {row.cost > 0 ? formatPrice(row.cost, currency, lang) : t('product.freeShipping')}
                </p>
                {row.freeOver != null && row.cost > 0 && (
                  <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1 justify-end">
                    <Package className="w-3 h-3" />
                    {t('product.freeShippingOver', { amount: formatPrice(row.freeOver, currency, lang) })}
                  </p>
                )}
              </div>
            </div>
          ));
        })}
      </div>
    </ProductBlockScope>
  );
}
