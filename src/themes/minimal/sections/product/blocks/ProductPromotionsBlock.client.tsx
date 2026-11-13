'use client';

// `product-promotions` block: the product's active promotions (flash sale,
// buy X get Y, free shipping, percentage / fixed amount) as cards, with the
// same markup as ProductDetailClient.

import { useTranslations } from 'next-intl';
import { Gift, Percent, Tag, Truck, Zap } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, formatPromoDate, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export function ProductPromotionsBlock({ settings, locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const promotions = state?.product.promotions ?? [];
  if (!state || promotions.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Promotions', 'العروض')}
        hint={state ? blockLabel(locale, 'No active promotions on this product.', 'لا توجد عروض فعّالة على هذا المنتج.') : undefined}
      />
    );
  }
  const { currency } = state;
  const lang = state.locale;
  const showEndDate = settings.show_end_date !== false;

  return (
    <ProductBlockScope>
      <div className="space-y-2">
        {promotions.map((promo) => {
          const promoTitle = promo.translations?.find((pt) => pt.locale === lang)?.title
            || promo.translations?.[0]?.title || '';
          const promoDesc = promo.translations?.find((pt) => pt.locale === lang)?.description
            || promo.translations?.[0]?.description || '';

          const Icon = promo.type === 'FLASH_SALE' ? Zap
            : promo.type === 'BUY_X_GET_Y' ? Gift
            : promo.type === 'FREE_SHIPPING' ? Truck
            : promo.type === 'PERCENTAGE' || promo.type === 'FIXED_AMOUNT' ? Percent
            : Tag;

          const bgColor = promo.type === 'FLASH_SALE' ? 'bg-red-50 border-red-200'
            : promo.type === 'FREE_SHIPPING' ? 'bg-cyan-50 border-cyan-200'
            : promo.type === 'BUY_X_GET_Y' ? 'bg-purple-50 border-purple-200'
            : 'bg-amber-50 border-amber-200';

          const textColor = promo.type === 'FLASH_SALE' ? 'text-red-700'
            : promo.type === 'FREE_SHIPPING' ? 'text-cyan-700'
            : promo.type === 'BUY_X_GET_Y' ? 'text-purple-700'
            : 'text-amber-700';

          const label = promo.type === 'PERCENTAGE' ? t('product.percentOff', { percent: promo.value })
            : promo.type === 'FIXED_AMOUNT' ? t('product.amountOff', { amount: formatPrice(promo.value, currency, lang) })
            : promo.type === 'FREE_SHIPPING' ? t('checkout.freeShippingLabel')
            : promo.type === 'FLASH_SALE' ? t('product.percentOff', { percent: promo.value })
            : '';

          return (
            <div key={promo.id} className={`flex items-start gap-3 rounded-xl border p-3 ${bgColor}`} data-promotion-type={promo.type}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${textColor}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${textColor}`}>{promoTitle || label}</p>
                {promoDesc && (
                  // Rendered as HTML, exactly as ProductDetailClient does.
                  <div
                    className={`text-xs mt-0.5 ${textColor} opacity-80 prose prose-sm max-w-none [&_p]:my-0`}
                    dangerouslySetInnerHTML={{ __html: promoDesc }}
                  />
                )}
                {showEndDate && promo.expires_at && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {t('product.endsOn')} {formatPromoDate(promo.expires_at, lang)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ProductBlockScope>
  );
}
