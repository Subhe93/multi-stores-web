// Definition file — see ../FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { ProductGalleryMagic } from './ProductGalleryMagic.client';

export const productGalleryMagicSection: SectionDefinition = {
  schema: {
    id: 'product-gallery',
    label: { en: 'Product Gallery', ar: 'معرض المنتج' },
    icon: 'gallery',
    category: 'commerce',
    description: {
      en: 'Magic section. Four layouts (main+thumbnails, grid, stacked, carousel) with optional hover-zoom.',
      ar: 'قسم سحري. أربع تخطيطات (رئيسي+مصغرات، شبكة، مكدّس، شريط) مع تكبير عند المرور.',
    },
    translatable: [],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'main-thumbnails',
        options: [
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
