'use client';

// `product-breadcrumb` block: Home › ancestors… › primary collection ›
// product. Same markup as the breadcrumb ProductPageMagic renders above the
// monolith (no primary collection → Home › Products › product).

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { collectionDisplayName, collectionHref, collectionPathInChain, resolvePrimaryCollectionPath } from '@/lib/collectionPath';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, langPrefixFor, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export function ProductBreadcrumbBlock({ settings, locale, product: productContext, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  if (!state) {
    return <ProductBlockPlaceholder builderPreview={builderPreview ?? !productContext} label={blockLabel(locale, 'Breadcrumb', 'مسار التنقل')} />;
  }
  const { product, translation } = state;
  const langPrefix = langPrefixFor(state.locale, state.primaryLocale);
  const showCurrent = settings.show_current !== false;
  const productTitle = translation?.title || 'Product';
  const primaryChain = resolvePrimaryCollectionPath(product);
  const collectionCrumbs = primaryChain.map((node, i) => ({
    slug: node.slug,
    name: collectionDisplayName(node, state.locale),
    href: collectionHref({ path: collectionPathInChain(primaryChain, i), slug: node.slug }),
  }));
  // Separator points along the reading direction (RTL for Arabic).
  const Crumb = state.locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <ProductBlockScope>
      <nav className="flex items-center flex-wrap gap-1 text-sm" aria-label="Breadcrumb">
        <Link href={`${langPrefix}/`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.home')}
        </Link>
        {collectionCrumbs.length > 0 ? (
          collectionCrumbs.map((c) => (
            <span key={c.slug} className="contents">
              <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              <Link href={`${langPrefix}${c.href}`} className="text-gray-400 hover:text-gray-700 transition-colors">
                {c.name}
              </Link>
            </span>
          ))
        ) : (
          <>
            <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link href={`${langPrefix}/products`} className="text-gray-400 hover:text-gray-700 transition-colors">
              {t('common.products')}
            </Link>
          </>
        )}
        {showCurrent && (
          <>
            <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-gray-700 font-medium truncate max-w-50">{productTitle}</span>
          </>
        )}
      </nav>
    </ProductBlockScope>
  );
}
