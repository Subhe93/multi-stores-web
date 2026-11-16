'use client';

// Product page of a focused storefront (src/lib/focusedStorefront.ts): the
// page is step 1 of a purchase that started on the store's external site, so
// it reads as a booking step instead of a catalogue page:
//   - intro (collection name, title, short description);
//   - a summary card (image, price with the tax note, seller phone): sticky
//     in the side column on desktop, compact above the form on phones;
//   - one card with everything the buyer fills in (personalization / custom
//     fields in a grid, variant options, upload, quantity) and the primary
//     button;
//   - the long description, specifications and FAQ behind a closed "More
//     information" disclosure.
//
// Presentation only. Every value and action comes from the page's one
// product state (`ProductPageStateProvider`): variants, bundles, the
// personalization evaluator and its server errors, max_per_order, sold-out,
// `?qty`, draft preview, add to cart and its destination are exactly those of
// the regular product page, and the fields are the same components. Products
// this layout does not present (`focusedProductLayoutSupports`) keep the
// regular rendering.

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Phone } from 'lucide-react';
import { useProductPageState } from '@/components/product/state/ProductPageState';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { CustomerUpload } from '@/components/product/CustomerUpload';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { visibleFieldsAt } from '@/components/product/personalization/model';
import { collectionDisplayName, resolvePrimaryCollectionPath } from '@/lib/collectionPath';
import { responsiveImgProps } from '@/lib/storeMedia';
import {
  B1_SCOPE_STYLE,
  BundleChip,
  ProductToasts,
  StateVariantSelector,
  b1LangPrefix,
  hasMainVariantOptions,
} from '@/themes/minimal/sections/product/blocks/b1Shared';
import { StateAddToCartButton } from '@/themes/minimal/sections/product/blocks/ProductBuyBlock.client';
import { ProductBundlesBlock } from '@/themes/minimal/sections/product/blocks/ProductBundlesBlock.client';
import { ProductPriceBlock } from '@/themes/minimal/sections/product/blocks/ProductPriceBlock.client';
import { ProductPromotionsBlock } from '@/themes/minimal/sections/product/blocks/ProductPromotionsBlock.client';
import { AttributeValue } from '@/themes/minimal/sections/product/blocks/ProductTabsBlock.client';
import type { ProductContext, SectionRenderProps } from '@/themes/types';

interface FocusedProductLayoutProps {
  storeSlug: string;
  /** Phone of the seller of record, shown under the price when known. */
  sellerPhone?: string | null;
}

const CARD_STYLE: CSSProperties = {
  backgroundColor: 'var(--theme-colors-surface, #fff)',
  border: '1px solid var(--theme-colors-border, #e5e7eb)',
  borderRadius: 'var(--theme-radius-md, 1rem)',
};
const TEXT = 'var(--theme-colors-text, #111827)';
const MUTED = 'var(--theme-colors-muted, #6b7280)';
const BRAND = 'var(--theme-colors-link, var(--store-primary, #2563eb))';
const PROSE =
  'prose prose-gray prose-sm max-w-none leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto';

/** Small uppercase label with a leading rule (the site's eyebrow). */
function Eyebrow({ children, rule = false }: { children: ReactNode; rule?: boolean }) {
  return (
    <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND }}>
      {rule && <span className="h-px w-7 shrink-0" style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />}
      <span className="min-w-0 wrap-break-word">{children}</span>
    </span>
  );
}

