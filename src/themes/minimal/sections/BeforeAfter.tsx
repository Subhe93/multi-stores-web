// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { BeforeAfter } from './BeforeAfter.client';

export const beforeAfterSection: SectionDefinition = {
  schema: {
    id: 'before-after',
    label: { en: 'Before / After', ar: 'قبل / بعد' },
    icon: 'compare',
    category: 'showcase',
    description: {
      en: 'A draggable comparison slider that reveals one image over another — perfect for transformations and results.',
      ar: 'شريط مقارنة قابل للسحب يكشف صورة فوق أخرى — مثالي لعرض التحوّلات والنتائج.',
    },
    translatable: ['heading', 'subheading', 'label_before', 'label_after'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'image_before', type: 'image', label: { en: 'Before image', ar: 'صورة قبل' } },
      { key: 'image_after', type: 'image', label: { en: 'After image', ar: 'صورة بعد' } },
      {
        key: 'start_position',
        type: 'number',
        label: { en: 'Start position (0–100)', ar: 'موضع البداية (0-100)' },
        min: 0,
        max: 100,
        defaultValue: 50,
      },
      { key: 'label_before', type: 'text', label: { en: '"Before" label', ar: 'تسمية "قبل"' }, maxLength: 30 },
      { key: 'label_after', type: 'text', label: { en: '"After" label', ar: 'تسمية "بعد"' }, maxLength: 30 },
    ],
  },
  Component: BeforeAfter,
  defaultSettings: { start_position: 50 },
  defaultContent: {
    heading: 'See the difference',
    label_before: 'Before',
    label_after: 'After',
  },
};
