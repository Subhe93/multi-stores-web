'use client';

// Component implementation. Definition lives in AddToCartMagic.tsx.
//
// Product layout wave 2 (B1): the section is a composite of the variant
// picker, the personalization fields and the quantity + add-to-cart CTA on
// the page's shared product state. It used to keep its own selection
// (pre-picking the first variant), quantity and personalization app, so it
// disagreed with the gallery and price of other sections and missed bundles,
// the customer upload and the piece-one rule. Now one state drives them all,
// and adding validates and prices exactly like the monolith product page.
// The saved settings (`button_style`, `full_width`, `show_quantity`,
// `show_stock`, `sticky_on_mobile`, content `button_label`) keep their names
// and look.

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { CustomerUpload } from '@/components/product/CustomerUpload';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { DesignerFormSlot, useDesignerAddonsTotal, useDesignerSession } from '@/components/designer/DesignerSession';
import { formatPrice } from '@/lib/format';
import { useHydrated } from '@/hooks/useHydrated';
import type { SectionRenderProps } from '../../../types';
import {
  B1Placeholder,
  B1_SCOPE_STYLE,
  BundleChip,
  StateVariantSelector,
  b1LangPrefix,
  hasMainVariantOptions,
  isBlockPreview,
  useBlockState,
} from './blocks/b1Shared';

