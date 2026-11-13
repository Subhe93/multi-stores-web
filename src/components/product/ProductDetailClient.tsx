'use client';

import Link from 'next/link';
import { collectionDisplayName, collectionHref, collectionPathInChain, resolvePrimaryCollectionPath } from '@/lib/collectionPath';
import { useTranslations } from 'next-intl';
import { ProductGallery } from '@/components/product/ProductGallery';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { ProductCouponBanner } from '@/components/product/ProductCouponBanner';
import { VariantSelector } from '@/components/product/VariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { CustomerUpload } from '@/components/product/CustomerUpload';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { visibleFieldsAt } from '@/components/product/personalization/model';
import { ProductPageStateProvider, useProductPageState, type ProductTabId } from '@/components/product/state/ProductPageState';
import { formatPrice } from '@/lib/format';
import { computeBundlePricing } from '@/lib/bundle';
import type { CustomFieldTranslationLike } from '@/lib/customFields';
import { responsiveImgProps } from '@/lib/storeMedia';
import {
  DesignerCanvasSlot,
  DesignerFormSlot,
  DesignerSessionProvider,
  useDesignerAddonsTotal,
  useDesignerSession,
} from '@/components/designer/DesignerSession';
import { TRUST_BADGE_ICONS, type TrustBadgeItem } from '@/lib/trustBadgeIcons';
import {
  ChevronDown, ShoppingCart, Check, Truck, Globe, Package,
  ShieldCheck, Loader2, Tag, Zap, Gift, Percent, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

export interface ProductData {
  id: string;
  /** Publication state; 'DRAFT' only in the owner's product preview (add to cart disabled). */
  status?: string;
  base_price: number;
  compare_at_price?: number;
  /** b2b app only: estimated tax rate (2500 = 25 %) for the company net view. */
  tax_rate_bp?: number | null;
  allow_customer_upload?: boolean;
  product_type?: string;
  customization_type?: string;
  translations: {
    locale: string;
    title: string;
    slug: string;
    description?: string;
    /** M4.4: short summary HTML (sanitized by the API), shown above add-to-cart. */
    short_description?: string | null;
  }[];
  images: { id?: string; url: string; alt?: string; alt_text?: string; sort_order?: number }[];
  // Marketplace vendor - only present when the store shows vendor names.
  vendor?: { id?: string; company_name: string; logo_url?: string | null } | null;
  variants?: {
    id: string;
    sku?: string;
    price: number;
    compare_at_price?: number;
    stock: number;
    options: Record<string, string>;
    is_active?: boolean;
    images?: { url: string }[];
  }[];
  attributes?: {
    id: string;
    value: unknown;
    template: {
      name: string;
      type?: string;
      unit?: string;
      translations: { locale?: string; label: string }[];
    };
  }[];
  custom_fields?: {
    id: string;
    type: string;
    is_required?: boolean;
    required?: boolean;
    name?: string;
    sort_order?: number | null;
    translations: CustomFieldTranslationLike[];
    options?: unknown;
    validation_rules?: unknown;
    /** `{type, target, fill_char?, max?}`; `target` is the sibling field name (legacy `target_field_id`). */
    linked_validation?: unknown;
    // Personalization app only (M4.1): the payload is a tree with these keys.
    parent_id?: string | null;
    conditions?: unknown;
    pricing?: unknown;
    repeat?: unknown;
    ui?: unknown;
    children?: unknown[];
  }[];
  category?: { translations: { locale: string; name: string }[] };
  creator_categories?: {
    id: string;
    slug: string;
    /** M6.7: slugs root → self. */
    path?: string[];
    translations: { locale: string; name: string }[];
  }[];
  /** M6 §2: id of the primary creator collection; null when none is linked. */
  primary_creator_category_id?: string | null;
  /** M6 §2: root → leaf path of the primary collection (ancestors, then the primary). */
  primary_collection_path?: {
    id: string;
    slug: string;
    /** M6.7: slugs root → self. */
    path?: string[];
    translations: { locale: string; name: string }[];
  }[];
  faqs?: {
    id: string;
    sort_order: number;
    translations: { locale: string; question: string; answer: string }[];
  }[];
  variant_option_config?: {
    name: string;
    style: string;
    colorMap?: Record<string, string>;
    dualColorMap?: Record<string, [string, string]>;
    imageMap?: Record<string, string>;
    /** Swatch-only image per value (M4.4 C38); never the product image. */
    swatchMap?: Record<string, string>;
    values?: string[];
    /** Personalization app: per-value card texts (style 'card'). */
    valueMeta?: Record<string, unknown>;
  }[];
  /** Personalization app (M4.1): present only when the app is on for this product. */
  personalization?: { enabled: boolean; free_shipping_threshold: number | null; currency?: string | null } | null;
  /** Designer app (M4.2): present only when the app, the product link and the
   *  template are active. Read through `readDesignerPayload`. */
  designer?: unknown;
  shipping_profile?: {
    name: string;
    zones: {
      id: string;
      name: string;
      countries: string[];
      base_cost: number;
      per_item_cost: number;
      free_threshold?: number;
      estimated_days_min: number;
      estimated_days_max: number;
      // Selectable methods of the zone. When present they are what the cart
      // and checkout actually charge; the zone's own cost/days columns are
      // only the legacy fallback for a zone without methods.
      methods?: {
        id: string;
        name: string;
        translations?: Record<string, string> | null;
        type?: 'DELIVERY' | 'PICKUP';
        base_cost: number;
        free_threshold?: number | null;
        estimated_days_min: number;
        estimated_days_max: number;
      }[];
    }[];
  };
  field_values?: { custom_field_id: string; value?: string; file_url?: string }[];
  pricing_type?: string;
  _type?: 'custom_product';
  promotions?: {
    id: string;
    type: string;
    value: number;
    conditions?: unknown;
    starts_at?: string;
    expires_at?: string;
    translations: { locale: string; title: string; description?: string }[];
  }[];
  bundles?: {
    id: string;
    status: 'ACTIVE' | 'DISABLED';
    translations: { locale: string; name: string }[];
    offers: {
      id: string;
      quantity: number;
      discount_type: 'ITEM' | 'PERCENTAGE' | 'FIXED';
      discount_value: number | string;
      external_ref?: string | null;
      sort_order: number;
      translations: { locale: string; title: string; label?: string | null; sticker_text?: string | null }[];
    }[];
  }[];
}

// Presentation toggles. All default to the full standalone-page behavior so
// the fallback product route is unaffected; the builder's `product-page`
// section passes a subset to honor its simple show/hide settings.
export interface ProductDetailOptions {
  /**
   * Owner-written reassurance badges (builder `product-page` section content).
   * Nothing is rendered when absent or empty — there are no default claims.
   */
  trustBadges?: TrustBadgeItem[];
  showShipping?: boolean;
  showTabs?: boolean;
  buttonStyle?: 'solid' | 'outline';
  /** Gallery main-image aspect ratio (builder setting; defaults to square). */
  galleryAspect?: 'square' | 'portrait' | 'landscape';
}

interface ProductDetailClientProps {
  product: ProductData;
  locale?: string;
  /** Store primary locale; used as the fallback when `locale` has no translation. */
  primaryLocale?: string;
  currency?: string;
  langPrefix?: string;
  options?: ProductDetailOptions;
}

/**
 * Promotion end date, identical on the server and the client (M5 D6): the
 * storefront locale and a fixed UTC zone instead of the runtime defaults
 * (`toLocaleDateString()` differed between Node and the browser and caused
 * a hydration mismatch). An unparsable date renders nothing.
 */
function formatPromoDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// ── Tabs component ────────────────────────────────────────

type TabId = ProductTabId;

function ProductTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: TabId; label: string; count?: number }[];
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative shrink-0 whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'text-gray-900'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ms-1.5 text-xs text-gray-400">({tab.count})</span>
          )}
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 inset-x-0 h-0.5"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
// ── Main component ────────────────────────────────────────

