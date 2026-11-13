'use client';

// product-buy block: quantity (max stock, bundle minimum and step), the
// add-to-cart button, the active bundle chip, the field / select-options
// hints, the floating added / error toasts and an optional sticky mobile
// CTA, with ProductDetailClient's markup. The add action is the shared
// state's `handleAddToCart`, so it validates and prices exactly like the
// monolith.
//
// Designer products: the inline designer form (with its own quantity and
// CTA) is the product-personalization block's slot; this block then shows
// only the bundle chip and the hints.

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, ShoppingCart } from 'lucide-react';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { useDesignerSession } from '@/components/designer/DesignerSession';
import type { ProductPageState } from '@/components/product/state/ProductPageState';
import type { SectionRenderProps } from '../../../../types';
import {
  B1Placeholder,
  B1Scope,
  B1_SCOPE_STYLE,
  BundleChip,
  ProductToasts,
  b1LangPrefix,
  isBlockPreview,
  useBlockState,
} from './b1Shared';

type ButtonStyle = 'solid' | 'outline';

/** The monolith's add-to-cart button (pill, store primary colour). */
export function StateAddToCartButton({
  state,
  buttonStyle,
  label,
  className = 'flex-1 min-w-48',
}: {
  state: ProductPageState;
  buttonStyle: ButtonStyle;
  label?: string;
  className?: string;
}) {
  const t = useTranslations();
  const { addedToCart, isAddDisabled, addingToCart, handleAddToCart } = state;
  const style: CSSProperties | undefined =
    addedToCart || isAddDisabled
      ? undefined
      : buttonStyle === 'outline'
        ? {
            backgroundColor: 'transparent',
            color: 'var(--store-primary, #2563eb)',
            border: '2px solid var(--store-primary, #2563eb)',
          }
        : { backgroundColor: 'var(--store-primary, #2563eb)' };
  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isAddDisabled || addingToCart}
      className={`${className} flex items-center justify-center gap-2.5 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
        addedToCart
          ? 'bg-green-600 text-white scale-[1.02]'
          : isAddDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : addingToCart
              ? 'opacity-80'
              : 'hover:opacity-90 hover:shadow-lg active:scale-[0.98]'
      }`}
      style={style}
      data-on-primary={addedToCart || isAddDisabled || buttonStyle === 'outline' ? undefined : ''}
    >
      {addingToCart ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('product.addingToCart')}
        </>
      ) : addedToCart ? (
        <>
          <Check className="w-4 h-4" />
          {t('cart.itemAdded')}
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          {label || t('common.addToCart')}
        </>
      )}
    </button>
  );
}

export function ProductBuyBlock(props: SectionRenderProps) {
  const { settings, content, locale, primaryLocale } = props;
  const t = useTranslations();
  const state = useBlockState(props);
  const designer = useDesignerSession();
  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Quantity + add to cart', ar: 'الكمية + إضافة للسلة' }} />;
  }
  const buttonStyle: ButtonStyle = settings.button_style === 'outline' ? 'outline' : 'solid';
  const showQuantity = settings.show_quantity !== false;
  const sticky = settings.sticky_on_mobile === true;
  const label = typeof content.button_label === 'string' ? content.button_label : undefined;
  const langPrefix = b1LangPrefix(locale, primaryLocale);
  const { variants, selectedVariantId, customFieldError } = state;

  return (
    <>
      <B1Scope className="space-y-4">
        <BundleChip state={state} />
        {!designer && (
          <div className="flex items-center gap-3 flex-wrap">
            {showQuantity && (
              <QuantitySelector
                value={state.quantity}
                onChange={state.handleQuantityChange}
                min={state.quantityMin}
                max={state.maxStock}
                step={state.quantityStep}
              />
            )}
            <StateAddToCartButton state={state} buttonStyle={buttonStyle} label={label} />
          </div>
        )}

        {customFieldError && (
          <p className="text-sm text-red-600 font-medium">{customFieldError}</p>
        )}

        {/* Hint when variant not selected */}
        {variants.length > 0 && !selectedVariantId && (
          <p className="text-xs text-amber-600 text-center">
            {t('product.selectOptions')}
          </p>
        )}
      </B1Scope>

      {/* Sticky mobile CTA (the inline designer's CTA ends its own form). */}
      {sticky && !designer && (
        <div
          className="fixed bottom-0 inset-x-0 z-30 p-3 md:hidden flex"
          data-sticky-cta=""
          style={{
            backgroundColor: 'var(--theme-colors-background, #fff)',
            borderTop: '1px solid var(--theme-colors-border, #e5e7eb)',
            boxShadow: 'var(--theme-shadow-lg)',
            ...B1_SCOPE_STYLE,
          }}
        >
          <StateAddToCartButton state={state} buttonStyle={buttonStyle} label={label} className="flex-1" />
        </div>
      )}

      <div style={B1_SCOPE_STYLE}>
        <ProductToasts state={state} langPrefix={langPrefix} />
      </div>
    </>
  );
}
