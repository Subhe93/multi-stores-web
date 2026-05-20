// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { AnnouncementBar } from './AnnouncementBar.client';

export const announcementBarSection: SectionDefinition = {
  schema: {
    id: 'announcement-bar',
    label: { en: 'Announcement Bar', ar: 'شريط الإعلان' },
    icon: 'megaphone',
    category: 'header',
    description: {
      en: 'Thin promotional strip above the header. Three layouts: single message, scrolling marquee, or auto-rotating cycle. Optional close button remembers the dismissal in the browser.',
      ar: 'شريط ترويجي رفيع فوق الهيدر. ثلاثة تخطيطات: رسالة مفردة، شريط متحرّك، أو تدوير تلقائي. زر إغلاق اختياري يتذكّر الإخفاء في المتصفح.',
    },
    pageTypes: ['HEADER'],
    translatable: ['messages'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'simple',
        options: [
          { value: 'simple', label: { en: 'Single message', ar: 'رسالة واحدة' } },
          { value: 'marquee', label: { en: 'Scrolling marquee', ar: 'شريط متحرّك' } },
          { value: 'rotating', label: { en: 'Auto-rotate', ar: 'تدوير تلقائي' } },
        ],
      },
      {
        key: 'messages',
        type: 'repeater',
        label: { en: 'Messages', ar: 'الرسائل' },
        fields: [
          { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 160 },
          { key: 'link_label', type: 'text', label: { en: 'Inline link label (optional)', ar: 'نص الرابط داخل النص (اختياري)' }, maxLength: 40 },
          { key: 'link_url', type: 'url', label: { en: 'Link URL', ar: 'رابط الرابط' } },
        ],
      },
      { key: 'rotate_ms', type: 'number', label: { en: 'Rotate interval (ms, rotating layout)', ar: 'فاصل التدوير (ms، للتدوير)' }, min: 2000, max: 30000, defaultValue: 5000 },
      { key: 'marquee_speed_s', type: 'number', label: { en: 'Marquee duration (s, marquee layout)', ar: 'مدة الشريط المتحرّك (s)' }, min: 8, max: 120, defaultValue: 25 },
      { key: 'dismissible', type: 'boolean', label: { en: 'Show close button (X)', ar: 'إظهار زر الإغلاق (X)' }, defaultValue: false },
      { key: 'dismiss_key', type: 'text', label: { en: 'Dismiss key (change to "show again" after a dismissal)', ar: 'مفتاح الإخفاء (غيّره لإعادة الإظهار)' }, defaultValue: 'default' },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'link_color', type: 'color', label: { en: 'Inline link color', ar: 'لون الرابط الداخلي' } },
    ],
  },
  Component: AnnouncementBar,
  defaultSettings: {
    layout: 'simple',
    rotate_ms: 5000,
    marquee_speed_s: 25,
    dismissible: false,
    dismiss_key: 'default',
  },
  defaultContent: {
    messages: [
      { text: 'Free shipping on orders over $50', link_label: 'Shop now', link_url: '/products' },
    ],
  },
};