/**
 * The product page body. Designer app (M5.5): the page owns the design
 * session (canvas in the gallery column, form in the summary column); inside
 * a PRODUCT_TEMPLATE page the outer provider is reused. The shopper's
 * choices, prices and add-to-cart live in the shared product page state
 * (`ProductPageStateProvider`); inside a PRODUCT_TEMPLATE the route's outer
 * provider for the same product is reused, so separate product blocks and
 * this section stay in sync.
 */
export function ProductDetailClient(props: ProductDetailClientProps) {
  return (
    <DesignerSessionProvider designer={props.product.designer} productId={props.product.id} locale={props.locale ?? 'en'}>
      <ProductPageStateProvider
        product={props.product}
        locale={props.locale ?? 'en'}
        primaryLocale={props.primaryLocale ?? 'en'}
        currency={props.currency ?? 'EUR'}
      >
        <ProductDetailBody {...props} />
      </ProductPageStateProvider>
    </DesignerSessionProvider>
  );
}

function ProductDetailBody({ product, locale = 'en', primaryLocale = 'en', currency = 'EUR', langPrefix = '', options }: ProductDetailClientProps) {
  const t = useTranslations();
  const {
    variants,
    variantOptionKeys,
    selectedVariantId,
    setSelectedVariantId,
    selectedVariant,
    optionSelections,
    setOptionSelections,
    taxRateBp,
    app,
    appSettings,
    advanced,
    cardsConfig,
    pieceOptionKeys,
    personalization,
    customerFileUploading,
    customerFileError,
    handleFileSelect,
    handleFileRemove,
    addToCartError,
    setAddToCartError,
    addingToCart,
    addedToCart,
    activeGalleryIndex,
    setActiveGalleryIndex,
    activeTab,
    setActiveTab,
    selectedBundleOfferId,
    setSelectedBundleOfferId,
    selectedBundleOffer,
    bundlePricing,
    translation,
    galleryImages,
    baseUnitPrice,
    display,
    currentPrice,
    maxStock,
    isAddDisabled,
    handleSelectBundle,
    handleQuantityChange,
    customFieldError,
    handleAddToCart,
    designerBlockedReason,
    handleDesignerAdd,
    handleDesignerDone,
    tabList,
    quantity,
    displayPrice,
    displayComparePrice,
    savings,
  } = useProductPageState();
  const {
    fields: mappedCustomFields,
    values: customFieldValues,
    onChange: handleCustomFieldChange,
  } = personalization;

  // Presentation toggles — default to "show everything" so the standalone
  // product page is unchanged; the builder section overrides per its settings.
  const trustBadges = options?.trustBadges ?? [];
  const showShipping = options?.showShipping ?? true;
  const showTabs = options?.showTabs ?? true;
  const buttonStyle = options?.buttonStyle ?? 'solid';

  // Designer app (M4.2 / M5.5): the inline designer replaces the gallery,
  // the personalization form and the add-to-cart button. No session = the
  // page exactly as before.
  const designer = useDesignerSession();
  const designerAddons = useDesignerAddonsTotal();

  // ── Helpers ───────────────────────────────────────────

  const renderAttrValue = (attr: NonNullable<ProductData['attributes']>[0]) => {
    const type = attr.template?.type;
    const val = attr.value;
    const unit = attr.template?.unit;

    if (type === 'COLOR' && typeof val === 'string') {
      return (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border border-gray-200 inline-block" style={{ backgroundColor: val, borderRadius: 'var(--theme-swatch-radius, 9999px)' }} />
          {val}
        </span>
      );
    }
    if (type === 'BOOLEAN') return val ? t('common.yes') : t('common.no');
    if (type === 'DIMENSIONS' && typeof val === 'object') {
      return Object.entries(val as Record<string, unknown>).map(([, v]) => `${v}${unit || ''}`).join(' × ');
    }
    if (type === 'MULTI_SELECT' && Array.isArray(val)) return val.join(', ');
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return unit ? `${str} ${unit}` : str;
  };

  // ── Render ────────────────────────────────────────────

  return (
    <>
      {/* grid-cols-1 is explicit so the mobile track is minmax(0,1fr): a bare
          `grid` auto track sizes to content, and the thumbnail strip's
          min-content width (72px × image count) would push the whole page
          wider than the viewport and clip the right side. min-w-0 on both
          children stops the same min-content propagation at the item level. */}
      {/* Designer app (M5.5, NPP layout): on desktop the live canvas takes the
          gallery column (featured image as a thumbnail above it); on mobile
          the column wrappers collapse (`contents`) so the items can be
          ordered: featured image → title / price → canvas → form → CTA. */}
      <div className={designer ? 'grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8 lg:gap-14' : 'grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14'}>
        {/* ─── Left: Gallery ─── */}
        <div className={designer ? 'contents md:block md:min-w-0 md:sticky md:top-24 md:self-start' : 'min-w-0 md:sticky md:top-24 md:self-start'}>
          {designer ? (
            <>
              {galleryImages[0] && (
                // eslint-disable-next-line @next/next/no-img-element -- natural-ratio thumbnail; optimized srcset
                <img
                  {...responsiveImgProps(galleryImages[0].url, '270px')}
                  alt={galleryImages[0].alt}
                  fetchPriority="high"
                  className="-order-3 mx-auto block h-auto w-full max-w-67.5 rounded-xl shadow-sm md:order-0 md:mb-4"
                />
              )}
              <DesignerCanvasSlot className="-order-1 min-w-0 md:order-0" />
            </>
          ) : (
            <ProductGallery
              images={galleryImages}
              activeIndex={activeGalleryIndex}
              onIndexChange={setActiveGalleryIndex}
              aspect={options?.galleryAspect}
            />
          )}
        </div>

        {/* ─── Right: Product Info ─── */}
        <div className={designer ? 'contents md:flex md:flex-col md:gap-5 md:min-w-0' : 'flex flex-col gap-5 min-w-0'}>

          {/* Creator collection (above title) */}
          {(() => {
            // Primary collection = leaf of `primary_collection_path` (M6 §2);
            // older payloads fall back to the first linked collection.
            const path = resolvePrimaryCollectionPath(product);
            const collection = path[path.length - 1];
            if (!collection) return null;
            const collectionName = collectionDisplayName(collection, locale);
            return (
              <Link
                href={`${langPrefix}${collectionHref({ path: collectionPathInChain(path, path.length - 1), slug: collection.slug })}`}
                className="-order-2 text-xs font-medium uppercase tracking-widest hover:underline w-fit md:order-0"
                style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
              >
                {collectionName}
              </Link>
            );
          })()}

          {/* Title */}
          <h1 className="-order-2 text-3xl lg:text-4xl font-bold text-gray-900 leading-tight md:order-0">
            {translation?.title}
          </h1>
          {product.vendor?.company_name && (
            <p className="-order-2 -mt-3 text-sm text-gray-500 md:order-0">
              {t('product.soldBy', { name: product.vendor.company_name })}
            </p>
          )}

          {/* Price + Savings */}
          <div className="-order-2 flex flex-col gap-1 md:order-0">
            <PriceDisplay
              price={displayPrice}
              comparePrice={displayComparePrice}
              currency={currency}
              locale={locale}
              taxRateBp={taxRateBp}
            />
            {/* Personalization app: the modifier is priced in the cart outside the default market. */}
            {app.deltaInCart && (
              <p className="text-xs text-gray-500">{t('personalization.priceInCart')}</p>
            )}
            {quantity > 1 && (
              <p className="text-xs text-gray-500">
                {formatPrice(display(currentPrice, taxRateBp, currency).amount, currency, locale)} × {quantity}
              </p>
            )}
            {savings > 0 && (
              <p className="text-sm text-green-600 font-medium">
                {t('product.savingsAmount', { amount: formatPrice(display(savings, taxRateBp, currency).amount, currency, locale) })}
              </p>
            )}
            {/* Campaign-link / applied coupon: what it does for this line. */}
            <ProductCouponBanner className="mt-1" />
            {selectedVariant?.sku && (
              <p className="text-xs text-gray-400 mt-1">SKU: {selectedVariant.sku}</p>
            )}
          </div>

          {/* Short description: HTML sanitized by the API on every write (sanitizeCreatorHtml), only when set. */}
          {translation?.short_description && (
            <div
              className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: translation.short_description }}
            />
          )}

          {/* Active Promotions */}
          {product.promotions && product.promotions.length > 0 && (
            <div className="space-y-2">
              {product.promotions.map((promo) => {
                const promoTitle = promo.translations?.find((pt) => pt.locale === locale)?.title
                  || promo.translations?.[0]?.title || '';
                const promoDesc = promo.translations?.find((pt) => pt.locale === locale)?.description
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
                  : promo.type === 'FIXED_AMOUNT' ? t('product.amountOff', { amount: formatPrice(promo.value, currency, locale) })
                  : promo.type === 'FREE_SHIPPING' ? t('checkout.freeShippingLabel')
                  : promo.type === 'FLASH_SALE' ? t('product.percentOff', { percent: promo.value })
                  : '';

                return (
                  <div key={promo.id} className={`flex items-start gap-3 rounded-xl border p-3 ${bgColor}`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${textColor}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${textColor}`}>
                        {promoTitle || label}
                      </p>
                      {promoDesc && (
                        <div
                          className={`text-xs mt-0.5 ${textColor} opacity-80 prose prose-sm max-w-none [&_p]:my-0`}
                          dangerouslySetInnerHTML={{ __html: promoDesc }}
                        />
                      )}
                      {promo.expires_at && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {t('product.endsOn')} {formatPromoDate(promo.expires_at, locale)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bundles — quantity-tier offers */}
          {product.bundles && product.bundles.length > 0 && (
            <div className="space-y-3">
              {product.bundles.map((bundle) => {
                const sortedOffers = [...bundle.offers].sort(
                  (a, b) => a.sort_order - b.sort_order,
                );
                if (sortedOffers.length === 0) return null;
                return (
                  <div key={bundle.id} className="space-y-2">
                    {sortedOffers.map((offer) => {
                      const tr =
                        offer.translations.find((t) => t.locale === locale) ||
                        offer.translations[0];
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
                                isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                              )}
                            </span>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate text-sm font-medium text-gray-900">
                                {title}
                              </span>
                              {label && (
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                                  {label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end">
                            <span className="text-sm font-semibold tabular-nums text-gray-900">
                              {formatPrice(pricing.finalTotal, currency, locale)}
                            </span>
                            {pricing.originalTotal > pricing.finalTotal && (
                              <span className="text-xs text-gray-400 line-through tabular-nums">
                                {formatPrice(pricing.originalTotal, currency, locale)}
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
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Personalization app: fields placed before the variants (namez A) */}
          {advanced && !designer && (
            <PersonalizationForm
              model={advanced}
              placement="before_variants"
              showAllErrors={personalization.showAllErrors}
              locale={locale}
              primaryLocale={primaryLocale}
              anchor
            />
          )}

          {/* Variant Selector. On a multi-piece product (personalization repeater
              standing for pieces 2..N) the option its colour palettes draw from
              is piece 1's colour: it moves into the piece-1 box below so piece 1
              looks like every other piece; the quantity cards stay here. */}
          {variants.length > 0 && variantOptionKeys.some((k) => !pieceOptionKeys.includes(k)) && (
            <div>
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
                optionFilter={pieceOptionKeys.length > 0 ? (k) => !pieceOptionKeys.includes(k) : undefined}
              />
            </div>
          )}

          {/* Design Selector */}
          {/* Custom Fields — personalization app form */}
          {advanced && !designer && (
            <div className="space-y-3">
              {visibleFieldsAt(advanced.defs, advanced.result.visibleIds, 'after_variants').length > 0 && (
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} />
                  {t('product.customizeYourProduct')}
                </h2>
              )}
              <PersonalizationForm
                model={advanced}
                placement="after_variants"
                showAllErrors={personalization.showAllErrors}
                locale={locale}
                primaryLocale={primaryLocale}
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
          {/* Custom Fields */}
          {!advanced && !designer && mappedCustomFields.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} />
                {t('product.customizeYourProduct')}
              </h2>
              <CustomFieldsForm
                fields={mappedCustomFields}
                values={customFieldValues}
                onChange={handleCustomFieldChange}
                errors={personalization.errors}
                showAllErrors={personalization.showAllErrors}
                fillable={personalization.fillable}
                onFill={personalization.onFill}
              />
            </div>
          )}

          {/* Customer Upload */}
          {product.allow_customer_upload && !designer && (
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

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Quantity + Add to Cart */}
          <div className="space-y-4">
            {selectedBundleOffer && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-blue-900 truncate">
                    {selectedBundleOffer.translation?.title || t('product.buyQuantity', { count: selectedBundleOffer.offer.quantity })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBundleOfferId(null)}
                  className="text-xs text-blue-700 hover:text-blue-900 underline shrink-0"
                >
                  {t('cart.remove')}
                </button>
              </div>
            )}
            {designer ? (
              // Inline designer form (M5.5): photos → texts → CTA with the live
              // total; our quantity picker sits next to the CTA (beyond NPP).
              <DesignerFormSlot
                totalLabel={formatPrice(display((currentPrice + designerAddons) * quantity, taxRateBp, currency).amount, currency, locale)}
                formatMoney={(amount) => formatPrice(display(amount, taxRateBp, currency).amount, currency, locale)}
                quantitySelector={
                  <QuantitySelector
                    value={quantity}
                    onChange={handleQuantityChange}
                    min={bundlePricing?.cartQuantity ?? 1}
                    max={maxStock}
                    step={bundlePricing?.cartQuantity ?? 1}
                  />
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
            ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <QuantitySelector
                value={quantity}
                onChange={handleQuantityChange}
                min={bundlePricing?.cartQuantity ?? 1}
                max={maxStock}
                step={bundlePricing?.cartQuantity ?? 1}
              />

              {(
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAddDisabled || addingToCart}
                  className={`flex-1 min-w-48 flex items-center justify-center gap-2.5 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                    addedToCart
                      ? 'bg-green-600 text-white scale-[1.02]'
                      : isAddDisabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : addingToCart
                          ? 'opacity-80'
                          : 'hover:opacity-90 hover:shadow-lg active:scale-[0.98]'
                  }`}
                  style={
                    addedToCart || isAddDisabled
                      ? undefined
                      : buttonStyle === 'outline'
                        ? {
                            backgroundColor: 'transparent',
                            color: 'var(--store-primary, #2563eb)',
                            border: '2px solid var(--store-primary, #2563eb)',
                          }
                        : { backgroundColor: 'var(--store-primary, #2563eb)' }
                  }
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
                      {t('common.addToCart')}
                    </>
                  )}
                </button>
              )}
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
          </div>

          {/* Trust badges — only the owner's own claims, never defaults */}
          {trustBadges.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {trustBadges.map((badge, i) => {
                const Icon = (badge.icon && TRUST_BADGE_ICONS[badge.icon]) || ShieldCheck;
                return (
                  <div key={`${badge.label}-${i}`} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--store-primary, #2563eb)' }} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-600">{badge.label}</div>
                      {badge.description && (
                        <div className="text-[11px] text-gray-400 leading-snug">{badge.description}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shipping & Delivery */}
          {showShipping && product.shipping_profile && product.shipping_profile.zones.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" style={{ color: 'var(--store-primary, #2563eb)' }} />
                {t('product.shippingAndDelivery')}
              </h2>
              <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {product.shipping_profile.zones.flatMap((zone) => {
                  // One row per method; a zone without methods falls back to
                  // its legacy single cost/days so old data still renders.
                  const rows = zone.methods?.length
                    ? zone.methods.map((m) => ({
                        key: m.id,
                        title: m.translations?.[locale] || m.name,
                        pickup: m.type === 'PICKUP',
                        cost: Number(m.base_cost),
                        freeOver: m.free_threshold != null ? Number(m.free_threshold) : null,
                        daysMin: m.estimated_days_min,
                        daysMax: m.estimated_days_max,
                      }))
                    : [
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
                  const countries =
                    zone.countries.length > 0
                      ? ` · ${zone.countries.slice(0, 3).join(', ')}${zone.countries.length > 3 ? ` +${zone.countries.length - 3}` : ''}`
                      : '';
                  return rows.map((row) => (
                    <div key={row.key} className="px-4 py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                          {row.pickup ? (
                            <Package className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {row.title}
                            {rows.length > 1 || row.title !== zone.name ? (
                              <span className="text-gray-400 font-normal"> · {zone.name}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {row.pickup
                              ? t('product.pickup')
                              : t('product.estimatedDays', { min: row.daysMin, max: row.daysMax })}
                            <span className="text-gray-400">{countries}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-sm font-semibold text-gray-800">
                          {row.cost > 0 ? formatPrice(row.cost, currency, locale) : t('product.freeShipping')}
                        </p>
                        {row.freeOver != null && row.cost > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1 justify-end">
                            <Package className="w-3 h-3" />
                            {t('product.freeShippingOver', { amount: formatPrice(row.freeOver, currency, locale) })}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom Section: Tabs ─── */}
      {showTabs && tabList.length > 0 && (
        <div className="mt-12 lg:mt-16">
          <ProductTabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="py-6 px-5 bg-white rounded-xl border border-gray-100">
            {/* Description tab */}
            {activeTab === 'description' && translation?.description && (
              <div
                className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: translation.description }}
              />
            )}

            {/* Specifications tab */}
            {activeTab === 'specifications' && product.attributes && product.attributes.length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-x-auto max-w-2xl">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {product.attributes.map((attr, i) => {
                      const attrLabel =
                        attr.template?.translations?.find((at) => at.locale === locale)?.label ||
                        attr.template?.translations?.[0]?.label ||
                        attr.template?.name;
                      return (
                        <tr key={attr.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-gray-500 font-medium w-2/5 border-b border-gray-100">
                            {attrLabel}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-semibold border-b border-gray-100 wrap-break-word">
                            {renderAttrValue(attr)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* FAQ tab */}
            {activeTab === 'faq' && product.faqs && product.faqs.length > 0 && (
              <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden max-w-2xl">
                {product.faqs.map((faq, i) => {
                  const faqTrans =
                    faq.translations.find((ft) => ft.locale === locale) || faq.translations[0];
                  return (
                    <details key={faq.id || i} className="group">
                      <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors list-none">
                        {faqTrans?.question}
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <div
                        className="px-4 pb-4 pt-1 text-sm text-gray-600 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: faqTrans?.answer || '' }}
                      />
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating toast: added to cart, with a way to the cart (M5 D5) */}
      {addedToCart && (
        <div role="status" className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-50 flex items-center gap-3 bg-gray-900 text-white ps-5 pe-2 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-sm font-medium">{t('cart.itemAdded')}</span>
          <Link
            href={`${langPrefix}/cart`}
            className="min-h-11 inline-flex items-center px-3 rounded-full bg-white/15 hover:bg-white/25 text-sm font-semibold whitespace-nowrap transition-colors"
          >
            {t('cart.viewCart')}
          </Link>
        </div>
      )}

      {/* Floating toast: error */}
      {addToCartError && (
        <div role="alert" className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-50 flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-medium">{addToCartError}</span>
          <button onClick={() => setAddToCartError('')} aria-label={t('common.close')} className="size-11 -me-3 flex items-center justify-center text-white/70 hover:text-white ms-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}