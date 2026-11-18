// Settings schema of "script-manifesto": one sentence in up to four
// languages and scripts, the visitor's own language in ink. The dashboard
// mirror lives in multi-stores-dashboard/src/lib/creative-sections/
// script-manifesto.ts (same keys, order, types, options and defaults, with
// six-locale labels).
//
// Type-only import: schemas.ts imports this file, so nothing of it may be
// needed at run time here.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

/** The most lines the section renders. */
export const MANIFESTO_MAX_LINES = 4;

const LINE_FIELDS: FieldDefinition[] = [
  {
    key: 'text',
    type: 'textarea',
    label: L('Sentence', 'الجملة'),
    maxLength: 160,
    description: L(
      'A line break is kept only while this line is the highlighted one.',
      'يُحتفَظ بفاصل السطر فقط عندما يكون هذا السطر هو البارز.',
    ),
  },
  {
    key: 'label',
    type: 'text',
    label: L('Language label', 'اسم اللغة'),
    maxLength: 30,
    description: L('The name of the language as its speakers write it.', 'اسم اللغة كما يكتبه أهلها.'),
  },
  {
    key: 'lang',
    type: 'text',
    label: L('Language code', 'رمز اللغة'),
    maxLength: 8,
    description: L(
      'Short code such as en, ar, sv, ku. The line matching the visitor’s language is highlighted.',
      'رمز قصير مثل en أو ar أو sv أو ku. يُبرَز السطر المطابق للغة الزائر.',
    ),
  },
  {
    key: 'dir',
    type: 'select',
    label: L('Writing direction', 'اتجاه الكتابة'),
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: L('Automatic', 'تلقائي') },
      { value: 'ltr', label: L('Left to right', 'من اليسار إلى اليمين') },
      { value: 'rtl', label: L('Right to left', 'من اليمين إلى اليسار') },
    ],
  },
];

export const entry: CreativeSchemaEntry = {
  schema: {
    id: 'script-manifesto',
    label: L('Manifesto in several languages', 'البيان بعدة لغات'),
    icon: 'languages',
    category: 'content',
    description: L(
      'One sentence shown in up to four languages and scripts at once. The visitor’s own language is strong, the others are quiet.',
      'جملة واحدة تظهر بما يصل إلى أربع لغات وخطوط معاً. لغة الزائر بارزة والبقية هادئة.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
    // The lines are NOT translatable: the same lines show in every locale.
    translatable: ['cta_text'],
    schema: [
      {
        key: 'lines',
        type: 'repeater',
        label: L('Lines', 'السطور'),
        maxItems: MANIFESTO_MAX_LINES,
        fields: LINE_FIELDS,
        description: L(
          'The same lines show in every language of the store.',
          'تظهر السطور نفسها في كل لغات المتجر.',
        ),
      },
      { key: 'cta_text', type: 'text', label: L('Link text', 'نص الرابط'), maxLength: 40 },
      {
        key: 'mark_image',
        type: 'image',
        label: L('Symbol', 'الرمز'),
        description: L('A small mark above the lines (shown at 40 px).', 'علامة صغيرة فوق السطور (تُعرض بحجم 40 بكسل).'),
      },
      {
        key: 'active_first',
        type: 'boolean',
        label: L('Visitor’s language first', 'لغة الزائر أولاً'),
        defaultValue: true,
      },
      { key: 'cta_url', type: 'url', label: L('Link', 'الرابط') },
      {
        key: 'bg_color',
        type: 'color',
        label: L('Background colour', 'لون الخلفية'),
        description: L('Empty = the theme text colour (a dark band).', 'فارغ = لون النص في الثيم (شريط داكن).'),
      },
      {
        key: 'text_color',
        type: 'color',
        label: L('Text colour', 'لون النص'),
        description: L('Empty = the theme background colour.', 'فارغ = لون الخلفية في الثيم.'),
      },
      {
        key: 'accent_color',
        type: 'color',
        label: L('Accent colour', 'لون التمييز'),
        description: L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.'),
      },
      {
        key: 'heading_level',
        type: 'select',
        label: L('Highlighted line', 'السطر البارز'),
        defaultValue: 'p',
        options: [
          { value: 'h2', label: L('Heading (H2)', 'عنوان (H2)') },
          { value: 'p', label: L('Paragraph', 'فقرة') },
        ],
      },
    ],
  },
  defaultSettings: { active_first: true, heading_level: 'p' },
  defaultContent: {},
};
