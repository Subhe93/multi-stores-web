// Definition file — see ../FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
// Lazy client chunk (M5 D24), see ./lazy.tsx.
import { ProductGalleryMagic } from './lazy';

export const productGalleryMagicSection: SectionDefinition = {
  schema: {
    id: 'product-gallery',
    label: { en: 'Product Gallery', ar: 'معرض المنتج' },
    icon: 'gallery',
    category: 'product',
    description: {
      en: 'Product images that follow the chosen variant and colour. Classic (as the product page), main+thumbnails, grid, stacked or carousel, with optional hover-zoom.',
      ar: 'صور المنتج تتبع الخيار واللون المختار. كلاسيكي (كصفحة المنتج)، رئيسي+مصغرات، شبكة، مكدّس أو شريط، مع تكبير عند المرور.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'main-thumbnails',
        options: [
          { value: 'classic', label: { en: 'Classic (as the product page)', ar: 'كلاسيكي (كصفحة المنتج)' } },
          { value: 'main-thumbnails', label: { en: 'Main + Thumbnails', ar: 'رئيسي + مصغرات' } },
          { value: 'carousel', label: { en: 'Carousel', ar: 'شريط' } },
          { value: 'grid', label: { en: 'Two-column grid', ar: 'شبكة عمودين' } },
          { value: 'stacked', label: { en: 'Stacked', ar: 'مكدّس' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
        ],
      },
      { key: 'enable_zoom', type: 'boolean', label: { en: 'Hover to zoom', ar: 'تكبير عند المرور' }, defaultValue: true },
    ],
  },
  Component: ProductGalleryMagic,
  defaultSettings: { layout: 'main-thumbnails', aspect: 'square', enable_zoom: true },
};
