'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
}

interface ProductDetailClientProps {
  product: ProductData;
  locale?: string;
  currency?: string;
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
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
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

export function ProductDetailClient({ product, locale = 'en', currency = 'EUR' }: ProductDetailClientProps) {
  const t = useTranslations();
  const { addItem } = useCart();
  const variants = product.variants || [];

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
    const baseImages = (product.images || []).map((img, i) => ({
      id: img.id || `img-${i}`,
      url: resolveMediaUrl(img.url),
      alt: img.alt || img.alt_text || translation?.title || '',
    }));

    if (selectedVariant?.images?.length) {
      const variantImgs = selectedVariant.images.map((img, i) => ({
        id: `variant-${selectedVariant.id}-${i}`,
        url: resolveMediaUrl(img.url),
        alt: translation?.title || '',
      }));
      const variantUrls = new Set(variantImgs.map((i) => i.url));
      const filteredBase = baseImages.filter((i) => !variantUrls.has(i.url));
      return [...variantImgs, ...filteredBase];
    }

    return baseImages;
  }, [product.images, selectedVariant, translation]);

  useEffect(() => {
    if (selectedVariant?.images?.length) {
      setActiveGalleryIndex(0);
    }
  }, [selectedVariantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPrice = useMemo(() => {
    return selectedVariant ? Number(selectedVariant.price) : Number(product.base_price);
  }, [selectedVariant, product.base_price]);

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
    customerFile, addItem,
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

  const savings = comparePrice && comparePrice > currentPrice ? comparePrice - currentPrice : 0;

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

          {/* Category */}
          {product.category && (
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--store-primary, #2563eb)' }}>
              {product.category.translations?.find((ct) => ct.locale === locale)?.name
                || product.category.translations?.[0]?.name}
            </p>
          )}

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            {translation?.title}
          </h1>

          {/* Price + Savings */}
          <div className="flex flex-col gap-1">
            <PriceDisplay price={currentPrice} comparePrice={comparePrice} currency={currency} locale={locale} />
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

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Variant Selector */}
          {variants.length > 0 && (
            <div>
              <VariantSelector
                variants={variants}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
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
            <div className="flex items-center gap-3">
              <QuantitySelector value={quantity} onChange={setQuantity} min={1} max={maxStock} />

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAddDisabled || addingToCart}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                  addedToCart
                    ? 'bg-green-600 text-white scale-[1.02]'
                    : isAddDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : addingToCart
                        ? 'text-white opacity-80'
                        : 'text-white hover:opacity-90 hover:shadow-lg active:scale-[0.98]'
                }`}
                style={
                  !addedToCart && !isAddDisabled
                    ? { backgroundColor: 'var(--store-primary, #2563eb)' }
                    : undefined
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

          {/* Shipping & Delivery */}
          {product.shipping_profile && product.shipping_profile.zones.length > 0 && (
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
          {product.tags && product.tags.length > 0 && (
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
      {tabList.length > 0 && (
        <div className="mt-12 lg:mt-16">
          <ProductTabs tabs={tabList} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="py-6 px-5 bg-white rounded-xl border border-gray-100">
            {/* Description tab */}
            {activeTab === 'description' && translation?.description && (
              <div
                className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: translation.description }}
              />
            )}

            {/* Specifications tab */}
            {activeTab === 'specifications' && product.attributes && product.attributes.length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden max-w-2xl">
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
                          <td className="px-4 py-3 text-gray-900 font-semibold border-b border-gray-100">
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