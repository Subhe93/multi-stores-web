'use client';

// Shared bits of the B1 product blocks (title, price, variants, buy) and of
// the rebuilt split sections (product-gallery, product-details,
// add-to-cart). Every block is a small client island reading the page's one
// product state (`useOptionalProductPageState`), so all blocks of a
// PRODUCT_TEMPLATE follow the same variant, price, quantity and gallery as
// the monolith `product-page` (ProductDetailClient).

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Tag, X } from 'lucide-react';
import { VariantSelector } from '@/components/product/VariantSelector';
import {
  useOptionalProductPageState,
  type ProductPageState,
} from '@/components/product/state/ProductPageState';
import type { SectionRenderProps } from '../../../../types';

/**
 * Maps the theme's primary token onto the `--store-primary` variable that
 * the markup copied from ProductDetailClient reads (same mapping as the
 * monolith's ProductPageMagic scope).
 */
export const B1_SCOPE_STYLE = {
  ['--store-primary' as string]: 'var(--theme-colors-primary)',
  ['--store-primary-contrast' as string]: 'var(--theme-colors-primaryContrast, #fff)',
} as CSSProperties;

/** Path prefix for secondary locales; the primary locale stays canonical. */
export function b1LangPrefix(locale: string, primaryLocale: string): string {
  return locale && locale !== primaryLocale ? `/${locale}` : '';
}

/**
 * Whether the block renders inside the builder preview. SectionRenderer
 * passes an explicit `builderPreview` to product blocks; when it is missing
 * (a direct render), a block without a product in context is treated as the
 * builder before a sample product loads.
 */
export function isBlockPreview(props: Pick<SectionRenderProps, 'builderPreview' | 'product'>): boolean {
  return props.builderPreview ?? !props.product;
}

/**
 * The page's product state for a block, or null when the block has nothing
 * to read (outside a provider, or no product in context).
 */
export function useBlockState(props: Pick<SectionRenderProps, 'product'>): ProductPageState | null {
  const state = useOptionalProductPageState();
  if (!state || !props.product) return null;
  return state;
}

/**
 * Dashed placeholder for a block without product state: shown only in the
 * builder preview; on the storefront the block renders nothing.
 */
export function B1Placeholder({
  preview,
  locale,
  label,
}: {
  preview: boolean;
  locale: string;
  label: { en: string; ar: string };
}) {
  if (!preview) return null;
  const ar = locale === 'ar';
  return (
    <div
      className="text-center py-6 px-4"
      data-product-block-placeholder=""
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px dashed var(--theme-colors-border)',
        borderRadius: 'var(--theme-radius-md)',
        color: 'var(--theme-colors-muted)',
      }}
    >
      <div className="text-xs uppercase tracking-wide">{ar ? label.ar : label.en}</div>
      <p className="text-xs mt-1">
        {ar ? 'اختر منتجاً تجريبياً للمعاينة.' : 'Pick a sample product to preview.'}
      </p>
    </div>
  );
}

/** Scope wrapper carrying the theme colour mapping. */
export function B1Scope({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} style={B1_SCOPE_STYLE}>
      {children}
    </div>
  );
}

/**
 * The variant picker exactly as ProductDetailClient renders it. `pieceOne`
 * renders only the options of piece 1 of a multi-piece personalization
 * (placed inside the piece-1 box); otherwise those options are left out.
 */
export function StateVariantSelector({ state, pieceOne = false }: { state: ProductPageState; pieceOne?: boolean }) {
  const t = useTranslations();
  const { pieceOptionKeys } = state;
  return (
    <VariantSelector
      selections={state.optionSelections}
      personalization={state.cardsConfig}
      variants={state.variants}
      selectedVariantId={state.selectedVariantId}
      onSelect={state.setSelectedVariantId}
      onSelectionsChange={state.setOptionSelections}
      inStockText={t('product.inStock')}
      outOfStockText={t('product.outOfStock')}
      optionConfigs={state.product.variant_option_config}
      optionFilter={
        pieceOne
          ? (k) => pieceOptionKeys.includes(k)
          : pieceOptionKeys.length > 0
            ? (k) => !pieceOptionKeys.includes(k)
            : undefined
      }
      {...(pieceOne ? { showStatus: false } : {})}
    />
  );
}

/** Whether the main (non piece-1) variant picker has any option to show. */
export function hasMainVariantOptions(state: ProductPageState): boolean {
  return (
    state.variants.length > 0 &&
    state.variantOptionKeys.some((k) => !state.pieceOptionKeys.includes(k))
  );
}

/**
 * Floating "added" and error toasts of ProductDetailClient (M5 D5): the
 * added toast links to the cart, the error toast can be closed.
 */
export function ProductToasts({ state, langPrefix }: { state: ProductPageState; langPrefix: string }) {
  const t = useTranslations();
  return (
    <>
      {state.addedToCart && (
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
      {state.addToCartError && (
        <div role="alert" className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-50 flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-medium">{state.addToCartError}</span>
          <button onClick={() => state.setAddToCartError('')} aria-label={t('common.close')} className="size-11 -me-3 flex items-center justify-center text-white/70 hover:text-white ms-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

/** The selected bundle offer with a way to drop it (monolith markup). */
export function BundleChip({ state }: { state: ProductPageState }) {
  const t = useTranslations();
  const { selectedBundleOffer } = state;
  if (!selectedBundleOffer) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-xs font-medium text-blue-900 truncate">
          {selectedBundleOffer.translation?.title || t('product.buyQuantity', { count: selectedBundleOffer.offer.quantity })}
        </span>
      </div>
      <button
        type="button"
        onClick={() => state.setSelectedBundleOfferId(null)}
        className="text-xs text-blue-700 hover:text-blue-900 underline shrink-0"
      >
        {t('cart.remove')}
      </button>
    </div>
  );
}
