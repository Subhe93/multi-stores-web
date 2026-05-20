// Section definition (schema + Component reference). Intentionally NOT a
// 'use client' module — otherwise the entire exported object becomes a single
// ClientReference on the server and `def.Component` reads as undefined,
// silently skipping the section. Keeping the definition file shared lets the
// server-side theme registry resolve `.Component` to a clean ClientReference
// imported from the dedicated `.client.tsx` file.

import type { SectionDefinition } from '../../types';
import { FaqList } from './FaqList.client';

export const faqListSection: SectionDefinition = {
  schema: {
    id: 'faq-list',
    label: { en: 'FAQ List', ar: 'الأسئلة الشائعة' },
    icon: 'help',
    category: 'content',
    description: {
      en: 'Smooth-animated accordion. One or two columns; allows one question open at a time or multiple.',
      ar: 'أكورديون مع حركة ناعمة. عمود أو عمودان؛ يسمح بسؤال واحد مفتوح أو عدة في وقت واحد.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'stacked',
        options: [
          { value: 'stacked', label: { en: 'Stacked (1 column)', ar: 'عمودي (عمود واحد)' } },
          { value: 'two-column', label: { en: 'Two columns', ar: 'عمودان' } },
        ],
      },
      { key: 'allow_multiple', type: 'boolean', label: { en: 'Allow multiple open', ar: 'السماح بفتح عدة' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Questions', ar: 'الأسئلة' },
        fields: [
          { key: 'question', type: 'text', label: { en: 'Question', ar: 'السؤال' } },
          { key: 'answer', type: 'textarea', label: { en: 'Answer', ar: 'الإجابة' } },
        ],
      },
    ],
  },
  Component: FaqList,
  defaultSettings: { layout: 'stacked', allow_multiple: true },
};
