'use client';

// `product-description` block: the product's full description HTML, the
// same source (current-locale translation) and prose classes as the
// description panel of `product-tabs`. The HTML is sanitized by the API on
// every write (sanitizeCreatorHtml). Optional heading (default: the
// storefront's "Description" word in the page locale).

import { useTranslations } from 'next-intl';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';
import { headingText, PRODUCT_PROSE_CLASS, ProductBlockHeading } from './b3Shared';

export function ProductDescriptionBlock({ settings, content, locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const html = state?.translation?.description;
  if (!html) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Product description', 'وصف المنتج')}
        hint={state ? blockLabel(locale, 'This product has no description.', 'لا يوجد وصف لهذا المنتج.') : undefined}
      />
    );
  }
  const showHeading = settings?.show_heading !== false;
  return (
    <ProductBlockScope>
      {showHeading && (
        <ProductBlockHeading level={settings?.heading_level}>
          {headingText(content, 'heading', t('product.description'))}
        </ProductBlockHeading>
      )}
      <div className={PRODUCT_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: html }} />
    </ProductBlockScope>
  );
}
