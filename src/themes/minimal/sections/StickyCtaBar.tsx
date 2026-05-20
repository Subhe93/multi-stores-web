// Definition file — server-rendered SectionDefinition + schema. The
// interactive bar lives in StickyCtaBar.client.tsx (RSC boundary).

import type { SectionDefinition } from '../../types';
import { StickyCtaBar } from './StickyCtaBar.client';

export const stickyCtaBarSection: SectionDefinition = {
  schema: {
    id: 'sticky-cta-bar',
    label: { en: 'Sticky CTA Bar', ar: 'شريط دعوة لاصق' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'A call-to-action bar that slides up and pins to the bottom of the screen after the visitor scrolls. Dismissible.',
      ar: 'شريط دعوة لإجراء ينزلق ويلتصق بأسفل الشاشة بعد أن يمرّر الزائر. قابل للإغلاق.',
    },
    translatable: ['text', 'cta_text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 120 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      { key: 'show_after_px', type: 'number', label: { en: 'Show after scrolling (px)', ar: 'يظهر بعد التمرير (px)' }, min: 0, max: 4000, defaultValue: 500 },
      { key: 'show_close', type: 'boolean', label: { en: 'Show dismiss button', ar: 'إظهار زر الإغلاق' }, defaultValue: true },
      { key: 'bar_bg_color', type: 'color', label: { en: 'Bar background', ar: 'خلفية الشريط' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: StickyCtaBar,
  defaultSettings: { show_after_px: 500, show_close: true },
  defaultContent: { text: 'Ready to get started?', cta_text: 'Shop now' },
};
