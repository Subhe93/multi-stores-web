// Definition file — see ../FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
// Lazy client chunk (M5 D24), see ./lazy.tsx.
import { AddToCartMagic } from './lazy';

export const addToCartMagicSection: SectionDefinition = {
  schema: {
    id: 'add-to-cart',
    label: { en: 'Add to Cart', ar: 'إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'product',
    description: {
      en: 'Options (swatches, size pills), personalization fields, price, quantity and the add-to-cart button in one block, following the page’s product state. Optional sticky mobile CTA.',
      ar: 'الخيارات (دوائر الألوان، المقاسات) وحقول التخصيص والسعر والكمية وزر الإضافة للسلة في قسم واحد، يتبع حالة المنتج في الصفحة. زر ثابت أسفل الجوال اختياري.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: ['button_label'],
    schema: [
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Button style', ar: 'نمط الزر' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مخطّط' } },
        ],
      },
      { key: 'full_width', type: 'boolean', label: { en: 'Full width button', ar: 'زر بعرض كامل' }, defaultValue: true },
      { key: 'show_quantity', type: 'boolean', label: { en: 'Show quantity picker', ar: 'إظهار اختيار الكمية' }, defaultValue: true },
      { key: 'show_stock', type: 'boolean', label: { en: 'Show stock level', ar: 'إظهار الكمية المتوفرة' }, defaultValue: false },
      { key: 'sticky_on_mobile', type: 'boolean', label: { en: 'Sticky CTA on mobile', ar: 'زر ثابت أسفل الجوال' }, defaultValue: false },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
    ],
  },
  Component: AddToCartMagic,
  defaultSettings: {
    button_style: 'solid',
    full_width: true,
    show_quantity: true,
    show_stock: false,
    sticky_on_mobile: false,
  },
};