export function FocusedProductLayout({ storeSlug, sellerPhone }: FocusedProductLayoutProps) {
  const t = useTranslations();
  const state = useProductPageState();
  const {
    product,
    locale,
    primaryLocale,
    translation,
    advanced,
    appSettings,
    personalization,
    galleryImages,
    tabList,
    quantity,
    quantityMin,
    quantityStep,
    maxQuantity,
    handleQuantityChange,
    quantityLimitMessage,
    customFieldError,
    variantAttemptMessage,
    customerFileUploading,
    customerFileError,
    handleFileSelect,
    handleFileRemove,
  } = state;

  // The blocks reused below are section components: they read the shared
  // state and only need to know a product is in context.
  const blockProps: SectionRenderProps = {
    settings: {},
    content: {},
    locale,
    primaryLocale,
    storeSlug,
    product: product as unknown as ProductContext,
    builderPreview: false,
  };

  const collectionPath = resolvePrimaryCollectionPath(product);
  const collection = collectionPath[collectionPath.length - 1];
  const collectionName = collection ? collectionDisplayName(collection, locale) : '';

  const image = galleryImages[0];
  const phone = sellerPhone?.trim();

  // What the buyer fills in.
  const legacyFields = !advanced ? personalization.fields : [];
  const advancedBefore = advanced ? visibleFieldsAt(advanced.defs, advanced.result.visibleIds, 'before_variants').length > 0 : false;
  const advancedAfter = advanced ? visibleFieldsAt(advanced.defs, advanced.result.visibleIds, 'after_variants').length > 0 : false;
  const hasFields = legacyFields.length > 0 || advancedBefore || advancedAfter || Boolean(product.allow_customer_upload);
  const hasVariants = hasMainVariantOptions(state);
  const pieceOne = state.pieceOptionKeys.length > 0 ? <StateVariantSelector state={state} pieceOne /> : undefined;
  // The picker only shows when more than one unit can be bought at all (a
  // product limited to one per order, or with one unit left, has nothing to pick).
  // A quantity already above the minimum keeps the picker visible, so the
  // buyer can always lower it (a variant with less stock picked afterwards).
  const showQuantity =
    state.quantity > quantityMin || typeof maxQuantity !== 'number' || maxQuantity >= quantityMin + quantityStep;

  const attributes = product.attributes ?? [];
  const faqs = product.faqs ?? [];
  const hasMore = tabList.length > 0;

  return (
    <div className="py-8 md:py-10 lg:py-14" style={{ ...B1_SCOPE_STYLE, color: TEXT }} data-focused-product="">
      <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-x-14 lg:gap-y-8 xl:gap-x-20">
        {/* ─── Intro ─── */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1" data-focused-intro="">
          {collectionName && <Eyebrow rule>{collectionName}</Eyebrow>}
          <h1
            className="text-[2rem] font-semibold leading-[1.1] tracking-tight wrap-break-word md:text-[2.75rem]"
            style={{ fontFamily: 'var(--theme-font-heading)', color: TEXT }}
          >
            {translation?.title}
          </h1>
          {product.vendor?.company_name && (
            <p className="-mt-1 text-sm" style={{ color: MUTED }}>
              {t('product.soldBy', { name: product.vendor.company_name })}
            </p>
          )}
          {/* Short description: HTML sanitized by the API on every write. */}
          {translation?.short_description && (
            <div
              className={`${PROSE} max-w-2xl text-base md:text-[17px]`}
              style={{ color: TEXT }}
              dangerouslySetInnerHTML={{ __html: translation.short_description }}
            />
          )}
        </div>

        {/* ─── Summary card: side column on desktop, compact on phones ─── */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start" data-focused-summary="">
          <div className="flex overflow-hidden lg:block" style={CARD_STYLE}>
            {image && (
              <div className="relative w-28 shrink-0 sm:w-40 lg:aspect-[16/10] lg:w-full" data-focused-image="">
                {/* eslint-disable-next-line @next/next/no-img-element -- CSS-sized cover image; optimized srcset */}
                <img
                  {...responsiveImgProps(image.url, '(min-width: 1024px) 400px, 160px')}
                  alt={image.alt}
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5 lg:gap-3 lg:p-7">
              <Eyebrow>{t('common.price')}</Eyebrow>
              {/* Price chain of the shared state: unit x quantity, compare-at,
                  savings, tax note, coupon banner. */}
              <ProductPriceBlock {...blockProps} settings={{ show_sku: false }} />
              {phone && (
                <p className="mt-1 hidden flex-wrap items-center gap-x-2 gap-y-1 border-t pt-4 text-sm lg:flex" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)', color: MUTED }} data-focused-phone="">
                  <Phone className="size-4 shrink-0" style={{ color: BRAND }} aria-hidden="true" />
                  <span>{t('focused.questionsCall')}</span>
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="font-semibold underline-offset-4 hover:underline" style={{ color: TEXT }} dir="ltr">
                    {phone}
                  </a>
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* ─── Form card + more information ─── */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
          <section
            className="flex flex-col gap-6 p-5 sm:p-7 lg:p-8"
            style={CARD_STYLE}
            aria-labelledby={hasFields ? 'focused-details-heading' : undefined}
            data-focused-form=""
          >
            {hasFields && (
              <h2 id="focused-details-heading" className="text-xl font-semibold leading-tight md:text-2xl" style={{ fontFamily: 'var(--theme-font-heading)', color: TEXT }}>
                {t('focused.stepDetails')}
              </h2>
            )}

            {(product.promotions?.length ?? 0) > 0 && <ProductPromotionsBlock {...blockProps} />}
            {(state.bundles?.length ?? 0) > 0 && <ProductBundlesBlock {...blockProps} />}

            {/* Personalization app: fields placed before the variants. */}
            {advanced && (
              <PersonalizationForm
                model={advanced}
                placement="before_variants"
                showAllErrors={personalization.showAllErrors}
                locale={locale}
                primaryLocale={primaryLocale}
                anchor
              />
            )}

            {hasVariants && (
              <div className="min-w-0">
                <StateVariantSelector state={state} />
              </div>
            )}

            {/* Personalization app form (piece one's option inside its box). */}
            {advanced && (
              <PersonalizationForm
                model={advanced}
                placement="after_variants"
                showAllErrors={personalization.showAllErrors}
                locale={locale}
                primaryLocale={primaryLocale}
                showSummary={appSettings.validation_summary}
                pieceOne={pieceOne}
              />
            )}

            {/* Custom fields: two columns from md up. */}
            {!advanced && legacyFields.length > 0 && (
              <CustomFieldsForm
                fields={legacyFields}
                values={personalization.values}
                onChange={personalization.onChange}
                errors={personalization.errors}
                showAllErrors={personalization.showAllErrors}
                fillable={personalization.fillable}
                onFill={personalization.onFill}
                layout="grid"
              />
            )}

            {product.allow_customer_upload && (
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
            )}

            <div className="flex flex-col gap-3" data-focused-buy="">
              <BundleChip state={state} />
              {showQuantity && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold" style={{ color: TEXT }}>
                    {t('product.quantity')}
                  </span>
                  <QuantitySelector value={quantity} onChange={handleQuantityChange} min={quantityMin} max={maxQuantity} step={quantityStep} />
                </div>
              )}
              <StateAddToCartButton state={state} buttonStyle="solid" className="min-h-13 w-full" />
              {quantityLimitMessage && (
                <p role="status" data-quantity-limit="" className="text-center text-xs" style={{ color: MUTED }}>
                  {quantityLimitMessage}
                </p>
              )}
              {customFieldError && (
                <p role="alert" className="text-center text-sm font-medium text-red-600">
                  {customFieldError}
                </p>
              )}
              {/* Only after a click with options missing (the button stays active). */}
              {variantAttemptMessage && (
                <p role="alert" data-variant-hint="" className="text-center text-sm font-medium text-red-600">
                  {variantAttemptMessage}
                </p>
              )}
            </div>
          </section>

          {/* Long description, specifications and FAQ: available, not in the way. */}
          {hasMore && (
            <details className="group" style={CARD_STYLE} data-focused-more="">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-base font-semibold sm:px-7 [&::-webkit-details-marker]:hidden" style={{ color: TEXT }}>
                {t('focused.moreInformation')}
                <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" style={{ color: MUTED }} aria-hidden="true" />
              </summary>
              <div className="flex flex-col gap-8 border-t px-5 py-6 sm:px-7" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
                {translation?.description && (
                  <div className={PROSE} style={{ color: TEXT }} dangerouslySetInnerHTML={{ __html: translation.description }} />
                )}

                {attributes.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
                      {t('product.specifications')}
                    </h3>
                    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {attributes.map((attr) => (
                            <tr key={attr.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
                              <th scope="row" className="w-2/5 px-4 py-3 text-start font-medium" style={{ color: MUTED }}>
                                {attr.template?.translations?.find((at) => at.locale === locale)?.label ||
                                  attr.template?.translations?.[0]?.label ||
                                  attr.template?.name}
                              </th>
                              <td className="px-4 py-3 font-semibold wrap-break-word" style={{ color: TEXT }}>
                                <AttributeValue attr={attr} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {faqs.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
                      {t('product.faq')}
                    </h3>
                    <div className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
                      {faqs.map((faq, i) => {
                        const faqTrans = faq.translations.find((ft) => ft.locale === locale) || faq.translations[0];
                        return (
                          <details key={faq.id || i} className="group/faq" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
                            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden" style={{ color: TEXT }}>
                              {faqTrans?.question}
                              <ChevronDown className="size-4 shrink-0 transition-transform group-open/faq:rotate-180" style={{ color: MUTED }} aria-hidden="true" />
                            </summary>
                            <div className="prose prose-sm max-w-none px-4 pb-4 pt-1 text-sm" style={{ color: TEXT }} dangerouslySetInnerHTML={{ __html: faqTrans?.answer || '' }} />
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      <ProductToasts state={state} langPrefix={b1LangPrefix(locale, primaryLocale)} />
    </div>
  );
}
