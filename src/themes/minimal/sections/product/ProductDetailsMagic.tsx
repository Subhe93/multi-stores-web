// Definition file — see ../FaqList.tsx for the RSC boundary rationale. The
// component is a client island (ProductDetailsMagic.client.tsx) on the
// page's shared product state.

import type { SectionDefinition } from '../../../types';
// Lazy client chunk (M5 D24), see ./lazy.tsx.
import { ProductDetailsMagic } from './lazy';

export const productDetailsMagicSection: SectionDefinition = {
  schema: {
    id: 'product-details',
    label: { en: 'Product Details', ar: 'تفاصيل المنتج' },
    icon: 'info',
    category: 'product',
    description: {
      en: 'Title, price and description of the product, following the chosen variant, with optional sale badge and share buttons.',
      ar: 'عنوان المنتج وسعره ووصفه، يتبع الخيار المختار، مع شارة خصم وأزرار مشاركة اختيارية.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    // `show_rating` (a placeholder rating row) is no longer offered or
    // rendered; saved templates may still carry it and it is ignored.
    schema: [
      { key: 'show_sale_badge', type: 'boolean', label: { en: 'Show sale badge', ar: 'شارة الخصم' }, defaultValue: true },
      { key: 'show_price', type: 'boolean', label: { en: 'Show price', ar: 'إظهار السعر' }, defaultValue: true },
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_description', type: 'boolean', label: { en: 'Show description', ar: 'إظهار الوصف' }, defaultValue: true },
      { key: 'show_share', type: 'boolean', label: { en: 'Show share/wishlist', ar: 'مشاركة/قائمة الأمنيات' }, defaultValue: false },
    ],
  },
  Component: ProductDetailsMagic,
  defaultSettings: {
    show_sale_badge: true,
    show_price: true,
    show_compare_at: true,
    show_description: true,
    show_share: false,
  },
};
