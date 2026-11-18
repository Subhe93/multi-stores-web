// Settings schema of "pattern-band": a woven band built from the store's own
// tile artwork. The dashboard keeps a six-locale mirror
// (multi-stores-dashboard/src/lib/creative-sections/pattern-band.ts): same
// keys, order, types, options and defaults.
//
// Self-contained on purpose (plain field literals, type-only imports): this
// file is imported by the schema registry and by the section itself.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });
const option = (value: string, en: string, ar: string) => ({ value, label: L(en, ar) });

export const PATTERN_BAND_KEY = 'pattern-band';

const FIELDS: FieldDefinition[] = [
  {
    key: 'label',
    type: 'text',
    label: L('Label', 'النص'),
    maxLength: 60,
    description: L('Optional. A small tag centred on the band.', 'اختياري. بطاقة صغيرة في منتصف الشريط.'),
  },
  {
    key: 'tile_image',
    type: 'image',
    label: L('Tile artwork', 'صورة النقش'),
    description: L(
      'One tile of your pattern (SVG, PNG or WebP). It repeats along the band at the height of the band.',
      'بلاطة واحدة من نقشك (SVG أو PNG أو WebP). تتكرر على طول الشريط بارتفاع الشريط.',
    ),
  },
  {
    key: 'size',
    type: 'select',
    label: L('Band height', 'ارتفاع الشريط'),
    defaultValue: 'md',
    options: [option('sm', 'Small', 'صغير'), option('md', 'Medium', 'متوسط'), option('lg', 'Large', 'كبير')],
  },
  {
    key: 'rows',
    type: 'select',
    label: L('Rows', 'الصفوف'),
    defaultValue: '1',
    options: [option('1', 'One row', 'صف واحد'), option('2', 'Two rows, offset', 'صفّان متداخلان')],
    description: L(
      'Two rows double the band; the second row is shifted by half a square tile.',
      'الصفّان يضاعفان الشريط، والصف الثاني مُزاح بمقدار نصف بلاطة مربّعة.',
    ),
  },
  {
    key: 'width',
    type: 'select',
    label: L('Width', 'العرض'),
    defaultValue: 'full',
    options: [option('full', 'Full width', 'عرض كامل'), option('contained', 'Contained', 'ضمن الحاوية')],
  },
  {
    key: 'space',
    type: 'select',
    label: L('Space above and below', 'المسافة أعلى وأسفل'),
    defaultValue: 'md',
    options: [
      option('none', 'None', 'بدون'),
      option('sm', 'Small', 'صغيرة'),
      option('md', 'Medium', 'متوسطة'),
      option('lg', 'Large', 'كبيرة'),
    ],
  },
  {
    key: 'rails',
    type: 'boolean',
    label: L('Hairlines above and below', 'خطّان رفيعان أعلى وأسفل'),
    defaultValue: false,
  },
  { key: 'label_url', type: 'url', label: L('Label link', 'رابط النص') },
  {
    key: 'bg_color',
    type: 'color',
    label: L('Band ground', 'أرضية الشريط'),
    description: L('Empty = transparent, the ground of the artwork shows.', 'فارغ = شفاف، تظهر أرضية النقش نفسها.'),
  },
  {
    key: 'tag_color',
    type: 'color',
    label: L('Label ground', 'خلفية النص'),
    description: L('Empty = the theme background colour.', 'فارغ = لون الخلفية في الثيم.'),
  },
  {
    key: 'text_color',
    type: 'color',
    label: L('Text colour', 'لون النص'),
    description: L('Empty = the theme text colour.', 'فارغ = لون النص في الثيم.'),
  },
];

export const entry: CreativeSchemaEntry = {
  schema: {
    id: PATTERN_BAND_KEY,
    label: L('Pattern band', 'شريط النسيج'),
    icon: 'grip-horizontal',
    category: 'content',
    description: L(
      'A woven band from your own tile artwork: a divider, a texture and, with a label, a small signpost.',
      'شريط منسوج من نقشك الخاص: فاصل وملمس، ومع نص يصبح لافتة صغيرة.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
    translatable: ['label'],
    schema: FIELDS,
  },
  defaultSettings: { size: 'md', rows: '1', width: 'full', space: 'md', rails: false },
  defaultContent: {},
};
