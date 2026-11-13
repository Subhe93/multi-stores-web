'use client';

// `product-specifications` block: the product's typed attribute values. The
// default `striped` style is the exact table of the specifications panel of
// `product-tabs` (same value rendering via its AttributeValue); `table`
// drops the zebra rows and `list` shows a stacked label / value list.

import { useTranslations } from 'next-intl';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { attrLabel } from '@/lib/productSpecs';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';
import { headingText, ProductBlockHeading } from './b3Shared';
import { AttributeValue } from './ProductTabsBlock.client';

export type SpecificationsStyle = 'striped' | 'table' | 'list';

export function specificationsStyle(value: unknown): SpecificationsStyle {
  return value === 'table' || value === 'list' ? value : 'striped';
}

export function ProductSpecificationsBlock({ settings, content, locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const attributes = state?.product.attributes ?? [];
  if (!state || attributes.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Specifications', 'المواصفات')}
        hint={state ? blockLabel(locale, 'This product has no specifications.', 'لا توجد مواصفات لهذا المنتج.') : undefined}
      />
    );
  }
  const lang = state.locale;
  const style = specificationsStyle(settings?.style);
  const showHeading = settings?.show_heading !== false;

  return (
    <ProductBlockScope>
      {showHeading && (
        <ProductBlockHeading level={settings?.heading_level}>
          {headingText(content, 'heading', t('product.specifications'))}
        </ProductBlockHeading>
      )}
      {style === 'list' ? (
        <dl className="divide-y divide-gray-100 max-w-2xl" data-spec-style="list">
          {attributes.map((attr) => (
            <div key={attr.id} className="py-3">
              <dt className="text-xs text-gray-500 font-medium">{attrLabel(attr, lang)}</dt>
              <dd className="mt-0.5 text-sm text-gray-900 font-semibold wrap-break-word">
                <AttributeValue attr={attr} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-x-auto max-w-2xl" data-spec-style={style}>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {attributes.map((attr, i) => (
                <tr key={attr.id} className={style === 'table' || i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-gray-500 font-medium w-2/5 border-b border-gray-100">{attrLabel(attr, lang)}</td>
                  <td className="px-4 py-3 text-gray-900 font-semibold border-b border-gray-100 wrap-break-word">
                    <AttributeValue attr={attr} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProductBlockScope>
  );
}
