'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePersonalizationApp } from '@/components/product/personalization/usePersonalizationApp';
import { pieceOneOptionKeys, pieceOneRepeater } from '@/components/product/personalization/model';
import { focusPersonalizationField } from '@/components/product/usePersonalizationFields';
import { useAddToCartLine } from '@/components/product/useAddToCartLine';
import type { POptionConfig } from '@multi-stores/core/personalization/types';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { DesignedLine } from '@/components/designer/DesignerInline';
import { resolveMediaUrl } from '@/lib/api';
import type { LineSource } from '@/lib/cartLine';
import { uploadCustomerFile, UPLOAD_RATE_LIMITED } from '@/lib/customerUpload';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { useApiError } from '@/lib/useApiError';
import { computeBundlePricing } from '@/lib/bundle';

// ── Shared product page state ─────────────────────────────
//
// One source of truth for everything a product page knows about the
// shopper's choices: selected variant and option picks, quantity, bundle
// offer, personalization (one `usePersonalizationApp` call), customer upload,
// the gallery order, the full price chain, stock, add-to-cart and its
// toasts, and the active tab. `ProductDetailClient` (the monolith
// `product-page` section and the fallback product route) reads it, and so
// will the separate product blocks of a PRODUCT_TEMPLATE, so every block on
// one page shows the same variant, price and gallery.

export type ProductTabId = 'description' | 'specifications' | 'faq';

export interface ProductGalleryImage {
  id: string;
  url: string;
  alt: string;
}

type Variant = NonNullable<ProductData['variants']>[number];
type Bundle = NonNullable<ProductData['bundles']>[number];
type BundleOffer = Bundle['offers'][number];

export interface SelectedBundleOffer {
  bundle: Bundle;
  offer: BundleOffer;
  translation: BundleOffer['translations'][number] | undefined;
}

export interface ProductPageStateProviderProps {
  product: ProductData;
  locale?: string;
  /** Store primary locale; the fallback when `locale` has no translation. */
  primaryLocale?: string;
  currency?: string;
  children?: ReactNode;
}

