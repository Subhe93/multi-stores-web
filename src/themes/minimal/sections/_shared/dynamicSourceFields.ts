// Schema fields of the dynamic sources (see ./dynamicSource.tsx). Offered
// only in the PRODUCT_TEMPLATE inspector (`pageTypes`). Keys, options and
// showIf rules mirror the dashboard src/lib/section-schemas.ts; a dashboard
// test keeps the two copies in sync.

import type { FieldDefinition } from '../../../types';

const PRODUCT_ONLY: FieldDefinition['pageTypes'] = ['PRODUCT_TEMPLATE'];

/** The static field (html / image) shows only while the source is static. */
export const STATIC_CONTENT_SHOW_IF = { key: 'content_source', in: ['', 'static'] };
export const STATIC_IMAGE_SHOW_IF = { key: 'image_source', in: ['', 'static'] };

export const CONTENT_SOURCE_FIELDS: FieldDefinition[] = [
  {
    key: 'content_source',
    type: 'select',
    label: { en: 'Content source', ar: 'مصدر المحتوى' },
    defaultValue: 'static',
    pageTypes: PRODUCT_ONLY,
    options: [
      { value: 'static', label: { en: 'Static (written here)', ar: 'ثابت (يُكتب هنا)' } },
      { value: 'product_description', label: { en: 'Product description', ar: 'وصف المنتج' } },
      { value: 'product_short_description', label: { en: 'Product short description', ar: 'الوصف المختصر للمنتج' } },
      { value: 'product_specifications', label: { en: 'Product specifications', ar: 'مواصفات المنتج' } },
      { value: 'product_attribute', label: { en: 'Product attribute (custom field)', ar: 'خاصية من المنتج (حقل مخصص)' } },
      { value: 'product_title', label: { en: 'Product title', ar: 'اسم المنتج' } },
    ],
  },
  {
    key: 'attribute_key',
    type: 'text',
    label: { en: 'Attribute name', ar: 'اسم الخاصية' },
    description: {
      en: 'The attribute name as shown in the product specifications.',
      ar: 'اسم الخاصية كما يظهر في مواصفات المنتج.',
    },
    pageTypes: PRODUCT_ONLY,
    showIf: { key: 'content_source', in: ['product_attribute'] },
  },
];

export const IMAGE_SOURCE_FIELDS: FieldDefinition[] = [
  {
    key: 'image_source',
    type: 'select',
    label: { en: 'Image source', ar: 'مصدر الصورة' },
    defaultValue: 'static',
    pageTypes: PRODUCT_ONLY,
    options: [
      { value: 'static', label: { en: 'Uploaded image', ar: 'صورة مرفوعة' } },
      { value: 'product_featured', label: { en: 'Product featured image', ar: 'الصورة الرئيسية للمنتج' } },
      { value: 'product_image_n', label: { en: 'Product image by position', ar: 'صورة المنتج حسب الترتيب' } },
      { value: 'variant_image', label: { en: 'Selected variant image', ar: 'صورة الخيار المحدد' } },
    ],
  },
  {
    key: 'image_index',
    type: 'number',
    label: { en: 'Image position (1 = first)', ar: 'ترتيب الصورة (1 = الأولى)' },
    min: 1,
    max: 20,
    defaultValue: 2,
    pageTypes: PRODUCT_ONLY,
    showIf: { key: 'image_source', in: ['product_image_n'] },
  },
];
