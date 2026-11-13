'use client';

// product-price block: the line price (unit × quantity) with compare-at,
// savings, the unit × quantity line, the b2b / tax suffix (PriceDisplay ->
// useDisplayPrice + PriceTaxSuffix) and an optional SKU, with
// ProductDetailClient's markup. Every value comes from the shared state, so
// it follows the variant, bundle and personalization picked elsewhere.

import { useTranslations } from 'next-intl';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../../types';
import { B1Placeholder, B1Scope, isBlockPreview, useBlockState } from './b1Shared';

export function ProductPriceBlock(props: SectionRenderProps) {
  const { settings, locale } = props;
  const t = useTranslations();
  const state = useBlockState(props);
  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Product price', ar: 'سعر المنتج' }} />;
  }
  const showCompareAt = settings.show_compare_at !== false;
  const showSavings = settings.show_savings !== false;
  const showUnitLine = settings.show_unit_price !== false;
  const showSku = settings.show_sku !== false;
  const {
    app, currency, taxRateBp, display, quantity, currentPrice,
    displayPrice, displayComparePrice, savings, sku,
  } = state;
  const stateLocale = state.locale;

  return (
    <B1Scope className="flex flex-col gap-1">
      <PriceDisplay
        price={displayPrice}
        comparePrice={showCompareAt ? displayComparePrice : undefined}
        currency={currency}
        locale={stateLocale}
        taxRateBp={taxRateBp}
      />
      {/* Personalization app: the modifier is priced in the cart outside the default market. */}
      {app.deltaInCart && (
        <p className="text-xs text-gray-500">{t('personalization.priceInCart')}</p>
      )}
      {showUnitLine && quantity > 1 && (
        <p className="text-xs text-gray-500">
          {formatPrice(display(currentPrice, taxRateBp, currency).amount, currency, stateLocale)} × {quantity}
        </p>
      )}
      {showSavings && savings > 0 && (
        <p className="text-sm text-green-600 font-medium">
          {t('product.savingsAmount', { amount: formatPrice(display(savings, taxRateBp, currency).amount, currency, stateLocale) })}
        </p>
      )}
      {showSku && sku && (
        <p className="text-xs text-gray-400 mt-1">SKU: {sku}</p>
      )}
    </B1Scope>
  );
}
