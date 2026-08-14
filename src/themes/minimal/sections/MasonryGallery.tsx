// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { MasonryGallery } from './MasonryGallery.client';

export const masonryGallerySection: SectionDefinition = {
  schema: {
    id: 'masonry-gallery',
    label: { en: 'Masonry Gallery', ar: 'معرض متداخل' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'A Pinterest-style column gallery that keeps each image at its natural height, with hover captions and an optional lightbox.',
      ar: 'معرض أعمدة بأسلوب Pinterest يحافظ على الارتفاع الطبيعي لكل صورة، مع تسميات عند المرور ولايت بوكس اختياري.',
    },
    translatable: ['heading', 'subheading', 'images'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns (desktop)', ar: 'الأعمدة (سطح المكتب)' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'enable_lightbox', type: 'boolean', label: { en: 'Open images in a lightbox', ar: 'فتح الصور في لايت بوكس' }, defaultValue: true },
      {
        key: 'images',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية توضيحية' } },
          { key: 'url', type: 'url', label: { en: 'Link (optional, disables lightbox)', ar: 'رابط (اختياري، يعطّل اللايت بوكس)' } },
        ],
      },
    ],
  },
  Component: MasonryGallery,
  defaultSettings: { columns: 3, enable_lightbox: true },
  defaultContent: { images: [] },
};
