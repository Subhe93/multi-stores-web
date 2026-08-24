'use client';

// Component implementation. Definition lives in ProductPageMagic.tsx.
//
// This is the full-fidelity product body: it renders the exact same
// ProductDetailClient used by the standalone product route, so the builder's
// published PRODUCT_TEMPLATE matches the non-builder design 1:1 — bundles,
// variants, custom fields, promotions, shipping, tabs and all. The creator's
// simple show/hide toggles map straight onto ProductDetailClient's options.

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import type { SectionRenderProps } from '../../../types';

type ProductInput = React.ComponentProps<typeof ProductDetailClient>['product'];

export function ProductPageMagic({ settings, locale, primaryLocale, product, currency }: SectionRenderProps) {
  const t = useTranslations();
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

  // Breadcrumb data — mirrors the standalone product route, which renders the
  // breadcrumb in its page wrapper (outside ProductDetailClient). The builder
  // template has no such wrapper, so the section renders it here.
  const p = product as unknown as ProductInput;
  const productTitle =
    p.translations?.find((tr) => tr.locale === locale)?.title ||
    p.translations?.[0]?.title ||
    'Product';
  const primaryCollection = p.creator_categories?.[0];
  const collectionName = primaryCollection
    ? primaryCollection.translations?.find((ct) => ct.locale === locale)?.name ||
      primaryCollection.translations?.find((ct) => ct.locale === 'en')?.name ||
      primaryCollection.translations?.[0]?.name ||
      primaryCollection.slug
    : '';

  // Horizontal container + max-width come from the theme Layout (like every
  // other section), so only vertical breathing room is added here.
  return (
    <section className="py-8 lg:py-10" style={scopeStyle}>
      {/* Breadcrumb */}
      <nav className="mb-6 lg:mb-8 flex items-center flex-wrap gap-1 text-sm" aria-label="Breadcrumb">
        <Link href={`${langPrefix}/`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.home')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <Link href={`${langPrefix}/products`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.products')}
        </Link>
        {primaryCollection && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link
              href={`${langPrefix}/collections/${primaryCollection.slug}`}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {collectionName}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="text-gray-700 font-medium truncate max-w-50">{productTitle}</span>
      </nav>

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
          galleryAspect: (settings.gallery_aspect as 'square' | 'portrait' | 'landscape') || 'square',
        }}
      />
    </section>
  );
}
