// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { ProductPageMagic } from './ProductPageMagic.client';

export const productPageMagicSection: SectionDefinition = {
  schema: {
    id: 'product-page',
    label: { en: 'Product Page', ar: 'صفحة المنتج' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'The complete product body — gallery, price, bundles, variants, custom fields, shipping and tabs. Matches the full storefront product design.',
      ar: 'جسم المنتج الكامل — المعرض، السعر، الباندلز، الخيارات، الحقول المخصّصة، الشحن والتابات. مطابق لتصميم صفحة المنتج الكامل.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      { key: 'show_trust_badges', type: 'boolean', label: { en: 'Show trust badges', ar: 'إظهار شارات الثقة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping & delivery', ar: 'إظهار الشحن والتوصيل' }, defaultValue: true },
      { key: 'show_tabs', type: 'boolean', label: { en: 'Show tabs (description / specs / FAQ)', ar: 'إظهار التابات (الوصف / المواصفات / الأسئلة)' }, defaultValue: true },
      { key: 'show_tags', type: 'boolean', label: { en: 'Show tags', ar: 'إظهار الوسوم' }, defaultValue: true },
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Add-to-cart button style', ar: 'نمط زر الإضافة للسلة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
      {
        key: 'gallery_aspect',
        type: 'select',
        label: { en: 'Gallery aspect ratio', ar: 'نسبة أبعاد المعرض' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
    ],
  },
  Component: ProductPageMagic,
  defaultSettings: {
    show_trust_badges: true,
    show_shipping: true,
    show_tabs: true,
    show_tags: true,
    button_style: 'solid',
    gallery_aspect: 'square',
  },
};
