'use client';

// `product-short-description` block: the product's short summary HTML, as
// the monolith shows it under the price. The HTML is sanitized by the API on
// every write (sanitizeCreatorHtml).

import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export function ProductShortDescriptionBlock({ locale, product, builderPreview }: SectionRenderProps) {
  const state = useOptionalProductPageState();
  const html = state?.translation?.short_description;
  if (!html) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Short description', 'الوصف المختصر')}
        hint={state ? blockLabel(locale, 'This product has no short description.', 'لا يوجد وصف مختصر لهذا المنتج.') : undefined}
      />
    );
  }
  return (
    <ProductBlockScope>
      <div
        className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ProductBlockScope>
  );
}
