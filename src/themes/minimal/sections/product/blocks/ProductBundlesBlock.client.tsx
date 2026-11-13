'use client';

// `product-bundles` block: the quantity-tier bundle offers. Picking an offer
// goes through the shared state (`handleSelectBundle`), which forces the
// quantity to the bundle size and reprices every other block (price, buy).
// Same markup as ProductDetailClient.

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { computeBundlePricing } from '@/lib/bundle';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export function ProductBundlesBlock({ locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const bundles = state?.product.bundles ?? [];
  if (!state || bundles.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Bundle offers', 'عروض الباقات')}
        hint={state ? blockLabel(locale, 'This product has no bundle offers.', 'لا توجد عروض باقات لهذا المنتج.') : undefined}
      />
    );
  }
  const { baseUnitPrice, selectedBundleOfferId, handleSelectBundle, currency } = state;
  const lang = state.locale;

  return (
    <ProductBlockScope>
      <div className="space-y-3">
        {bundles.map((bundle) => {
          const sortedOffers = [...bundle.offers].sort((a, b) => a.sort_order - b.sort_order);
          if (sortedOffers.length === 0) return null;
          return (
            <div key={bundle.id} className="space-y-2">
              {sortedOffers.map((offer) => {
                const tr = offer.translations.find((x) => x.locale === lang) || offer.translations[0];
                const title = tr?.title || t('product.buyQuantity', { count: offer.quantity });
                const label = tr?.label || '';
                const sticker = tr?.sticker_text || '';
                const pricing = computeBundlePricing(baseUnitPrice, {
                  quantity: offer.quantity,
                  discount_type: offer.discount_type,
                  discount_value: offer.discount_value,
                });
                const isSelected = selectedBundleOfferId === offer.id;
                return (
                  <button
                    key={offer.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectBundle(offer.id)}
                    className={`relative flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                  >
                    {sticker && (
                      <span className="absolute -top-2 inset-e-3 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {sticker}
                      </span>
                    )}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium text-gray-900">{title}</span>
                        {label && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                            {label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-semibold tabular-nums text-gray-900">
                        {formatPrice(pricing.finalTotal, currency, lang)}
                      </span>
                      {pricing.originalTotal > pricing.finalTotal && (
                        <span className="text-xs text-gray-400 line-through tabular-nums">
                          {formatPrice(pricing.originalTotal, currency, lang)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </ProductBlockScope>
  );
}
