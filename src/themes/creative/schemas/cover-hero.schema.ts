// Settings schema of "cover-hero": the first screen composed like the cover
// of a printed issue (masthead rule, an offset pair of photographs, a caption
// that sells the piece in the small photograph). The dashboard mirror lives
// in multi-stores-dashboard/src/lib/creative-sections/cover-hero.ts (same
// keys, order, types, options and defaults, with six-locale labels).
//
// Type-only imports: schemas.ts imports this file, so nothing of it may be
// needed at run time here.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

type Option = [value: string, en: string, ar: string];
type Extra = Partial<Pick<FieldDefinition, 'description' | 'required'>>;

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

const text = (key: string, en: string, ar: string, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'text',
  label: L(en, ar),
  maxLength,
  ...extra,
});
const area = (key: string, en: string, ar: string, maxLength: number, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'textarea',
  label: L(en, ar),
  maxLength,
  ...extra,
});
const image = (key: string, en: string, ar: string, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'image',
  label: L(en, ar),
  ...extra,
});
const url = (key: string, en: string, ar: string, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'url',
  label: L(en, ar),
  ...extra,
});
const color = (key: string, en: string, ar: string, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'color',
  label: L(en, ar),
  ...extra,
});
const select = (
  key: string,
  en: string,
  ar: string,
  defaultValue: string,
  options: Option[],
  extra: Extra = {},
): FieldDefinition => ({
  key,
  type: 'select',
  label: L(en, ar),
  defaultValue,
  options: options.map(([value, oen, oar]) => ({ value, label: L(oen, oar) })),
  ...extra,
});

/** Content keys, in schema order (per-locale texts). */
export const COVER_HERO_TRANSLATABLE = [
  'masthead_start',
  'masthead_center',
  'masthead_end',
  'eyebrow',
  'heading',
  'subheading',
  'cta_text',
  'cta_secondary_text',
  'detail_label',
  'detail_title',
  'alt',
  'detail_alt',
] as const;

export const entry: CreativeSchemaEntry = {
  schema: {
    id: 'cover-hero',
    label: L('Cover hero', 'غلاف العدد'),
    icon: 'layout-template',
    // The palette has no "hero" category: heroes live under "showcase".
    category: 'showcase',
    description: L(
      'A first screen composed like the cover of a printed issue: a masthead line, two photographs of different sizes and a caption that links to the product in the small one.',
      'شاشة أولى مركّبة كغلاف مجلة مطبوعة: سطر ترويسة، صورتان بحجمين مختلفين، وتعليق يقود إلى المنتج الظاهر في الصورة الصغيرة.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING'],
    translatable: [...COVER_HERO_TRANSLATABLE],
    schema: [
      // ── Content ──
      text('masthead_start', 'Masthead, start', 'الترويسة، البداية', 40),
      text('masthead_center', 'Masthead, centre', 'الترويسة، الوسط', 60, {
        description: L(
          'On phones only this label is shown (or the start label when this one is empty).',
          'على الهاتف يظهر هذا النص فقط (أو نص البداية إن كان فارغاً).',
        ),
      }),
      text('masthead_end', 'Masthead, end', 'الترويسة، النهاية', 40),
      text('eyebrow', 'Eyebrow', 'النص العلوي', 60),
      area('heading', 'Heading', 'العنوان', 120, {
        required: true,
        description: L('A new line starts a new line of the heading.', 'السطر الجديد يبدأ سطراً جديداً في العنوان.'),
      }),
      area('subheading', 'Subheading', 'العنوان الفرعي', 280),
      text('cta_text', 'Button text', 'نص الزر', 40),
      text('cta_secondary_text', 'Second button text', 'نص الزر الثاني', 40),
      text('detail_label', 'Caption label', 'عنوان التعليق', 40),
      text('detail_title', 'Caption title', 'نص التعليق', 80, {
        description: L(
          'Empty = the title of the linked product. The price always comes from the product.',
          'فارغ = اسم المنتج المرتبط. السعر يأتي دائماً من المنتج.',
        ),
      }),
      text('alt', 'Large photograph, alt text', 'النص البديل للصورة الكبيرة', 160),
      text('detail_alt', 'Small photograph, alt text', 'النص البديل للصورة الصغيرة', 160),
      // ── Settings ──
      image('image', 'Large photograph', 'الصورة الكبيرة'),
      select('image_focus_x', 'Photograph focus, horizontal', 'تركيز الصورة أفقياً', 'center', [
        ['left', 'Left', 'يسار'],
        ['center', 'Centre', 'وسط'],
        ['right', 'Right', 'يمين'],
      ]),
      select('image_focus_y', 'Photograph focus, vertical', 'تركيز الصورة عمودياً', 'top', [
        ['top', 'Top', 'أعلى'],
        ['center', 'Centre', 'وسط'],
        ['bottom', 'Bottom', 'أسفل'],
      ]),
      image('detail_image', 'Small photograph', 'الصورة الصغيرة'),
      url('detail_url', 'Caption link (product)', 'رابط التعليق (منتج)', {
        description: L(
          'A product link (/products/…) shows its title and live price in the caption.',
          'رابط منتج (‎/products/…) يُظهر اسمه وسعره الحالي في التعليق.',
        ),
      }),
      image('seal_image', 'Seal (symbol on the masthead line)', 'الختم (رمز على خط الترويسة)'),
      select('seal_size', 'Seal size', 'حجم الختم', 'md', [
        ['sm', 'Small', 'صغير'],
        ['md', 'Medium', 'متوسط'],
      ]),
      image('edge_image', 'Woven edge (narrow tile)', 'الحاشية المنسوجة (بلاطة ضيقة)', {
        description: L(
          'A narrow tile repeated along the edge of the large photograph. Empty = no edge.',
          'بلاطة ضيقة تتكرر على حافة الصورة الكبيرة. فارغ = بلا حاشية.',
        ),
      }),
      url('cta_url', 'Button link', 'رابط الزر'),
      url('cta_secondary_url', 'Second button link', 'رابط الزر الثاني'),
      select('cta_tone', 'Button colour', 'لون الزر', 'accent', [
        ['accent', 'Accent', 'لون التمييز'],
        ['primary', 'Primary', 'اللون الأساسي'],
      ]),
      select('heading_level', 'Heading level', 'مستوى العنوان', 'h1', [
        ['h1', 'H1', 'H1'],
        ['h2', 'H2', 'H2'],
      ]),
      select('mobile_order', 'Order on phones', 'الترتيب على الهاتف', 'image-first', [
        ['image-first', 'Photographs first', 'الصور أولاً'],
        ['text-first', 'Text first', 'النص أولاً'],
      ]),
      color('bg_color', 'Background colour', 'لون الخلفية', {
        description: L('Empty = the theme surface colour.', 'فارغ = لون السطح في الثيم.'),
      }),
      color('text_color', 'Text colour', 'لون النص', {
        description: L('Empty = the theme text colour.', 'فارغ = لون النص في الثيم.'),
      }),
      color('accent_color', 'Accent colour', 'لون التمييز', {
        description: L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.'),
      }),
    ],
  },
  defaultSettings: {
    image_focus_x: 'center',
    image_focus_y: 'top',
    seal_size: 'md',
    cta_tone: 'accent',
    heading_level: 'h1',
    mobile_order: 'image-first',
  },
  // No brand words in the defaults.
  defaultContent: {},
};
