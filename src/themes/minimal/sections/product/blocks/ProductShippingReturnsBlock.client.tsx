'use client';

// `product-shipping-returns` block: the owner's shipping and returns texts,
// the standalone form of the shipping / returns panels of `product-tabs`.
// Like there, the texts are this section's own per-locale content
// (`shipping_html`, `returns_html`, rich text written in the builder) and
// are rendered with the same prose classes. A part without text (or turned
// off) is left out; with neither, the block renders nothing.

import { useTranslations } from 'next-intl';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';
import { contentString, headingText, ProductBlockHeading } from './b3Shared';

const PROSE = 'prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word';

export function ProductShippingReturnsBlock({ settings, content, locale, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const shippingHtml = settings?.show_shipping !== false ? contentString(content, 'shipping_html') : '';
  const returnsHtml = settings?.show_returns !== false ? contentString(content, 'returns_html') : '';

  if (!shippingHtml && !returnsHtml) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview}
        label={blockLabel(locale, 'Shipping & returns', 'الشحن والإرجاع')}
        hint={blockLabel(
          locale,
          'Write the shipping and returns texts in this block’s settings.',
          'اكتب نصّي الشحن والإرجاع في إعدادات هذا القسم.',
        )}
      />
    );
  }
  const showHeadings = settings?.show_heading !== false;
  const parts = [
    { id: 'shipping', html: shippingHtml, heading: headingText(content, 'shipping_heading', t('product.shippingHeading')) },
    { id: 'returns', html: returnsHtml, heading: headingText(content, 'returns_heading', t('product.returnsHeading')) },
  ].filter((p) => p.html);

  return (
    <ProductBlockScope className="flex flex-col gap-6">
      {parts.map((part) => (
        <div key={part.id} data-shipping-returns-part={part.id}>
          {showHeadings && <ProductBlockHeading level={settings?.heading_level}>{part.heading}</ProductBlockHeading>}
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: part.html }} />
        </div>
      ))}
    </ProductBlockScope>
  );
}
