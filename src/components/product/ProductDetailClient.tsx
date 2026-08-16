'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProductGallery } from '@/components/product/ProductGallery';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { VariantSelector } from '@/components/product/VariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { CustomerUpload } from '@/components/product/CustomerUpload';
import { CustomFieldsForm, type CustomField } from '@/components/product/CustomFieldsForm';
import { resolveMediaUrl } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useCart } from '@/hooks/useCart';
import { computeBundlePricing } from '@/lib/bundle';
import {
  ChevronDown, ShoppingCart, Check, Truck, Globe, Package,
  Shield, RotateCcw, Star, Loader2, Tag, Zap, Gift, Percent, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

interface ProductData {
  id: string;
  base_price: number;
  compare_at_price?: number;
  allow_customer_upload?: boolean;
  product_type?: string;
  customization_type?: string;
  translations: { locale: string; title: string; slug: string; description?: string }[];
  images: { id?: string; url: string; alt?: string; alt_text?: string; sort_order?: number }[];
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
    value: any;
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
    translations: { locale: string; label: string; placeholder?: string }[];
    options?: string[] | any;
    validation_rules?: { min_length?: number; max_length?: number; pattern?: string; allowed_chars?: string };
    linked_validation?: { type: string; target_field_id: string; fill_char?: string };
  }[];
  tags?: { tag: string }[];
  category?: { translations: { locale: string; name: string }[] };
  creator_categories?: {
    id: string;
    slug: string;
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
  }[];
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
    }[];
  };
  field_values?: { custom_field_id: string; value?: string; file_url?: string }[];
  pricing_type?: string;
  _type?: 'custom_product';
  promotions?: {
    id: string;
    type: string;
    value: number;
    conditions?: any;
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
  showTrustBadges?: boolean;
  showShipping?: boolean;
  showTabs?: boolean;
  showTags?: boolean;
  buttonStyle?: 'solid' | 'outline';
}

interface ProductDetailClientProps {
  product: ProductData;
  locale?: string;
  currency?: string;
  langPrefix?: string;
  options?: ProductDetailOptions;
}

// ── Tabs component ────────────────────────────────────────