function useProductPageStateValue({
  product,
  locale = 'en',
  primaryLocale = 'en',
  currency = 'EUR',
}: Omit<ProductPageStateProviderProps, 'children'>) {
  const t = useTranslations();
  const apiError = useApiError();
  // Shared add-to-cart (M5 D31): same line metadata as the theme section,
  // "added" confirmation with its timer cleared on unmount (D28).
  const { addLine, addDesignLine, justAdded: addedToCart, markAdded } = useAddToCartLine();
  const variants = useMemo(() => product.variants || [], [product.variants]);
  const variantOptionKeys = useMemo(
    () => Array.from(new Set(variants.flatMap((v) => Object.keys(v.options || {})))),
    [variants],
  );

  // ── State ─────────────────────────────────────────────
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    variants.length === 1 ? variants[0].id : undefined,
  );
  const [quantity, setQuantity] = useState(1);
  // Partial option picks (e.g. color chosen, size pending) — drives the
  // gallery via value-level images before a full variant is resolved. The
  // selector is controlled by this state (M5 D11): a URL prefill or the
  // designer's review-step picker updates it without remounting anything.
  // A single variant is auto-selected, so its options start picked.
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>(() =>
    variants.length === 1 ? { ...(variants[0].options || {}) } : {},
  );

  const selectedVariantForApp = variants.find((v) => v.id === selectedVariantId) ?? null;
  const taxRateBp = product.tax_rate_bp ?? null;

  // Personalization app (M4.1): gate, evaluator form, variation cards, URL
  // prefill and price delta (shared with the theme's AddToCartMagic). Off =
  // the M4.0 page, unchanged. Custom fields: values (creator-filled ones
  // pre-set and hidden), the shared validator and the cart payload (M4.0 §2.2).
  const app = usePersonalizationApp({
    product,
    personalization: product.personalization,
    optionConfig: product.variant_option_config as POptionConfig[] | undefined,
    variants,
    variantOptions: selectedVariantForApp?.options,
    optionSelections,
    locale,
    primaryLocale,
    currency,
    taxRateBp,
    onPrefillOptions: (picks, variantId) => {
      setOptionSelections(picks);
      setSelectedVariantId(variantId);
    },
  });
  const { appSettings, market, storeSlug, advanced, cardsConfig } = app;
  // Multi-piece products: the product option the repeater's colour palettes
  // read from is piece 1's colour and renders inside the piece-1 box.
  const pieceRepeater = advanced ? pieceOneRepeater(advanced.defs, advanced.result.visibleIds, advanced.ctx, 'after_variants') : null;
  const pieceOptionKeys = useMemo(
    () => (advanced && pieceRepeater ? pieceOneOptionKeys(advanced.defs, pieceRepeater) : []),
    [advanced, pieceRepeater],
  );
  const personalization = app.fields;
  const { validateAll, buildPayload, applyServerError } = personalization;
  // Legacy "customer upload" block (M5 D17): the file goes to
  // `POST /uploads/customer` and the returned preview URL is the line value.
  const [customerFileUrl, setCustomerFileUrl] = useState<string | null>(null);
  const [customerFileUploading, setCustomerFileUploading] = useState(false);
  const [customerFileError, setCustomerFileError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState('');
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductTabId>('description');
  const [selectedBundleOfferId, setSelectedBundleOfferId] = useState<string | null>(null);

  // ── Memos ─────────────────────────────────────────────

  const translation = useMemo(() => {
    if (!product.translations?.length) return null;
    return (
      product.translations.find((t) => t.locale === locale) || product.translations[0]
    );
  }, [product.translations, locale]);

  const selectedVariant = useMemo<Variant | null>(() => {
    if (!selectedVariantId) return null;
    return variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [selectedVariantId, variants]);

  const galleryImages = useMemo<ProductGalleryImage[]>(() => {
    const alt = translation?.title || '';
    // Priority: variant-specific images (per-combination override), then
    // value-level images of the currently picked options (Shopify-style: one
    // image per color, shared by every size), then the product gallery.
    const prioritized: ProductGalleryImage[] = [];

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

  // Personalization app: the per-unit modifier (0 when it is not shown).
  const personalizationDelta = app.priceDelta;
  const baseUnitPrice = useMemo(() => {
    return (selectedVariant ? Number(selectedVariant.price) : Number(product.base_price)) + personalizationDelta;
  }, [selectedVariant, product.base_price, personalizationDelta]);
  // b2b app: company view shows net amounts (variants inherit the product rate).
  const display = useDisplayPrice();

  const selectedBundleOffer = useMemo<SelectedBundleOffer | null>(() => {
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

  // Owner preview of a DRAFT product: nothing can be added (the API would
  // refuse the quote / order anyway).
  const isDraftPreview = product.status === 'DRAFT';
  const needsVariantSelection = variants.length > 0 && !selectedVariantId;
  const isOutOfStock = Boolean(selectedVariant && selectedVariant.stock <= 0);
  const isAddDisabled = useMemo(() => {
    if (isDraftPreview) return true;
    if (variants.length > 0 && !selectedVariantId) return true;
    if (selectedVariant && selectedVariant.stock <= 0) return true;
    return false;
  }, [isDraftPreview, variants, selectedVariantId, selectedVariant]);

  // ── Handlers ──────────────────────────────────────────

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

  const handleFileSelect = useCallback(async (file: File) => {
    setCustomerFileUploading(true);
    setCustomerFileError('');
    const res = await uploadCustomerFile(file);
    setCustomerFileUploading(false);
    if ('url' in res) {
      setCustomerFileUrl(res.url);
    } else {
      setCustomerFileUrl(null);
      setCustomerFileError(
        res.error === UPLOAD_RATE_LIMITED ? t('product.uploadTooManyRequests') : apiError({ code: res.error }),
      );
    }
  }, [t, apiError]);

  const handleFileRemove = useCallback(() => {
    setCustomerFileUrl(null);
    setCustomerFileError('');
  }, []);

  const [customFieldError, setCustomFieldError] = useState('');

  // What both add paths (fields / design) know about the line (M5 D31).
  const lineSource = useMemo<LineSource>(
    () => ({
      title: translation?.title || 'Product',
      unitPrice: currentPrice,
      imageUrl: galleryImages[0]?.url || resolveMediaUrl(product.images?.[0]?.url),
      variantOptions: selectedVariant?.options ?? null,
      customProductId: product._type === 'custom_product' ? product.id : undefined,
      // b2b stores: keep the estimated rate on guest lines (L8).
      taxRateBp,
      bundle: selectedBundleOffer
        ? {
            offerId: selectedBundleOffer.offer.id,
            originalUnitPrice: baseUnitPrice,
            title: selectedBundleOffer.translation?.title,
            label: selectedBundleOffer.translation?.label,
            stickerText: selectedBundleOffer.translation?.sticker_text,
            cartQuantity: bundlePricing?.cartQuantity,
          }
        : null,
      customerFile: customerFileUrl ?? undefined,
    }),
    [translation, currentPrice, galleryImages, product.images, product._type, product.id, selectedVariant, taxRateBp, selectedBundleOffer, baseUnitPrice, bundlePricing, customerFileUrl],
  );

  const handleAddToCart = useCallback(async () => {
    if (addingToCart || isAddDisabled || customerFileUploading) return;
    setCustomFieldError('');

    // Same rules as the API (shared validator): show every field error inline.
    const check = validateAll();
    if (!check.ok) {
      setCustomFieldError(check.firstError || t('product.requiredFieldsMissing'));
      // Move to the first field with an error (M5 D20).
      if (check.fieldId) focusPersonalizationField(check.fieldId);
      return;
    }

    setAddingToCart(true);
    setAddToCartError('');

    // Keep field IDs as keys so order creation can match them to custom_field_id;
    // display lines are captured in the current locale for guest carts.
    const { fields, display: customFieldDisplay } = buildPayload();

    try {
      await addLine({ productId: product.id, variantId: selectedVariantId || null, quantity, source: lineSource }, fields, {
        customFieldDisplay,
        // Personalization app (D14): guests validate on the server first and
        // keep its values, unit price and display lines.
        ...(advanced && storeSlug
          ? {
              personalizationCheck: {
                storeSlug,
                locale,
                market: market?.key ?? null,
                linePrice: (unit: number) =>
                  selectedBundleOffer
                    ? computeBundlePricing(unit, {
                        quantity: selectedBundleOffer.offer.quantity,
                        discount_type: selectedBundleOffer.offer.discount_type,
                        discount_value: selectedBundleOffer.offer.discount_value,
                      }).effectiveUnitPrice
                    : unit,
              },
            }
          : {}),
      });
    } catch (err) {
      // Field rule errors (K2) also show inline on their field.
      const fieldMessage = applyServerError(err);
      if (fieldMessage) {
        setCustomFieldError(fieldMessage);
        const fieldId = (err as { field_id?: unknown } | null)?.field_id;
        if (typeof fieldId === 'string') focusPersonalizationField(fieldId);
      }
      // Coded API errors (e.g. CART_ITEM_NOT_AVAILABLE_IN_MARKET) are translated.
      setAddToCartError(fieldMessage || ((err as { code?: string })?.code ? apiError(err) : err instanceof Error ? err.message : t('common.error')));
    } finally {
      setAddingToCart(false);
    }
  }, [
    addingToCart, isAddDisabled, customerFileUploading, product.id, selectedVariantId, quantity, lineSource,
    validateAll, buildPayload, applyServerError, addLine, selectedBundleOffer,
    apiError, t, advanced, storeSlug, locale, market]);

  // Designer app (M4.2): the approved design is the line (no field values).
  const designerBlockedReason = isAddDisabled
    ? variants.length > 0 && !selectedVariantId
      ? t('product.selectOptions')
      : t('product.outOfStock')
    : null;

  const handleDesignerAdd = useCallback(
    (line: DesignedLine) =>
      addDesignLine({ productId: product.id, variantId: selectedVariantId || null, quantity, source: lineSource }, line),
    [addDesignLine, product.id, selectedVariantId, quantity, lineSource],
  );

  const handleDesignerDone = useCallback((kind: 'added' | 'saved') => {
    if (kind === 'added') markAdded();
  }, [markAdded]);

  // Tab data
  const tabList = useMemo(() => {
    const tabs: { id: ProductTabId; label: string; count?: number }[] = [];
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

  return {
    // Inputs
    product,
    locale,
    primaryLocale,
    currency,
    taxRateBp,
    translation,
    // Variants and options
    variants,
    variantOptionKeys,
    selectedVariantId,
    setSelectedVariantId,
    selectedVariant,
    optionSelections,
    setOptionSelections,
    sku: selectedVariant?.sku ?? null,
    // Personalization app and custom fields
    app,
    appSettings,
    market,
    storeSlug,
    advanced,
    cardsConfig,
    pieceRepeater,
    pieceOptionKeys,
    personalization,
    customFieldError,
    setCustomFieldError,
    // Customer upload
    customerFileUrl,
    customerFileUploading,
    customerFileError,
    handleFileSelect,
    handleFileRemove,
    // Gallery
    galleryImages,
    leadImageUrl,
    activeGalleryIndex,
    setActiveGalleryIndex,
    // Price chain
    personalizationDelta,
    baseUnitPrice,
    display,
    currentPrice,
    comparePrice,
    displayPrice,
    displayComparePrice,
    savings,
    // Bundles
    selectedBundleOfferId,
    setSelectedBundleOfferId,
    selectedBundleOffer,
    bundlePricing,
    handleSelectBundle,
    // Quantity and stock
    quantity,
    setQuantity,
    handleQuantityChange,
    maxStock,
    quantityMin: bundlePricing?.cartQuantity ?? 1,
    quantityStep: bundlePricing?.cartQuantity ?? 1,
    isDraftPreview,
    needsVariantSelection,
    isOutOfStock,
    isAddDisabled,
    // Add to cart and toasts
    lineSource,
    addingToCart,
    addToCartError,
    setAddToCartError,
    addedToCart,
    markAdded,
    handleAddToCart,
    designerBlockedReason,
    handleDesignerAdd,
    handleDesignerDone,
    // Tabs
    tabList,
    activeTab,
    setActiveTab,
  };
}

export type ProductPageState = ReturnType<typeof useProductPageStateValue>;

const ProductPageStateContext = createContext<ProductPageState | null>(null);

function ProductPageStateHost({ children, ...input }: ProductPageStateProviderProps) {
  const value = useProductPageStateValue(input);
  return <ProductPageStateContext.Provider value={value}>{children}</ProductPageStateContext.Provider>;
}

/**
 * Owns the product page state for one product. Nested providers for the same
 * product reuse the outer state (like `DesignerSessionProvider`): the
 * PRODUCT_TEMPLATE route mounts one around the whole template, and the
 * `product-page` section's `ProductDetailClient` inside it then shares that
 * state instead of starting a second one. The state is keyed by product id,
 * so another product starts fresh.
 */
export function ProductPageStateProvider({ children, ...input }: ProductPageStateProviderProps) {
  const outer = useContext(ProductPageStateContext);
  if (outer && outer.product.id === input.product.id) return <>{children}</>;
  return (
    <ProductPageStateHost key={input.product.id} {...input}>
      {children}
    </ProductPageStateHost>
  );
}

/** The product page state; throws outside a `ProductPageStateProvider`. */
export function useProductPageState(): ProductPageState {
  const value = useContext(ProductPageStateContext);
  if (!value) throw new Error('useProductPageState: no ProductPageStateProvider');
  return value;
}

/** The product page state, or null outside a `ProductPageStateProvider`. */
export function useOptionalProductPageState(): ProductPageState | null {
  return useContext(ProductPageStateContext);
}
