// Definition file — server-rendered SectionDefinition + schema. The animated
// hero lives in AuroraHero.client.tsx (RSC boundary).

import type { SectionDefinition } from '../../types';
import { AuroraHero } from './AuroraHero.client';

export const auroraHeroSection: SectionDefinition = {
  schema: {
    id: 'aurora-hero',
    label: { en: 'Aurora Hero', ar: 'بانر أورورا' },
    icon: 'sparkles',
    category: 'showcase',
    description: {
      en: 'A modern full-bleed hero with soft animated SVG gradient blobs drifting behind the headline.',
      ar: 'بانر عصري كامل العرض بأشكال SVG متدرّجة متحرّكة تنساب خلف العنوان.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'color_1', type: 'color', label: { en: 'Aurora color 1', ar: 'لون أورورا 1' } },
      { key: 'color_2', type: 'color', label: { en: 'Aurora color 2', ar: 'لون أورورا 2' } },
      { key: 'color_3', type: 'color', label: { en: 'Aurora color 3', ar: 'لون أورورا 3' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
      { key: 'cta_secondary_border_color', type: 'color', label: { en: 'Secondary button border', ar: 'حدود الزر الثاني' } },
    ],
  },
  Component: AuroraHero,
  defaultSettings: { height: 'lg', bg_color: '#0b1020', color_1: '#6366f1', color_2: '#ec4899', color_3: '#06b6d4' },
  defaultContent: {
    eyebrow: 'New',
    heading: 'Build something people love',
    subheading: 'A modern hero with a living gradient backdrop.',
    cta_text: 'Get started',
    cta_secondary_text: 'Learn more',
  },
};
