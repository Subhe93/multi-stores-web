// Definition file — see ../FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { AddToCartMagic } from './AddToCartMagic.client';

export const addToCartMagicSection: SectionDefinition = {
  schema: {
    id: 'add-to-cart',
    label: { en: 'Add to Cart', ar: 'إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'commerce',
    description: {
      en: 'Magic section. Auto-detects color options as swatches, supports size pills, quantity, sticky mobile CTA.',
      ar: 'قسم سحري. يكتشف خيار اللون كدوائر ملوّنة، يدعم المقاسات والكمية وزر ثابت أسفل الجوال.',
    },
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
