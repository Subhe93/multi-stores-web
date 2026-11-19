// Settings schema of "promise-band": a light band of up to three promises
// under a small heading, with a horizon line that a small sun walks along
// while the page scrolls. The dashboard keeps a six-locale mirror
// (multi-stores-dashboard/src/lib/creative-sections/promise-band.ts): same
// keys, order, types, options and defaults.
//
// Self-contained on purpose (plain field literals, type-only imports): this
// file is imported by the schema registry and by the section itself.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });
const option = (value: string, en: string, ar: string) => ({ value, label: L(en, ar) });

export const PROMISE_BAND_KEY = 'promise-band';

/** The built-in line icons (sections/promiseIcons.tsx draws them). */
export const PROMISE_ICONS = ['book', 'mountain', 'gem', 'heart', 'leaf', 'truck', 'shield', 'gift'] as const;

const EMPTY_BAND = L('Empty = the built-in band palette.', 'فارغ = ألوان الشريط المدمجة.');

const ITEM_FIELDS: FieldDefinition[] = [
  { key: 'title', type: 'text', label: L('Title', 'العنوان'), maxLength: 80 },
  { key: 'text', type: 'textarea', label: L('Text', 'النص'), maxLength: 200 },
  {
    key: 'icon',
    type: 'select',
    label: L('Icon', 'الأيقونة'),
    defaultValue: 'book',
    options: [
      option('book', 'Open book', 'كتاب مفتوح'),
      option('mountain', 'Mountains and sun', 'جبال وشمس'),
      option('gem', 'Gem', 'جوهرة'),
      option('heart', 'Heart', 'قلب'),
      option('leaf', 'Leaf', 'ورقة نبات'),
      option('truck', 'Delivery', 'توصيل'),
      option('shield', 'Shield', 'درع'),
      option('gift', 'Gift', 'هدية'),
      option('custom', 'My own icon', 'أيقونتي الخاصة'),
    ],
  },
  {
    key: 'icon_image',
    type: 'image',
    label: L('Own icon', 'الأيقونة الخاصة'),
    description: L(
      'A small square SVG or PNG on a transparent background, drawn in your colours.',
      'ملف SVG أو PNG مربع صغير بخلفية شفافة، مرسوم بألوانك.',
    ),
    showIf: { key: 'icon', in: ['custom'] },
  },
];

const FIELDS: FieldDefinition[] = [
  { key: 'heading', type: 'text', label: L('Heading', 'العنوان'), maxLength: 80 },
  {
    key: 'items',
    type: 'repeater',
    label: L('Promises', 'الوعود'),
    maxItems: 3,
    fields: ITEM_FIELDS,
    description: L('One to three promises, side by side (stacked on phones).', 'من وعد إلى ثلاثة، جنباً إلى جنب (فوق بعضها على الهاتف).'),
  },
  { key: 'numbers', type: 'boolean', label: L('Numbers 01, 02, 03', 'الأرقام 01، 02، 03'), defaultValue: true },
  {
    key: 'bg_color',
    type: 'color',
    label: L('Background', 'الخلفية'),
    description: L('Give it the colour of the lower edge of the dawn hero above. ' + EMPTY_BAND.en, 'اجعلها بلون الحافة السفلية لواجهة الفجر أعلاه. ' + EMPTY_BAND.ar),
  },
  { key: 'text_color', type: 'color', label: L('Text colour', 'لون النص'), description: EMPTY_BAND },
  { key: 'gold_color', type: 'color', label: L('Gold (heading, horizon, icons)', 'الذهبي (العنوان، الأفق، الأيقونات)'), description: EMPTY_BAND },
  { key: 'accent_color', type: 'color', label: L('Accent (sun, hover)', 'لون التمييز (الشمس، التمرير)'), description: EMPTY_BAND },
];

export const entry: CreativeSchemaEntry = {
  schema: {
    id: PROMISE_BAND_KEY,
    label: L('Promise band', 'شريط الوعود'),
    icon: 'layout',
    category: 'content',
    description: L(
      'Up to three promises under a horizon line: the line draws itself, a small sun rises and walks along it while the page scrolls. Pairs with the dawn hero.',
      'حتى ثلاثة وعود تحت خط أفق: يُرسم الخط وتصعد شمس صغيرة وتسير عليه أثناء التمرير. يناسب واجهة الفجر.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING'],
    translatable: ['heading', 'items'],
    schema: FIELDS,
  },
  defaultSettings: { numbers: true },
  defaultContent: {
    heading: 'Our promise',
    items: [
      { title: 'A first promise', text: 'One short sentence about it.', icon: 'book' },
      { title: 'A second promise', text: 'One short sentence about it.', icon: 'mountain' },
      { title: 'A third promise', text: 'One short sentence about it.', icon: 'gem' },
    ],
  },
};
