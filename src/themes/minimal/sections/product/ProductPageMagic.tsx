// Definition file — see FaqList.tsx for the RSC boundary rationale.

import { TRUST_BADGE_ICON_OPTIONS } from '@/lib/trustBadgeIcons';
import type { SectionDefinition } from '../../../types';
// Lazy client chunk (M5 D24), see ./lazy.tsx.
import { ProductPageMagic } from './lazy';

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
    // `trust_badges` is per-locale content: the owner writes each claim
    // themselves, so nothing is asserted on their behalf. Legacy snapshots may
    // still carry `settings.show_trust_badges`; the storefront ignores it.
    translatable: ['trust_badges'],
    schema: [
      {
        key: 'trust_badges',
        type: 'repeater',
        label: { en: 'Trust badges', ar: 'شارات الثقة' },
        description: {
          en: 'Only state what is true for this store (e.g. shipping terms, returns, payment). Nothing is shown until you add badges.',
          ar: 'اذكر فقط ما ينطبق فعلاً على متجرك (مثل شروط الشحن، الإرجاع، الدفع). لا يظهر شيء حتى تضيف شارات.',
        },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: TRUST_BADGE_ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description (optional)', ar: 'الوصف (اختياري)' } },
        ],
      },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping & delivery', ar: 'إظهار الشحن والتوصيل' }, defaultValue: true },
      { key: 'show_tabs', type: 'boolean', label: { en: 'Show tabs (description / specs / FAQ)', ar: 'إظهار التابات (الوصف / المواصفات / الأسئلة)' }, defaultValue: true },
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
    show_shipping: true,
    show_tabs: true,
    button_style: 'solid',
    gallery_aspect: 'square',
  },
};
