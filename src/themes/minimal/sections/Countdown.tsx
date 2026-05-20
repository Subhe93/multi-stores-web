// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { Countdown } from './Countdown.client';

export const countdownSection: SectionDefinition = {
  schema: {
    id: 'countdown',
    label: { en: 'Countdown Timer', ar: 'عدّاد تنازلي' },
    icon: 'timer',
    category: 'showcase',
    description: {
      en: 'A live countdown to a deadline — perfect for sales and launches. Shows an expired message after the date passes.',
      ar: 'عدّاد حيّ يتناقص حتى موعد محدّد — مثالي للعروض والإطلاقات. يعرض رسالة انتهاء بعد مرور الموعد.',
    },
    translatable: ['heading', 'subheading', 'expired_text'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'target_date',
        type: 'text',
        label: { en: 'End date & time (e.g. 2026-12-31T23:59)', ar: 'تاريخ ووقت الانتهاء (مثال: 2026-12-31T23:59)' },
      },
      { key: 'expired_text', type: 'text', label: { en: 'Expired message', ar: 'رسالة الانتهاء' } },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
        ],
      },
      { key: 'digit_color', type: 'color', label: { en: 'Digit color', ar: 'لون الأرقام' } },
      { key: 'box_bg_color', type: 'color', label: { en: 'Box background', ar: 'خلفية الصندوق' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: Countdown,
  defaultSettings: { alignment: 'center' },
  defaultContent: {
    heading: 'Sale ends soon',
    subheading: "Don't miss out — limited time only.",
  },
};
