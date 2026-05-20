// Definition file — server-rendered SectionDefinition + schema. The
// stroke-drawn icons live in AnimatedFeatures.client.tsx (RSC boundary).

import type { SectionDefinition } from '../../types';
import { AnimatedFeatures } from './AnimatedFeatures.client';

const ICON_OPTIONS = [
  { value: 'bolt', label: { en: 'Bolt', ar: 'برق' } },
  { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
  { value: 'star', label: { en: 'Star', ar: 'نجمة' } },
  { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
  { value: 'shield', label: { en: 'Shield', ar: 'درع' } },
  { value: 'truck', label: { en: 'Truck', ar: 'شاحنة' } },
  { value: 'check', label: { en: 'Check', ar: 'صح' } },
  { value: 'spark', label: { en: 'Spark', ar: 'بريق' } },
];

export const animatedFeaturesSection: SectionDefinition = {
  schema: {
    id: 'animated-features',
    label: { en: 'Animated Features', ar: 'مميزات متحرّكة' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'A row of features whose line-art SVG icons draw themselves when scrolled into view.',
      ar: 'صف من المميزات بأيقونات SVG خطية ترسم نفسها عند ظهورها أثناء التمرير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 4 },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: ICON_OPTIONS },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      { key: 'icon_color', type: 'color', label: { en: 'Icon color', ar: 'لون الأيقونة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'title_color', type: 'color', label: { en: 'Feature title color', ar: 'لون عنوان الميزة' } },
      { key: 'description_color', type: 'color', label: { en: 'Feature description color', ar: 'لون وصف الميزة' } },
    ],
  },
  Component: AnimatedFeatures,
  defaultSettings: { columns: 4 },
  defaultContent: {
    items: [
      { icon: 'bolt', title: 'Lightning fast', description: 'Built for speed from the ground up.' },
      { icon: 'shield', title: 'Secure', description: 'Protected with bank-level encryption.' },
      { icon: 'heart', title: 'Loved', description: 'Trusted by thousands of customers.' },
      { icon: 'spark', title: 'Delightful', description: 'Thoughtful details in every corner.' },
    ],
  },
};
