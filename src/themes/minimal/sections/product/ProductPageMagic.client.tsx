'use client';

// Component implementation. Definition lives in ProductPageMagic.tsx.
//
// This is the full-fidelity product body: it renders the exact same
// ProductDetailClient used by the standalone product route, so the builder's
// published PRODUCT_TEMPLATE matches the non-builder design 1:1 — bundles,
// variants, custom fields, promotions, shipping, tabs and all. The creator's
// simple show/hide toggles map straight onto ProductDetailClient's options.

import type { CSSProperties } from 'react';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import type { SectionRenderProps } from '../../../types';

type ProductInput = React.ComponentProps<typeof ProductDetailClient>['product'];

export function ProductPageMagic({ settings, locale, primaryLocale, product, currency }: SectionRenderProps) {
  // No product in context (e.g. builder preview before a sample loads) — show a
  // recognisable placeholder rather than crashing.
  if (!product) {
    return (
      <div
        className="text-center py-16 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
        }}
      >
        <div className="text-xs uppercase tracking-wide">
          {locale === 'ar' ? 'صفحة المنتج' : 'Product page'}
        </div>
        <p className="text-sm mt-2">
          {locale === 'ar'
            ? 'تظهر هنا تفاصيل المنتج (الصور، السعر، الباندلز، الخيارات، الشحن…).'
            : 'Product details render here (gallery, price, bundles, options, shipping…).'}
        </p>
      </div>
    );
  }

  // Secondary locales get a path prefix; primary stays canonical — matches the
  // convention used by the other storefront sections.
  const langPrefix = locale && locale !== primaryLocale ? `/${locale}` : '';

  // Map the theme's primary token onto the --store-primary variable that
  // ProductDetailClient reads, so the page adopts the active theme color.
  const scopeStyle = { ['--store-primary' as string]: 'var(--theme-colors-primary)' } as CSSProperties;

  // Horizontal container + max-width come from the theme Layout (like every
  // other section), so only vertical breathing room is added here.
  return (
    <section className="py-8 lg:py-10" style={scopeStyle}>
      <ProductDetailClient
        product={product as unknown as ProductInput}
        locale={locale}
        currency={currency}
        langPrefix={langPrefix}
        options={{
          showTrustBadges: settings.show_trust_badges !== false,
          showShipping: settings.show_shipping !== false,
          showTabs: settings.show_tabs !== false,
          showTags: settings.show_tags !== false,
          buttonStyle: (settings.button_style as 'solid' | 'outline') || 'solid',
        }}
      />
    </section>
  );
}
