// Definition file — see ../FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { ProductTabsMagic } from './ProductTabsMagic.client';

export const productTabsMagicSection: SectionDefinition = {
  schema: {
    id: 'product-tabs',
    label: { en: 'Product Tabs', ar: 'تبويبات المنتج' },
    icon: 'tabs',
    category: 'commerce',
    description: {
      en: 'Magic section. Tabbed view of description, FAQs, shipping and returns.',
      ar: 'قسم سحري. تبويبات للوصف، الأسئلة الشائعة، الشحن والإرجاع.',
    },
    translatable: [
      'tab_description_label',
      'tab_faqs_label',
      'tab_shipping_label',
      'tab_returns_label',
      'shipping_html',
      'returns_html',
    ],
    schema: [
      { key: 'show_description', type: 'boolean', label: { en: 'Show description tab', ar: 'تبويب الوصف' }, defaultValue: true },
      { key: 'show_faqs', type: 'boolean', label: { en: 'Show FAQs tab', ar: 'تبويب الأسئلة الشائعة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping tab', ar: 'تبويب الشحن' }, defaultValue: false },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns tab', ar: 'تبويب الإرجاع' }, defaultValue: false },
      { key: 'tab_description_label', type: 'text', label: { en: 'Description tab label', ar: 'عنوان تبويب الوصف' } },
      { key: 'tab_faqs_label', type: 'text', label: { en: 'FAQs tab label', ar: 'عنوان تبويب الأسئلة' } },
      { key: 'tab_shipping_label', type: 'text', label: { en: 'Shipping tab label', ar: 'عنوان تبويب الشحن' } },
      { key: 'tab_returns_label', type: 'text', label: { en: 'Returns tab label', ar: 'عنوان تبويب الإرجاع' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
  },
  Component: ProductTabsMagic,
  defaultSettings: { show_description: true, show_faqs: true, show_shipping: false, show_returns: false },
};
