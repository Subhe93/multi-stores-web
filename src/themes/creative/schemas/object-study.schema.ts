// Settings schema of "object-study": one product looked at closely, like a
// plate in a museum catalogue. Leader lines run from points on the
// photograph to short notes in the margins; title, live price and a link to
// the product sit under the plate. The dashboard mirror lives in
// multi-stores-dashboard/src/lib/creative-sections/object-study.ts (same
// keys, order, types, options, limits and defaults, with six-locale labels).
//
// Type-only imports: schemas.ts imports this file, so nothing of it may be
// needed at run time here.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

/** The most notes the section renders. */
export const OBJECT_STUDY_MAX_NOTES = 4;

const NOTE_FIELDS: FieldDefinition[] = [
  { key: 'title', type: 'text', label: L('Title', 'العنوان'), maxLength: 50 },
  { key: 'text', type: 'textarea', label: L('Text', 'النص'), maxLength: 120 },
  {
    key: 'x',
    type: 'number',
    label: L('Point: from the left (%)', 'النقطة: من اليسار (%)'),
    min: 0,
    max: 100,
    defaultValue: 50,
    description: L(
      'Position on the photograph, measured from its left edge in every language.',
      'الموضع على الصورة، يُقاس من حافتها اليسرى في كل اللغات.',
    ),
  },
  {
    key: 'y',
    type: 'number',
    label: L('Point: from the top (%)', 'النقطة: من الأعلى (%)'),
    min: 0,
    max: 100,
    defaultValue: 50,
  },
];

export const entry: CreativeSchemaEntry = {
  schema: {
    id: 'object-study',
    label: L('Object study', 'دراسة قطعة'),
    icon: 'crosshair',
    category: 'commerce',
    description: L(
      'One product as a catalogue plate: thin lines run from points on the photograph to short notes, with the live price and a link to the product under it.',
      'منتج واحد كلوحة في كتالوج: خطوط رفيعة تخرج من نقاط على الصورة إلى ملاحظات قصيرة، وتحته السعر الحالي ورابط المنتج.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE'],
    translatable: ['plate_label', 'category_label', 'heading', 'body', 'cta_text', 'alt', 'notes'],
    schema: [
      // Content
      { key: 'plate_label', type: 'text', label: L('Plate label', 'تسمية اللوحة'), maxLength: 40 },
      { key: 'category_label', type: 'text', label: L('Category label', 'تسمية الفئة'), maxLength: 40 },
      {
        key: 'heading',
        type: 'text',
        label: L('Heading', 'العنوان'),
        maxLength: 80,
        description: L('Empty = the title of the linked product.', 'فارغ = اسم المنتج المرتبط.'),
      },
      { key: 'body', type: 'textarea', label: L('Text', 'النص'), maxLength: 240 },
      { key: 'cta_text', type: 'text', label: L('Button text', 'نص الزر'), maxLength: 40 },
      { key: 'alt', type: 'text', label: L('Image description (alt)', 'وصف الصورة (alt)'), maxLength: 160 },
      {
        key: 'notes',
        type: 'repeater',
        label: L('Notes', 'الملاحظات'),
        maxItems: OBJECT_STUDY_MAX_NOTES,
        fields: NOTE_FIELDS,
      },
      // Settings
      {
        key: 'product_url',
        type: 'url',
        label: L('Product', 'المنتج'),
        description: L(
          'Link to a product (/products/…). Title, photograph and price come from it. On a product template: empty = the product of the page.',
          'رابط منتج (/products/…). يأتي منه الاسم والصورة والسعر. في قالب المنتج: فارغ = منتج الصفحة.',
        ),
      },
      {
        key: 'image',
        type: 'image',
        label: L('Photograph', 'الصورة'),
        description: L('Empty = the photograph of the linked product.', 'فارغ = صورة المنتج المرتبط.'),
      },
      {
        key: 'aspect',
        type: 'select',
        label: L('Plate shape', 'شكل اللوحة'),
        defaultValue: 'portrait',
        options: [
          { value: 'portrait', label: L('Portrait (4:5)', 'طولي (4:5)') },
          { value: 'square', label: L('Square', 'مربع') },
        ],
      },
      {
        key: 'fit',
        type: 'select',
        label: L('Photograph fit', 'ملاءمة الصورة'),
        defaultValue: 'contain',
        options: [
          { value: 'contain', label: L('Whole photograph (cut-out or studio)', 'الصورة كاملة (مفرّغة أو استوديو)') },
          { value: 'cover', label: L('Fill the plate', 'تملأ اللوحة') },
        ],
      },
      {
        key: 'bg_color',
        type: 'color',
        label: L('Background colour', 'لون الخلفية'),
        description: L('Empty = the theme surface colour.', 'فارغ = لون السطح في الثيم.'),
      },
      {
        key: 'ground_color',
        type: 'color',
        label: L('Plate ground colour', 'لون أرضية اللوحة'),
        description: L('Behind a photograph shown whole. Empty = none.', 'خلف الصورة المعروضة كاملة. فارغ = بلا لون.'),
      },
      {
        key: 'text_color',
        type: 'color',
        label: L('Text colour', 'لون النص'),
        description: L('Empty = the theme text colour.', 'فارغ = لون النص في الثيم.'),
      },
      {
        key: 'line_color',
        type: 'color',
        label: L('Line colour', 'لون الخطوط'),
        description: L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.'),
      },
      { key: 'show_price', type: 'boolean', label: L('Show the price', 'إظهار السعر'), defaultValue: true },
    ],
  },
  defaultSettings: { aspect: 'portrait', fit: 'contain', show_price: true },
  defaultContent: {},
};
