// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { ImageHotspots } from './ImageHotspots.client';

export const imageHotspotsSection: SectionDefinition = {
  schema: {
    id: 'image-hotspots',
    label: { en: 'Image Hotspots', ar: 'نقاط على صورة' },
    icon: 'target',
    category: 'showcase',
    description: {
      en: '"Shop the look": a lifestyle image with pulsing dots that open small product cards — each with a title, note and optional link.',
      ar: '«تسوّق الإطلالة»: صورة لايف ستايل بنقاط نابضة تفتح بطاقات صغيرة — كل واحدة بعنوان وملاحظة ورابط اختياري.',
    },
    translatable: ['heading', 'subheading', 'hotspots'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'hotspots',
        type: 'repeater',
        label: { en: 'Hotspots', ar: 'النقاط' },
        fields: [
          { key: 'x', type: 'number', label: { en: 'X position (% from left)', ar: 'الموضع الأفقي (% من اليسار)' }, min: 0, max: 100, defaultValue: 50 },
          { key: 'y', type: 'number', label: { en: 'Y position (% from top)', ar: 'الموضع الرأسي (% من الأعلى)' }, min: 0, max: 100, defaultValue: 50 },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, maxLength: 60 },
          { key: 'subtitle', type: 'text', label: { en: 'Subtitle', ar: 'العنوان الفرعي' }, maxLength: 90 },
          { key: 'url', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
  },
  Component: ImageHotspots,
  defaultSettings: {},
  defaultContent: {
    heading: 'Shop the look',
    hotspots: [],
  },
};