export function AddToCartMagic(props: SectionRenderProps) {
  const { settings, content, locale, primaryLocale } = props;
  const t = useTranslations();
  const state = useBlockState(props);
  // Designer app (M4.2 / M5.5): the inline form replaces the fields and the
  // add button; the canvas renders in the gallery section (shared session).
  const designer = useDesignerSession();
  const designerAddons = useDesignerAddonsTotal();
  // Until this boundary hydrates (its lazy chunk may still be loading) the
  // server-rendered CTA has no click handler, and React does not replay a
  // tap on a boundary whose chunk has not arrived (M106). The button is then
  // natively disabled in its normal colours with a spinner and aria-busy,
  // like the product-buy block, instead of silently losing the tap.
  const busy = !useHydrated();

  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Add to cart', ar: 'إضافة للسلة' }} />;
  }

  const buttonStyle = (settings.button_style as 'solid' | 'outline') || 'solid';
  const fullWidth = settings.full_width !== false;
  const showStock = settings.show_stock === true;
  const showSticky = settings.sticky_on_mobile === true;
  const showQuantity = settings.show_quantity !== false;

  const {
    product, variants, selectedVariant, selectedVariantId, advanced, appSettings, app, personalization,
    currency, taxRateBp, display, currentPrice, displayPrice, displayComparePrice, quantity, isDraftPreview,
    isOutOfStock, isAddDisabled, addingToCart, addedToCart, customFieldError, addToCartError,
  } = state;
  const money = (amount: number) => formatPrice(display(amount, taxRateBp, currency).amount, currency, state.locale);
  const stock = selectedVariant?.stock;
  const buttonLabel = (content.button_label as string) || t('common.addToCart');
  // Secondary locales get a path prefix; the primary stays canonical.
  const langPrefix = b1LangPrefix(locale, primaryLocale);

  const primaryButton: CSSProperties =
    buttonStyle === 'outline'
      ? {
          backgroundColor: 'transparent',
          color: 'var(--theme-colors-primary)',
          border: '2px solid var(--theme-colors-primary)',
          borderRadius: 'var(--theme-radius-md)',
          fontWeight: 'var(--theme-weight-bold)',
        }
      : {
          backgroundColor: 'var(--theme-colors-primary)',
          color: 'var(--theme-colors-primaryContrast, #fff)',
          borderRadius: 'var(--theme-radius-md)',
          fontWeight: 'var(--theme-weight-bold)',
          boxShadow: 'var(--theme-shadow-md)',
        };

  // "Added" confirmation with a way to the cart (M5 D5).
  const addedState = (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      <span
        role="status"
        className={`inline-flex items-center justify-center gap-2 px-6 py-3 ${fullWidth ? 'w-full' : ''}`}
        style={{
          backgroundColor: 'var(--theme-colors-primary)',
          color: 'var(--theme-colors-primaryContrast, #fff)',
          borderRadius: 'var(--theme-radius-md)',
          fontWeight: 'var(--theme-weight-bold)',
        }}
      >
        <Check className="w-4 h-4" />
        {t('cart.itemAdded')}
      </span>
      <Link
        href={`${langPrefix}/cart`}
        className="min-h-11 inline-flex items-center justify-center text-sm underline underline-offset-4"
        style={{ color: 'var(--theme-colors-primary)' }}
      >
        {t('cart.viewCart')}
      </Link>
    </div>
  );

  // Quantity: the stock of the chosen variant caps it; a bundle offer sets
  // its minimum and step (multiples of the bundle size).
  const min = state.quantityMin;
  const step = state.quantityStep;
  const max = state.maxStock;
  const canDecrement = quantity - step >= min;
  const canIncrement = max === undefined || quantity + step <= max;
  const quantityPicker = showQuantity ? (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium" style={{ color: 'var(--theme-colors-text)' }}>
        {t('product.quantity')}
      </span>
      {/* 44px touch targets (M5 D18) */}
      <div
        className="inline-flex items-center"
        style={{
          border: '1px solid var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-sm)',
        }}
      >
        <button
          type="button"
          onClick={() => canDecrement && state.handleQuantityChange(quantity - step)}
          disabled={!canDecrement}
          aria-label={t('common.decreaseQuantity')}
          className="size-11 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--theme-colors-text)' }}
        >
          <Minus className="size-3.5" />
        </button>
        <span
          className="px-3 py-1.5 text-sm tabular-nums"
          style={{ minWidth: 40, textAlign: 'center', color: 'var(--theme-colors-text)' }}
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => canIncrement && state.handleQuantityChange(quantity + step)}
          disabled={!canIncrement}
          aria-label={t('common.increaseQuantity')}
          className="size-11 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--theme-colors-text)' }}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  // Inline designer form (M5.5): photos → texts → CTA with the live total,
  // the section's quantity picker next to it (NPP has none).
  const designerForm = designer ? (
    <DesignerFormSlot
      totalLabel={money((currentPrice + designerAddons) * quantity)}
      formatMoney={money}
      quantitySelector={quantityPicker}
      blockedReason={isDraftPreview ? t('store.productPreviewBar') : state.designerBlockedReason}
      addedContent={addedToCart ? addedState : undefined}
      onAddToCart={state.handleDesignerAdd}
      onDone={state.handleDesignerDone}
      buttonClassName={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-6 py-3 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${fullWidth ? 'w-full' : ''}`}
      buttonStyle={primaryButton}
    />
  ) : null;

  // Busy only matters for a product that can be added; one that cannot keeps
  // its plain disabled look.
  const hydrating = busy && !isAddDisabled && !addingToCart;
  const cta = addedToCart ? addedState : (
    <button
      type="button"
      onClick={state.handleAddToCart}
      disabled={busy || addingToCart || isAddDisabled}
      aria-busy={busy || addingToCart || undefined}
      data-hydrating={busy ? '' : undefined}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 min-h-11 transition-all ${
        hydrating
          ? 'opacity-80 cursor-progress'
          : 'hover:opacity-90 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
      } ${fullWidth ? 'w-full' : ''}`}
      style={primaryButton}
    >
      {hydrating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {buttonLabel}
        </>
      ) : addingToCart ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('product.addingToCart')}
        </>
      ) : isOutOfStock ? (
        t('product.outOfStock')
      ) : (
        <>
          <ShoppingBag className="w-4 h-4" />
          {buttonLabel}
        </>
      )}
    </button>
  );

  return (
    <>
      <section className="space-y-5" style={B1_SCOPE_STYLE}>
        {advanced && !designer && (
          <PersonalizationForm
            model={advanced}
            placement="before_variants"
            showAllErrors={personalization.showAllErrors}
            locale={state.locale}
            primaryLocale={state.primaryLocale}
            anchor
          />
        )}
        {hasMainVariantOptions(state) && <StateVariantSelector state={state} />}

        <div className="flex items-baseline gap-3">
          <span
            data-product-price=""
            style={{
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-bold)',
              color: 'var(--theme-colors-price, var(--theme-colors-primary))',
              textShadow: 'var(--theme-price-shadow, none)', backgroundColor: 'var(--theme-price-bg, transparent)', padding: 'var(--theme-price-pad, 0)', borderRadius: '0.375rem',
            }}
          >
            {money(displayPrice)}
          </span>
          {displayComparePrice !== undefined && displayComparePrice > displayPrice && (
            <span
              className="line-through text-sm"
              style={{ color: 'var(--theme-colors-muted)' }}
            >
              {money(displayComparePrice)}
            </span>
          )}
          <PriceTaxSuffix className="text-xs" style={{ color: 'var(--theme-colors-muted)' }} taxRateBp={taxRateBp} />
          {/* Personalization app: the modifier is priced in the cart outside the default market. */}
          {app.deltaInCart && (
            <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
              {t('personalization.priceInCart')}
            </span>
          )}
          {showStock && typeof stock === 'number' && (
            <span className="text-xs ms-auto" style={{ color: stock > 0 ? 'var(--theme-colors-muted)' : '#dc2626' }}>
              {stock > 0 ? t('product.stockCount', { count: stock }) : t('product.outOfStock')}
            </span>
          )}
        </div>
        {/* Line price headline, like the monolith: show the unit price × quantity. */}
        {quantity > 1 && (
          <p className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
            {money(currentPrice)} × {quantity}
          </p>
        )}

        {advanced && !designer && (
          <PersonalizationForm
            model={advanced}
            placement="after_variants"
            showAllErrors={personalization.showAllErrors}
            locale={state.locale}
            primaryLocale={state.primaryLocale}
            showSummary={appSettings.validation_summary}
            pieceOne={state.pieceOptionKeys.length > 0 ? <StateVariantSelector state={state} pieceOne /> : undefined}
          />
        )}
        {!advanced && !designer && personalization.fields.length > 0 && (
          <CustomFieldsForm
            fields={personalization.fields}
            values={personalization.values}
            onChange={personalization.onChange}
            errors={personalization.errors}
            showAllErrors={personalization.showAllErrors}
            fillable={personalization.fillable}
            onFill={personalization.onFill}
          />
        )}
        {product.allow_customer_upload && !designer && (
          <CustomerUpload
            onFileSelect={state.handleFileSelect}
            onRemove={state.handleFileRemove}
            accept="image/*"
            maxSizeMB={10}
            label={t('product.fileUploads')}
            uploading={state.customerFileUploading}
            error={state.customerFileError}
            required
          />
        )}

        <BundleChip state={state} />
        {designerForm ?? (
          <>
            {quantityPicker}
            {cta}
          </>
        )}
        {customFieldError && (
          <p className="text-sm text-red-600">{customFieldError}</p>
        )}
        {addToCartError && addToCartError !== customFieldError && (
          <p role="alert" className="text-sm text-red-600">{addToCartError}</p>
        )}
        {!designer && variants.length > 0 && !selectedVariantId && (
          <p className="text-xs text-center" style={{ color: 'var(--theme-colors-muted)' }}>
            {t('product.selectOptions')}
          </p>
        )}
      </section>

      {/* The inline designer's CTA is at the end of its form (NPP); no sticky copy. */}
      {showSticky && !designer && (
        <div
          className="fixed inset-x-0 z-30 p-3 md:hidden"
          style={{
            // Above the cookie banner while it is open (consent-v2 CONTRACT §4.2).
            bottom: 'var(--ms-consent-inset, 0px)',
            backgroundColor: 'var(--theme-colors-background)',
            borderTop: '1px solid var(--theme-colors-border)',
            boxShadow: 'var(--theme-shadow-lg)',
            ...B1_SCOPE_STYLE,
          }}
        >
          {cta}
        </div>
      )}
    </>
  );
}
