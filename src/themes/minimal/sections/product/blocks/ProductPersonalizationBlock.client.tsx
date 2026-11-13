'use client';

// `product-personalization` block: everything the shopper fills in for one
// line, with the same markup and order as ProductDetailClient:
// - personalization app: the "before variants" form, then the heading and
//   the "after variants" form (on a multi-piece product the piece-1 colour
//   picker renders inside the piece-1 box; the `product-variants` block hides
//   those options through the same `pieceOptionKeys`);
// - otherwise the legacy custom fields with their heading;
// - the customer upload;
// - designer app: the inline designer form (photos → texts → CTA with the
//   live total and the quantity picker) replaces all of the above.
// All values live in the shared product state, so the buy block validates
// and adds exactly what is shown here.

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { VariantSelector } from '@/components/product/VariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { CustomerUpload } from '@/components/product/CustomerUpload';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { visibleFieldsAt } from '@/components/product/personalization/model';
import { DesignerFormSlot, useDesignerAddonsTotal, useDesignerSession } from '@/components/designer/DesignerSession';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} />
      {children}
    </h2>
  );
}

export function ProductPersonalizationBlock({ settings, locale, product: productContext, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const designer = useDesignerSession();
  const designerAddons = useDesignerAddonsTotal();

  const placeholder = (hint?: string) => (
    <ProductBlockPlaceholder
      builderPreview={builderPreview ?? !productContext}
      label={blockLabel(locale, 'Personalization', 'التخصيص')}
      hint={hint}
    />
  );
  if (!state) return placeholder();

  const {
    product,
    variants,
    selectedVariantId,
    setSelectedVariantId,
    optionSelections,
    setOptionSelections,
    cardsConfig,
    pieceOptionKeys,
    advanced,
    appSettings,
    personalization,
    customerFileUploading,
    customerFileError,
    handleFileSelect,
    handleFileRemove,
    currentPrice,
    quantity,
    handleQuantityChange,
    quantityMin,
    quantityStep,
    maxStock,
    display,
    taxRateBp,
    currency,
    addedToCart,
    designerBlockedReason,
    handleDesignerAdd,
    handleDesignerDone,
  } = state;
  const lang = state.locale;
  const showHeading = settings.show_heading !== false;
  const buttonStyle = settings.button_style === 'outline' ? 'outline' : 'solid';

  // Designer app (M5.5): the inline designer form replaces the
  // personalization form, the custom fields and the customer upload.
  if (designer) {
    return (
      <ProductBlockScope>
        <DesignerFormSlot
          totalLabel={formatPrice(display((currentPrice + designerAddons) * quantity, taxRateBp, currency).amount, currency, lang)}
          formatMoney={(amount) => formatPrice(display(amount, taxRateBp, currency).amount, currency, lang)}
          quantitySelector={
            <QuantitySelector value={quantity} onChange={handleQuantityChange} min={quantityMin} max={maxStock} step={quantityStep} />
          }
          blockedReason={designerBlockedReason}
          addedContent={
            addedToCart ? (
              <span className="flex min-h-11 items-center justify-center gap-2.5 rounded-full bg-green-600 py-3.5 text-sm font-semibold text-white" role="status">
                <Check className="h-4 w-4" />
                {t('cart.itemAdded')}
              </span>
            ) : undefined
          }
          onAddToCart={handleDesignerAdd}
          onDone={handleDesignerDone}
          buttonStyle={
            buttonStyle === 'outline'
              ? { backgroundColor: 'transparent', color: 'var(--store-primary, #2563eb)', border: '2px solid var(--store-primary, #2563eb)' }
              : undefined
          }
        />
      </ProductBlockScope>
    );
  }

  const legacyFields = !advanced ? personalization.fields : [];
  const hasUpload = !!product.allow_customer_upload;
  if (!advanced && legacyFields.length === 0 && !hasUpload) {
    return placeholder(blockLabel(locale, 'This product has no personalization.', 'لا يوجد تخصيص لهذا المنتج.'));
  }

  return (
    <ProductBlockScope className="flex flex-col gap-5">
      {/* Personalization app: fields placed before the variants (namez A) */}
      {advanced && (
        <PersonalizationForm
          model={advanced}
          placement="before_variants"
          showAllErrors={personalization.showAllErrors}
          locale={lang}
          primaryLocale={state.primaryLocale}
          anchor
        />
      )}

      {/* Personalization app form, with piece 1's colour picker on multi-piece products */}
      {advanced && (
        <div className="space-y-3">
          {showHeading && visibleFieldsAt(advanced.defs, advanced.result.visibleIds, 'after_variants').length > 0 && (
            <SectionHeading>{t('product.customizeYourProduct')}</SectionHeading>
          )}
          <PersonalizationForm
            model={advanced}
            placement="after_variants"
            showAllErrors={personalization.showAllErrors}
            locale={lang}
            primaryLocale={state.primaryLocale}
            showSummary={appSettings.validation_summary}
            pieceOne={
              pieceOptionKeys.length > 0 ? (
                <VariantSelector
                  selections={optionSelections}
                  personalization={cardsConfig}
                  variants={variants}
                  selectedVariantId={selectedVariantId}
                  onSelect={setSelectedVariantId}
                  onSelectionsChange={setOptionSelections}
                  inStockText={t('product.inStock')}
                  outOfStockText={t('product.outOfStock')}
                  optionConfigs={product.variant_option_config}
                  optionFilter={(k) => pieceOptionKeys.includes(k)}
                  showStatus={false}
                />
              ) : undefined
            }
          />
        </div>
      )}

      {/* Legacy custom fields */}
      {!advanced && legacyFields.length > 0 && (
        <div className="space-y-3">
          {showHeading && <SectionHeading>{t('product.customizeYourProduct')}</SectionHeading>}
          <CustomFieldsForm
            fields={legacyFields}
            values={personalization.values}
            onChange={personalization.onChange}
            errors={personalization.errors}
            showAllErrors={personalization.showAllErrors}
            fillable={personalization.fillable}
            onFill={personalization.onFill}
          />
        </div>
      )}

      {/* Customer upload */}
      {hasUpload && (
        <div>
          <CustomerUpload
            onFileSelect={handleFileSelect}
            onRemove={handleFileRemove}
            accept="image/*"
            maxSizeMB={10}
            label={t('product.fileUploads')}
            uploading={customerFileUploading}
            error={customerFileError}
            required
          />
        </div>
      )}
    </ProductBlockScope>
  );
}
