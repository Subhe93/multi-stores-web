// Settings schema of "look-spread": a look taken apart into the pieces you
// can buy (numbered markers on two photographs, the same numbers in a ruled
// buy list). The dashboard mirror lives in multi-stores-dashboard/src/lib/
// creative-sections/look-spread.ts (same keys, order, types, options and
// defaults, with six-locale labels).
//
// Type-only import: schemas.ts imports this file, so nothing of it may be
// needed at run time here.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

/** The most rows the buy list renders. */
export const LOOK_SPREAD_MAX_ITEMS = 6;

const ON_PHOTO = { key: 'photo', in: ['a', 'b'] };

const ITEM_FIELDS: FieldDefinition[] = [
  {
    key: 'url',
    type: 'url',
    label: L('Product link', 'رابط المنتج'),
    description: L(
      'Pick a product: its name, image and price are read live from the store.',
      'اختر منتجاً: يُقرأ اسمه وصورته وسعره مباشرة من المتجر.',
    ),
  },
  {
    key: 'title',
    type: 'text',
    label: L('Title', 'العنوان'),
    maxLength: 80,
    description: L('Empty = the product name.', 'فارغ = اسم المنتج.'),
  },
  { key: 'note', type: 'text', label: L('Note', 'ملاحظة'), maxLength: 80 },
  {
    key: 'image',
    type: 'image',
    label: L('Thumbnail', 'الصورة المصغّرة'),
    description: L('Empty = the product image.', 'فارغ = صورة المنتج.'),
  },
  {
    key: 'photo',
    type: 'select',
    label: L('Marker on', 'العلامة على'),
    defaultValue: 'none',
    options: [
      { value: 'none', label: L('No marker', 'بدون علامة') },
      { value: 'a', label: L('Large photograph', 'الصورة الكبيرة') },
      { value: 'b', label: L('Small photograph', 'الصورة الصغيرة') },
    ],
  },
  {
    key: 'x',
    type: 'number',
    label: L('Marker position from the left (%)', 'موضع العلامة من اليسار (%)'),
    min: 0,
    max: 100,
    showIf: ON_PHOTO,
  },
  {
    key: 'y',
    type: 'number',
    label: L('Marker position from the top (%)', 'موضع العلامة من الأعلى (%)'),
    min: 0,
    max: 100,
    showIf: ON_PHOTO,
  },
];

const color = (key: string, en: string, ar: string, den: string, dar: string): FieldDefinition => ({
  key,
  type: 'color',
  label: L(en, ar),
  description: L(den, dar),
});

export const entry: CreativeSchemaEntry = {
  schema: {
    id: 'look-spread',
    label: L('Look spread', 'إطلالة مفكّكة'),
    icon: 'scan-eye',
    category: 'commerce',
    description: L(
      'A look taken apart: numbered markers on two photographs tied to a numbered buy list with live prices.',
      'إطلالة مفكّكة: علامات مرقّمة على صورتين مرتبطة بقائمة شراء مرقّمة بأسعار مباشرة.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING'],
    translatable: ['eyebrow', 'heading', 'note', 'link_label', 'alt_a', 'alt_b', 'items'],
    schema: [
      { key: 'eyebrow', type: 'text', label: L('Eyebrow', 'العنوان العلوي'), maxLength: 60 },
      // A textarea: Enter starts a new line, kept on the storefront.
      { key: 'heading', type: 'textarea', label: L('Heading', 'العنوان'), maxLength: 100 },
      { key: 'note', type: 'textarea', label: L('Side note', 'ملاحظة جانبية'), maxLength: 160 },
      { key: 'link_label', type: 'text', label: L('Link text', 'نص الرابط'), maxLength: 40 },
      {
        key: 'alt_a',
        type: 'text',
        label: L('Large photograph description (alt text)', 'وصف الصورة الكبيرة (النص البديل)'),
        maxLength: 160,
      },
      {
        key: 'alt_b',
        type: 'text',
        label: L('Small photograph description (alt text)', 'وصف الصورة الصغيرة (النص البديل)'),
        maxLength: 160,
      },
      {
        key: 'items',
        type: 'repeater',
        label: L('Pieces', 'القطع'),
        maxItems: LOOK_SPREAD_MAX_ITEMS,
        fields: ITEM_FIELDS,
      },
      { key: 'image_a', type: 'image', label: L('Large photograph', 'الصورة الكبيرة') },
      { key: 'image_b', type: 'image', label: L('Small photograph', 'الصورة الصغيرة') },
      { key: 'link_url', type: 'url', label: L('Link URL', 'الرابط') },
      {
        key: 'list_side',
        type: 'select',
        label: L('List side', 'جهة القائمة'),
        defaultValue: 'end',
        options: [
          { value: 'end', label: L('After the photographs', 'بعد الصور') },
          { value: 'start', label: L('Before the photographs', 'قبل الصور') },
        ],
      },
      color('bg_color', 'Background colour', 'لون الخلفية', 'Empty = the theme background colour.', 'فارغ = لون الخلفية في الثيم.'),
      color('text_color', 'Text colour', 'لون النص', 'Empty = the theme text colour.', 'فارغ = لون النص في الثيم.'),
      color('marker_color', 'Marker colour', 'لون العلامة', 'Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.'),
      color('marker_text_color', 'Marker number colour', 'لون رقم العلامة', 'Empty = white.', 'فارغ = أبيض.'),
    ],
  },
  defaultSettings: { list_side: 'end' },
  defaultContent: {},
};
