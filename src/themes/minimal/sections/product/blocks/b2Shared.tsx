'use client';

// Shared bits of the B2 product blocks (breadcrumb, short description,
// promotions, bundles, personalization, trust, shipping, tabs). Every block
// is a small client island that reads the page's one product state
// (`useOptionalProductPageState`), so all blocks on a PRODUCT_TEMPLATE show
// the same variant, price and choices as the monolith `product-page`.

import type { CSSProperties, ReactNode } from 'react';
import { belowFold, pd, useProductMotion } from '@/components/product/productMotion';

/**
 * Maps the theme's primary token onto the `--store-primary` variable the
 * product markup (copied from ProductDetailClient) reads, exactly like the
 * monolith's ProductPageMagic scope.
 */
export const productBlockScopeStyle = {
  ['--store-primary' as string]: 'var(--theme-colors-primary)',
  ['--store-primary-contrast' as string]: 'var(--theme-colors-primaryContrast, #fff)',
} as CSSProperties;

/**
 * Wrapper carrying the theme colour mapping. With the store motion style on
 * (product motion scope), `reveal` lets a block below the buy box rise when
 * it scrolls into view and `hook` names the block for the product motion
 * stylesheet; both add nothing without it.
 */
export function ProductBlockScope({
  children,
  className,
  reveal = false,
  hook,
}: {
  children: ReactNode;
  className?: string;
  reveal?: boolean;
  hook?: string;
}) {
  const m = useProductMotion();
  return (
    <div
      className={className}
      style={productBlockScopeStyle}
      {...(reveal ? belowFold(m) : null)}
      {...(hook ? pd(m, hook) : null)}
    >
      {children}
    </div>
  );
}

/**
 * Dashed builder placeholder for a block that has nothing to show (no
 * product state, no product, or no data). Rendered only inside the builder
 * preview; on the storefront the block renders nothing instead. Callers pass
 * `builderPreview ?? !product` (same rule as the B1 blocks): a missing
 * product context only happens in the builder before a sample loads, since
 * the storefront product route always passes the product.
 */
export function ProductBlockPlaceholder({
  builderPreview,
  label,
  hint,
}: {
  builderPreview?: boolean;
  label: string;
  hint?: string;
}) {
  if (!builderPreview) return null;
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
      <div className="text-xs uppercase tracking-wide">{label}</div>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}

/** Path prefix for secondary locales; the primary locale stays canonical. */
export function langPrefixFor(locale: string, primaryLocale: string): string {
  return locale && locale !== primaryLocale ? `/${locale}` : '';
}

/** Arabic or English builder label. */
export function blockLabel(locale: string, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}

/**
 * Promotion end date, identical on the server and the client: the storefront
 * locale and a fixed UTC zone (same as ProductDetailClient's formatter).
 */
export function formatPromoDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
