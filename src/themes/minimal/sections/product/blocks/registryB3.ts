// Definitions of the B3 product blocks of a PRODUCT_TEMPLATE: the four
// standalone pieces of `product-tabs` (description, specifications, FAQ,
// shipping & returns), so each can be placed and styled on its own.
// `product-tabs` itself is unchanged and stays available. Definition file
// only (see registryB2.ts); the components are lazy client chunks
// (./lazyB3.tsx). Keys and fields must equal the dashboard schemas
// (multi-stores-dashboard/src/lib/section-schemas.ts).

import type { SectionDefinition } from '../../../../types';
import {
  ProductDescriptionBlock,
  ProductFaqBlock,
  ProductShippingReturnsBlock,
  ProductSpecificationsBlock,
} from './lazyB3';

const PRODUCT_ONLY: SectionDefinition['schema']['pageTypes'] = ['PRODUCT_TEMPLATE'];

const SHOW_HEADING = {
  key: 'show_heading',
  type: 'boolean',
  label: { en: 'Show heading', ar: 'إظهار العنوان' },
  defaultValue: true,
} as const;

const HEADING_TEXT = {
  key: 'heading',
  type: 'text',
  label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' },
  description: {
    en: 'Leave empty to use the default word in the page language.',
    ar: 'اتركه فارغاً لاستخدام الكلمة الافتراضية بلغة الصفحة.',
  },
} as const;

export const productDescriptionSection: SectionDefinition = {
  schema: {
    id: 'product-description',
    label: { en: 'Product description', ar: 'وصف المنتج' },
    icon: 'align-left',
    category: 'product',
    description: {
      en: 'The product’s full description.',
      ar: 'الوصف الكامل للمنتج.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: ['heading'],
    schema: [SHOW_HEADING, HEADING_TEXT],
  },
  Component: ProductDescriptionBlock,
  defaultSettings: { show_heading: true },
};

export const productSpecificationsSection: SectionDefinition = {
  schema: {
    id: 'product-specifications',
    label: { en: 'Specifications', ar: 'المواصفات' },
    icon: 'list',
    category: 'product',
    description: {
      en: 'The product’s specifications table.',
      ar: 'جدول مواصفات المنتج.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: ['heading'],
    schema: [
      SHOW_HEADING,
      HEADING_TEXT,
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'الشكل' },
        defaultValue: 'striped',
        options: [
          { value: 'striped', label: { en: 'Striped table', ar: 'جدول مخطّط' } },
          { value: 'table', label: { en: 'Plain table', ar: 'جدول عادي' } },
          { value: 'list', label: { en: 'List', ar: 'قائمة' } },
        ],
      },
    ],
  },
  Component: ProductSpecificationsBlock,
  defaultSettings: { show_heading: true, style: 'striped' },
};

export const productFaqSection: SectionDefinition = {
  schema: {
    id: 'product-faq',
    label: { en: 'Product FAQ', ar: 'الأسئلة الشائعة للمنتج' },
    icon: 'help-circle',
    category: 'product',
    description: {
      en: 'The product’s FAQs as questions that open and close.',
      ar: 'أسئلة المنتج الشائعة كقائمة تُفتح وتُغلق.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: ['heading'],
    schema: [
      SHOW_HEADING,
      HEADING_TEXT,
      { key: 'open_first', type: 'boolean', label: { en: 'Open the first question', ar: 'فتح السؤال الأول تلقائياً' }, defaultValue: false },
      {
        key: 'allow_multiple',
        type: 'boolean',
        label: { en: 'Allow several open at once', ar: 'السماح بفتح أكثر من سؤال' },
        defaultValue: true,
      },
    ],
  },
  Component: ProductFaqBlock,
  defaultSettings: { show_heading: true, open_first: false, allow_multiple: true },
};

export const productShippingReturnsSection: SectionDefinition = {
  schema: {
    id: 'product-shipping-returns',
    label: { en: 'Shipping & returns', ar: 'الشحن والإرجاع' },
    icon: 'package',
    category: 'product',
    description: {
      en: 'Your shipping and returns texts, written in this block.',
      ar: 'نصّا الشحن والإرجاع الخاصّان بك، تكتبهما في هذا القسم.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: ['shipping_heading', 'returns_heading', 'shipping_html', 'returns_html'],
    schema: [
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping', ar: 'إظهار الشحن' }, defaultValue: true },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns', ar: 'إظهار الإرجاع' }, defaultValue: true },
      SHOW_HEADING,
      { key: 'shipping_heading', type: 'text', label: { en: 'Shipping heading (optional)', ar: 'عنوان الشحن (اختياري)' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_heading', type: 'text', label: { en: 'Returns heading (optional)', ar: 'عنوان الإرجاع (اختياري)' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
  },
  Component: ProductShippingReturnsBlock,
  defaultSettings: { show_shipping: true, show_returns: true, show_heading: true },
};

/** B3 product blocks by section key; spread into the minimal theme registry. */
export const productBlocksB3: Record<string, SectionDefinition> = {
  'product-description': productDescriptionSection,
  'product-specifications': productSpecificationsSection,
  'product-faq': productFaqSection,
  'product-shipping-returns': productShippingReturnsSection,
};
