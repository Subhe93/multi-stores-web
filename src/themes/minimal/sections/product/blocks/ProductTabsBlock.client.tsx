'use client';

// `product-tabs` block (existing key, rebuilt on the shared product state):
// description, specifications (typed attribute values), FAQ (answers as
// HTML), and the owner's shipping / returns content. Tab bar and panels use
// the same markup as ProductDetailClient's tabs. Setting names are those of
// the original section, so saved templates keep working; tabs without data
// are left out, like on the monolith.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export type ProductBlockTabId = 'description' | 'specifications' | 'faq' | 'shipping' | 'returns';

type Attribute = NonNullable<ProductData['attributes']>[number];

/** One attribute value, rendered by its template type (same rules as the monolith). */
function AttributeValue({ attr }: { attr: Attribute }) {
  const t = useTranslations();
  const type = attr.template?.type;
  const val = attr.value;
  if (type === 'COLOR' && typeof val === 'string') {
    return (
      <span className="flex items-center gap-2">
        <span
          className="w-4 h-4 border border-gray-200 inline-block"
          style={{ backgroundColor: val, borderRadius: 'var(--theme-swatch-radius, 9999px)' }}
        />
        {val}
      </span>
    );
  }
  if (type === 'BOOLEAN') return <>{val ? t('common.yes') : t('common.no')}</>;
  return <>{formatAttributeText(attr)}</>;
}

/** Text form of a non-colour, non-boolean attribute value. */
export function formatAttributeText(attr: Attribute): string {
  const type = attr.template?.type;
  const val = attr.value;
  const unit = attr.template?.unit;
  if (type === 'DIMENSIONS' && val && typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>).map(([, v]) => `${v}${unit || ''}`).join(' × ');
  }
  if (type === 'MULTI_SELECT' && Array.isArray(val)) return val.join(', ');
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return unit ? `${str} ${unit}` : str;
}

function htmlOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function ProductTabsBlock({ settings, content, locale, product: productContext, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const [active, setActive] = useState<ProductBlockTabId | null>(null);

  if (!state) {
    return <ProductBlockPlaceholder builderPreview={builderPreview ?? !productContext} label={blockLabel(locale, 'Product tabs', 'تبويبات المنتج')} />;
  }
  const { product, translation } = state;
  const lang = state.locale;
  const attributes = product.attributes ?? [];
  const faqs = product.faqs ?? [];
  const shippingHtml = htmlOf(content.shipping_html);
  const returnsHtml = htmlOf(content.returns_html);
  const label = (key: string, fallback: string) => {
    const v = content[key];
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  };

  const tabs: { id: ProductBlockTabId; label: string; count?: number }[] = [];
  if (settings.show_description !== false && translation?.description) {
    tabs.push({ id: 'description', label: label('tab_description_label', t('product.description')) });
  }
  if (settings.show_specifications !== false && attributes.length > 0) {
    tabs.push({ id: 'specifications', label: label('tab_specifications_label', t('product.specifications')) });
  }
  if (settings.show_faqs !== false && faqs.length > 0) {
    tabs.push({ id: 'faq', label: label('tab_faqs_label', t('product.faq')), count: faqs.length });
  }
  if (settings.show_shipping === true && shippingHtml) {
    tabs.push({ id: 'shipping', label: label('tab_shipping_label', lang === 'ar' ? 'الشحن' : 'Shipping') });
  }
  if (settings.show_returns === true && returnsHtml) {
    tabs.push({ id: 'returns', label: label('tab_returns_label', lang === 'ar' ? 'الإرجاع' : 'Returns') });
  }

  if (tabs.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !productContext}
        label={blockLabel(locale, 'Product tabs', 'تبويبات المنتج')}
        hint={blockLabel(locale, 'Nothing to show for this product.', 'لا يوجد محتوى لهذا المنتج.')}
      />
    );
  }
  // First tab with data unless the shopper picked one that still exists.
  const current = active && tabs.some((tb) => tb.id === active) ? active : tabs[0].id;

  return (
    <ProductBlockScope>
      <div className="flex border-b border-gray-200 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={current === tab.id}
            onClick={() => setActive(tab.id)}
            className={`relative shrink-0 whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors ${
              current === tab.id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ms-1.5 text-xs text-gray-400">({tab.count})</span>}
            {current === tab.id && (
              <span className="absolute bottom-0 inset-x-0 h-0.5" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} />
            )}
          </button>
        ))}
      </div>

      <div className="py-6 px-5 bg-white rounded-xl border border-gray-100" role="tabpanel">
        {current === 'description' && translation?.description && (
          <div
            className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: translation.description }}
          />
        )}

        {current === 'specifications' && (
          <div className="rounded-xl border border-gray-200 overflow-x-auto max-w-2xl">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {attributes.map((attr, i) => {
                  const attrLabel =
                    attr.template?.translations?.find((at) => at.locale === lang)?.label ||
                    attr.template?.translations?.[0]?.label ||
                    attr.template?.name;
                  return (
                    <tr key={attr.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-gray-500 font-medium w-2/5 border-b border-gray-100">{attrLabel}</td>
                      <td className="px-4 py-3 text-gray-900 font-semibold border-b border-gray-100 wrap-break-word">
                        <AttributeValue attr={attr} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {current === 'faq' && (
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden max-w-2xl">
            {faqs.map((faq, i) => {
              const faqTrans = faq.translations.find((ft) => ft.locale === lang) || faq.translations[0];
              return (
                <details key={faq.id || i} className="group">
                  <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors list-none">
                    {faqTrans?.question}
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  {/* FAQ answers are HTML sanitized by the API on write (product-faqs service). */}
                  <div
                    className="px-4 pb-4 pt-1 text-sm text-gray-600 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: faqTrans?.answer || '' }}
                  />
                </details>
              );
            })}
          </div>
        )}

        {current === 'shipping' && (
          <div
            className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word"
            dangerouslySetInnerHTML={{ __html: shippingHtml }}
          />
        )}

        {current === 'returns' && (
          <div
            className="prose prose-gray prose-sm max-w-none text-gray-600 leading-relaxed wrap-break-word"
            dangerouslySetInnerHTML={{ __html: returnsHtml }}
          />
        )}
      </div>
    </ProductBlockScope>
  );
}
