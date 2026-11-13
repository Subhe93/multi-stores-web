'use client';

// product-title block: primary collection link, H1 and the marketplace
// vendor line, with ProductDetailClient's markup.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  collectionDisplayName,
  collectionHref,
  collectionPathInChain,
  resolvePrimaryCollectionPath,
} from '@/lib/collectionPath';
import type { SectionRenderProps } from '../../../../types';
import { B1Placeholder, B1Scope, b1LangPrefix, isBlockPreview, useBlockState } from './b1Shared';

export function ProductTitleBlock(props: SectionRenderProps) {
  const { settings, locale, primaryLocale } = props;
  const t = useTranslations();
  const state = useBlockState(props);
  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Product title', ar: 'عنوان المنتج' }} />;
  }
  const { product, translation } = state;
  const showCollection = settings.show_collection !== false;
  const showVendor = settings.show_vendor !== false;
  const langPrefix = b1LangPrefix(locale, primaryLocale);

  // Primary collection = leaf of `primary_collection_path` (M6 §2); older
  // payloads fall back to the first linked collection.
  const path = showCollection ? resolvePrimaryCollectionPath(product) : [];
  const collection = path[path.length - 1];

  return (
    <B1Scope className="flex flex-col gap-5 min-w-0">
      {collection && (
        <Link
          href={`${langPrefix}${collectionHref({ path: collectionPathInChain(path, path.length - 1), slug: collection.slug })}`}
          className="text-xs font-medium uppercase tracking-widest hover:underline w-fit"
          style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
        >
          {collectionDisplayName(collection, locale)}
        </Link>
      )}
      <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
        {translation?.title}
      </h1>
      {showVendor && product.vendor?.company_name && (
        <p className="-mt-3 text-sm text-gray-500">
          {t('product.soldBy', { name: product.vendor.company_name })}
        </p>
      )}
    </B1Scope>
  );
}