type TabId = 'description' | 'specifications' | 'faq';

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
            <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
          )}
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export function ProductDetailClient({ product, locale = 'en', currency = 'EUR', langPrefix = '', options }: ProductDetailClientProps) {
  const t = useTranslations();
  const { addItem } = useCart();
  const variants = product.variants || [];

  // Presentation toggles — default to "show everything" so the standalone
  // product page is unchanged; the builder section overrides per its settings.
  const showTrustBadges = options?.showTrustBadges ?? true;
  const showShipping = options?.showShipping ?? true;
  const showTabs = options?.showTabs ?? true;
  const showTags = options?.showTags ?? true;
  const buttonStyle = options?.buttonStyle ?? 'solid';

  // ── State ─────────────────────────────────────────────
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    variants.length === 1 ? variants[0].id : undefined
  );
  const [quantity, setQuantity] = useState(1);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(() => {
    // Pre-fill values from creator-set field_values (custom products)
    const initial: Record<string, any> = {};
    if (product.field_values?.length) {
      for (const fv of product.field_values) {
        if (fv.value) initial[fv.custom_field_id] = fv.value;
        else if (fv.file_url) initial[fv.custom_field_id] = fv.file_url;
      }
    }
    return initial;
  });
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState('');
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [selectedBundleOfferId, setSelectedBundleOfferId] = useState<string | null>(null);
  // Partial option picks (e.g. color chosen, size pending) — drives the
  // gallery via value-level images before a full variant is resolved.
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});

  // ── Memos ─────────────────────────────────────────────

  const translation = useMemo(() => {
    if (!product.translations?.length) return null;
    return (
      product.translations.find((t) => t.locale === locale) || product.translations[0]
    );
  }, [product.translations, locale]);

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [selectedVariantId, variants]);

  const galleryImages = useMemo(() => {
    const alt = translation?.title || '';
    // Priority: variant-specific images (per-combination override), then
    // value-level images of the currently picked options (Shopify-style: one
    // image per color, shared by every size), then the product gallery.
    const prioritized: { id: string; url: string; alt: string }[] = [];

    if (selectedVariant?.images?.length) {
      selectedVariant.images.forEach((img, i) => {
        prioritized.push({
          id: `variant-${selectedVariant.id}-${i}`,
          url: resolveMediaUrl(img.url),
          alt,
        });
      });
    }

    for (const cfg of product.variant_option_config || []) {
      const picked = optionSelections[cfg.name];
      const valueImage = picked ? cfg.imageMap?.[picked] : undefined;
      if (valueImage) {
        prioritized.push({
          id: `option-${cfg.name}-${picked}`,
          url: resolveMediaUrl(valueImage),
          alt: `${alt} — ${picked}`,
        });
      }
    }

    const baseImages = (product.images || []).map((img, i) => ({
      id: img.id || `img-${i}`,
      url: resolveMediaUrl(img.url),
      alt: img.alt || img.alt_text || alt,
    }));

    // Dedupe by URL, first occurrence wins (prioritized images stay on top).
    const seen = new Set<string>();
    return [...prioritized, ...baseImages].filter((img) => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });
  }, [product.images, product.variant_option_config, selectedVariant, optionSelections, translation]);

  // Jump back to the first image whenever the gallery's lead image changes
  // (variant picked or a value-level image surfaced).
  const leadImageUrl = galleryImages[0]?.url;
  useEffect(() => {
    setActiveGalleryIndex(0);
  }, [leadImageUrl]);

  const baseUnitPrice = useMemo(() => {
    return selectedVariant ? Number(selectedVariant.price) : Number(product.base_price);
  }, [selectedVariant, product.base_price]);

  const selectedBundleOffer = useMemo(() => {
    if (!selectedBundleOfferId || !product.bundles?.length) return null;
    for (const bundle of product.bundles) {
      const offer = bundle.offers.find((o) => o.id === selectedBundleOfferId);
      if (offer) {
        const tr =
          offer.translations.find((t) => t.locale === locale) || offer.translations[0];
        return { bundle, offer, translation: tr };
      }
    }
    return null;
  }, [selectedBundleOfferId, product.bundles, locale]);

  const bundlePricing = useMemo(() => {
    if (!selectedBundleOffer) return null;
    return computeBundlePricing(baseUnitPrice, {
      quantity: selectedBundleOffer.offer.quantity,
      discount_type: selectedBundleOffer.offer.discount_type,
      discount_value: selectedBundleOffer.offer.discount_value,
    });
  }, [selectedBundleOffer, baseUnitPrice]);

  const currentPrice = useMemo(() => {
    return bundlePricing ? bundlePricing.effectiveUnitPrice : baseUnitPrice;
  }, [bundlePricing, baseUnitPrice]);

  // When a bundle is selected, force quantity to the bundle's cart quantity
  useEffect(() => {
    if (bundlePricing) {
      setQuantity(bundlePricing.cartQuantity);
    }
  }, [bundlePricing]);

  // If the selected offer disappears (e.g. product change), clear the selection
  useEffect(() => {
    if (selectedBundleOfferId && !selectedBundleOffer) {
      setSelectedBundleOfferId(null);
    }
  }, [selectedBundleOfferId, selectedBundleOffer]);

  const comparePrice = useMemo(() => {
    if (selectedVariant?.compare_at_price) return Number(selectedVariant.compare_at_price);
    if (product.compare_at_price) return Number(product.compare_at_price);
    return undefined;
  }, [selectedVariant, product.compare_at_price]);

  const maxStock = useMemo(() => {
    return selectedVariant ? selectedVariant.stock : undefined;
  }, [selectedVariant]);

  // Fields the creator already filled (should not be shown to customers)
  const creatorFilledFieldIds = useMemo(() => {
    if (!product.field_values?.length) return new Set<string>();
    return new Set(
      product.field_values
        .filter((fv) => fv.value || fv.file_url)
        .map((fv) => fv.custom_field_id),
    );
  }, [product.field_values]);

  const mappedCustomFields: CustomField[] = useMemo(() => {
    if (!product.custom_fields?.length) return [];
    return product.custom_fields
      .filter((field) => !creatorFilledFieldIds.has(field.id)) // Hide creator-filled fields
      .map((field) => {
        const fieldTranslation =
          field.translations?.find((t) => t.locale === locale) || field.translations?.[0];
        return {
          id: field.id,
          type: field.type as CustomField['type'],
          required: field.is_required ?? field.required ?? false,
          label: fieldTranslation?.label || field.id,
          placeholder: fieldTranslation?.placeholder,
          options: Array.isArray(field.options) ? field.options : undefined,
          validation: field.validation_rules
            ? {
                min: field.validation_rules.min_length,
                max: field.validation_rules.max_length,
                pattern: field.validation_rules.pattern,
              }
            : undefined,
        };
      });
  }, [product.custom_fields, locale, creatorFilledFieldIds]);

  const isAddDisabled = useMemo(() => {
    if (variants.length > 0 && !selectedVariantId) return true;
    if (selectedVariant && selectedVariant.stock <= 0) return true;
    return false;
  }, [variants, selectedVariantId, selectedVariant]);

  // ── Handlers ──────────────────────────────────────────

  const handleCustomFieldChange = useCallback((fieldId: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleSelectBundle = useCallback((offerId: string) => {
    setSelectedBundleOfferId((prev) => (prev === offerId ? null : offerId));
  }, []);

  const handleQuantityChange = useCallback((next: number) => {
    setQuantity(next);
    // Keep the bundle active as long as the new quantity is a positive multiple
    // of the bundle's cartQuantity (so "buy 2 get 1" applies twice at qty 6).
    if (selectedBundleOfferId && bundlePricing) {
      const cq = bundlePricing.cartQuantity;
      if (cq <= 0 || next % cq !== 0) {
        setSelectedBundleOfferId(null);
      }
    }
  }, [selectedBundleOfferId, bundlePricing]);

  const handleFileSelect = useCallback((file: File) => {
    setCustomerFile(file);
  }, []);

  const [customFieldError, setCustomFieldError] = useState('');

  const handleAddToCart = useCallback(async () => {
    if (addingToCart || isAddDisabled) return;
    setCustomFieldError('');

    // Validate required custom fields before adding to cart
    const missingRequired = mappedCustomFields.filter((field) => {
      if (!field.required) return false;
      const val = customFieldValues[field.id];
      return val === undefined || val === null || val === '';
    });
    if (missingRequired.length > 0) {
      setCustomFieldError(
        t('product.requiredFieldsMissing'),
      );
      return;
    }

    setAddingToCart(true);
    setAddToCartError('');

    // Keep field IDs as keys so order creation can match them to custom_field_id
    const fields =
      Object.keys(customFieldValues).length > 0
        ? Object.fromEntries(
            Object.entries(customFieldValues)
              .filter(([, v]) => v !== '' && v != null)
          )
        : undefined;

    const variantStr = selectedVariant
      ? Object.entries(selectedVariant.options).map(([k, v]) => `${k}: ${v}`).join(' / ')
      : undefined;

    try {
      await addItem(
        product.id,
        selectedVariantId || null,
        quantity,
        fields,
        {
          title: translation?.title || 'Product',
          price: currentPrice,
          imageUrl: galleryImages[0]?.url || resolveMediaUrl(product.images?.[0]?.url),
          variant: variantStr,
          customerFile: customerFile ? customerFile.name : undefined,
          customProductId: product._type === 'custom_product' ? product.id : undefined,
          bundleOfferId: selectedBundleOfferId || undefined,
          bundleOriginalUnitPrice: selectedBundleOffer ? baseUnitPrice : undefined,
          bundleTitle: selectedBundleOffer?.translation?.title || undefined,
          bundleLabel: selectedBundleOffer?.translation?.label || undefined,
          bundleStickerText: selectedBundleOffer?.translation?.sticker_text || undefined,
          bundleCartQuantity: bundlePricing?.cartQuantity ?? undefined,
        },
      );
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);
    } catch (err) {
      setAddToCartError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setAddingToCart(false);
    }
  }, [
    addingToCart, isAddDisabled, product.id, product.images,
    selectedVariantId, selectedVariant, quantity, translation,
    currentPrice, galleryImages, customFieldValues, mappedCustomFields,
    customerFile, addItem, selectedBundleOfferId, selectedBundleOffer,
    bundlePricing, baseUnitPrice,
  ]);

  // ── Helpers ───────────────────────────────────────────

  const renderAttrValue = (attr: NonNullable<ProductData['attributes']>[0]) => {
    const type = attr.template?.type;
    const val = attr.value;
    const unit = attr.template?.unit;

    if (type === 'COLOR' && typeof val === 'string') {
      return (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border border-gray-200 inline-block" style={{ backgroundColor: val }} />
          {val}
        </span>
      );
    }
    if (type === 'BOOLEAN') return val ? 'Yes' : 'No';
    if (type === 'DIMENSIONS' && typeof val === 'object') {
      return Object.entries(val as Record<string, any>).map(([, v]) => `${v}${unit || ''}`).join(' × ');
    }
    if (type === 'MULTI_SELECT' && Array.isArray(val)) return val.join(', ');
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return unit ? `${str} ${unit}` : str;
  };

  // Tab data
  const tabList = useMemo(() => {
    const tabs: { id: TabId; label: string; count?: number }[] = [];
    if (translation?.description) {
      tabs.push({ id: 'description', label: t('product.description') });
    }
    if (product.attributes && product.attributes.length > 0) {
      tabs.push({ id: 'specifications', label: t('product.specifications') });
    }
    if (product.faqs && product.faqs.length > 0) {
      tabs.push({ id: 'faq', label: t('product.faq'), count: product.faqs.length });
    }
    return tabs;
  }, [translation, product.attributes, product.faqs, t]);

  // Auto-select first valid tab
  useEffect(() => {
    if (tabList.length > 0 && !tabList.find((tb) => tb.id === activeTab)) {
      setActiveTab(tabList[0].id);
    }
  }, [tabList, activeTab]);

  // The headline price is always the line total (unit × quantity). With a
  // bundle, the original total comes from the un-discounted base price.
  // Without a bundle, fall back to the variant/product compare_at_price.
  const displayPrice = currentPrice * quantity;
  const displayComparePrice = bundlePricing
    ? baseUnitPrice * quantity
    : comparePrice !== undefined
      ? comparePrice * quantity
      : undefined;
  const savings =
    displayComparePrice !== undefined && displayComparePrice > displayPrice
      ? displayComparePrice - displayPrice
      : 0;

  // ── Render ────────────────────────────────────────────

  return (
    <>
      <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
        {/* ─── Left: Gallery ─── */}
        <div className="md:sticky md:top-24 md:self-start">
          <ProductGallery
            images={galleryImages}
            activeIndex={activeGalleryIndex}
            onIndexChange={setActiveGalleryIndex}
          />
        </div>

        {/* ─── Right: Product Info ─── */}
        <div className="flex flex-col gap-5">

          {/* Creator collection (above title) */}
          {product.creator_categories && product.creator_categories.length > 0 && (() => {
            const collection = product.creator_categories[0];
            const collectionName =
              collection.translations?.find((ct) => ct.locale === locale)?.name ||
              collection.translations?.find((ct) => ct.locale === 'en')?.name ||
              collection.translations?.[0]?.name ||
              collection.slug;
            return (
              <Link
                href={`${langPrefix}/collections/${collection.slug}`}
                className="text-xs font-medium uppercase tracking-widest hover:underline w-fit"
                style={{ color: 'var(--store-primary, #2563eb)' }}
              >
                {collectionName}
              </Link>
            );
          })()}

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            {translation?.title}
          </h1>

          {/* Price + Savings */}
          <div className="flex flex-col gap-1">
            <PriceDisplay
              price={displayPrice}
              comparePrice={displayComparePrice}
              currency={currency}
              locale={locale}
            />
            {quantity > 1 && (
              <p className="text-xs text-gray-500">
                {formatPrice(currentPrice, currency, locale)} × {quantity}
              </p>
            )}
            {savings > 0 && (
              <p className="text-sm text-green-600 font-medium">
                {t('product.savingsAmount', { amount: formatPrice(savings, currency, locale) })}
              </p>
            )}
            {selectedVariant?.sku && (
              <p className="text-xs text-gray-400 mt-1">SKU: {selectedVariant.sku}</p>
            )}
          </div>

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

                const label = promo.type === 'PERCENTAGE' ? `${promo.value}% off`
                  : promo.type === 'FIXED_AMOUNT' ? `${formatPrice(promo.value, currency, locale)} off`
                  : promo.type === 'FREE_SHIPPING' ? t('checkout.freeShippingLabel')
                  : promo.type === 'FLASH_SALE' ? `${promo.value}% off`
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
                      {!promoTitle && label && promoDesc && null}
                      {promo.expires_at && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {t('product.endsOn')} {new Date(promo.expires_at).toLocaleDateString()}
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
                      const title = tr?.title || `Buy ${offer.quantity}`;
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
                          className={`relative flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                          }`}
                        >
                          {sticker && (
                            <span className="absolute -top-2 right-3 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
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

          {/* Variant Selector */}
          {variants.length > 0 && (
            <div>
              <VariantSelector
                variants={variants}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
                onSelectionsChange={setOptionSelections}
                inStockText={t('product.inStock')}
                outOfStockText={t('product.outOfStock')}
                optionConfigs={product.variant_option_config}
              />
            </div>
          )}

          {/* Design Selector */}
          {/* Custom Fields */}
          {mappedCustomFields.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} />
                {t('product.customizeYourProduct')}
              </h3>
              <CustomFieldsForm
                fields={mappedCustomFields}
                values={customFieldValues}
                onChange={handleCustomFieldChange}
              />
            </div>
          )}

          {/* Customer Upload */}
          {product.allow_customer_upload && (
            <div>
              <CustomerUpload
                onFileSelect={handleFileSelect}
                accept="image/*"
                maxSizeMB={10}
                label="File Uploads"
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
                    {selectedBundleOffer.translation?.title || `Buy ${selectedBundleOffer.offer.quantity}`}
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
            <div className="flex items-center gap-3 flex-wrap">
              <QuantitySelector
                value={quantity}
                onChange={handleQuantityChange}
                min={bundlePricing?.cartQuantity ?? 1}
                max={maxStock}
                step={bundlePricing?.cartQuantity ?? 1}
              />

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
                      : { backgroundColor: 'var(--store-primary, #2563eb)', color: '#fff' }
                }
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
            </div>

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

          {/* Trust badges */}
          {showTrustBadges && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Truck, label: t('product.trustFreeShipping') },
              { icon: Shield, label: t('product.trustSecurePayment') },
              { icon: RotateCcw, label: t('product.trustEasyReturns') },
              { icon: Star, label: t('product.trustTopQuality') },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--store-primary, #2563eb)' }} />
                <span className="text-xs font-medium text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          )}

          {/* Shipping & Delivery */}
          {showShipping && product.shipping_profile && product.shipping_profile.zones.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" style={{ color: 'var(--store-primary, #2563eb)' }} />
                {t('product.shippingAndDelivery')}
              </h3>
              <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {product.shipping_profile.zones.map((zone) => (
                  <div key={zone.id} className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{zone.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {zone.estimated_days_min}–{zone.estimated_days_max} days
                          {zone.countries.length > 0 && (
                            <span className="text-gray-400">
                              {' '}· {zone.countries.slice(0, 3).join(', ')}
                              {zone.countries.length > 3 && ` +${zone.countries.length - 3}`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatPrice(Number(zone.base_cost), currency, locale)}
                      </p>
                      {zone.free_threshold && (
                        <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1 justify-end">
                          <Package className="w-3 h-3" />
                          Free over {formatPrice(Number(zone.free_threshold), currency, locale)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {showTags && product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map(({ tag }) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 bg-gray-50"
                >
                  {tag}
                </span>
              ))}
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
                        attr.template?.translations?.find((at: any) => at.locale === locale)?.label ||
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

      {/* Floating toast: added to cart */}
      {addedToCart && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">{t('cart.itemAdded')}</span>
        </div>
      )}

      {/* Floating toast: error */}
      {addToCartError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-medium">{addToCartError}</span>
          <button onClick={() => setAddToCartError('')} className="text-white/70 hover:text-white ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}