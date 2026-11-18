// Settings schema of "impact-arc": a goal drawn as a half circle over a
// horizon, whose filled part is the reached figure, with up to three steps
// under it. The dashboard keeps a six-locale mirror
// (multi-stores-dashboard/src/lib/creative-sections/impact-arc.ts): same
// keys, order, types, limits and defaults.
//
// Self-contained on purpose: only types are imported, so this file never
// takes part in an import cycle with ../schemas.

import type { FieldDefinition, LocalizedString, SectionSchema } from '../../types';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });

type Extra = Partial<Pick<FieldDefinition, 'description' | 'min' | 'max' | 'defaultValue'>>;

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
const simple = (
  type: 'image' | 'url' | 'color' | 'number',
  key: string,
  en: string,
  ar: string,
  extra: Extra = {},
): FieldDefinition => ({ key, type, label: L(en, ar), ...extra });

const EMPTY_BACKGROUND = L('Empty = the theme background colour.', 'فارغ = لون الخلفية في الثيم.');
const EMPTY_TEXT = L('Empty = the theme text colour.', 'فارغ = لون النص في الثيم.');
const EMPTY_ACCENT = L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.');

const STEP_FIELDS: FieldDefinition[] = [
  text('title', 'Title', 'العنوان', 50),
  area('text', 'Text', 'النص', 120),
];

export const IMPACT_ARC_MAX_STEPS = 3;

const schema: SectionSchema = {
  id: 'impact-arc',
  label: L('Impact arc', 'قوس الأثر'),
  icon: 'sunrise',
  category: 'content',
  description: L(
    'A goal drawn as an arc over a horizon: the filled part is the figure you reached, with up to three steps under it.',
    'هدف مرسوم كقوس فوق أفق: الجزء المملوء هو الرقم الذي تحقّق، وتحته حتى ثلاث خطوات.',
  ),
  pageTypes: ['HOME', 'STATIC', 'LANDING'],
  translatable: [
    'eyebrow',
    'heading',
    'body',
    'status_label',
    'unit_label',
    'item_title',
    'item_meta',
    'note',
    'cta_text',
    'steps',
  ],
  schema: [
    // Content
    text('eyebrow', 'Eyebrow', 'العنوان التمهيدي', 60),
    area('heading', 'Heading', 'العنوان', 100),
    area('body', 'Text', 'النص', 320),
    text('status_label', 'Status label', 'تسمية الحالة', 30, {
      description: L('The word shown in the small pill, e.g. Planned.', 'الكلمة الظاهرة في الشارة الصغيرة، مثل: مخطَّط.'),
    }),
    text('unit_label', 'Unit', 'الوحدة', 60, {
      description: L('What the number counts.', 'ما الذي يعدّه الرقم.'),
    }),
    text('item_title', 'Name', 'الاسم', 100),
    text('item_meta', 'Detail', 'تفصيل', 60, {
      description: L('A place or a date.', 'مكان أو تاريخ.'),
    }),
    area('note', 'Note', 'ملاحظة', 200),
    text('cta_text', 'Button text', 'نص الزر', 40),
    {
      key: 'steps',
      type: 'repeater',
      label: L('Steps', 'الخطوات'),
      maxItems: IMPACT_ARC_MAX_STEPS,
      fields: STEP_FIELDS,
    },
    // Settings
    simple('number', 'goal', 'Goal', 'الهدف', {
      min: 1,
      description: L('Needed for the arc. Without it only the steps are shown.', 'مطلوب لرسم القوس. بدونه تظهر الخطوات فقط.'),
    }),
    simple('number', 'reached', 'Reached', 'ما تحقّق', {
      min: 0,
      description: L(
        'Enter verified figures only. Empty = the planned state (a dashed arc, no progress).',
        'أدخل الأرقام الموثَّقة فقط. فارغ = حالة التخطيط (قوس متقطّع بلا تقدّم).',
      ),
    }),
    {
      key: 'status',
      type: 'select',
      label: L('Status', 'الحالة'),
      defaultValue: 'planned',
      options: [
        { value: 'planned', label: L('Planned', 'مخطَّط') },
        { value: 'active', label: L('In progress', 'قيد التنفيذ') },
        { value: 'completed', label: L('Completed', 'مكتمل') },
      ],
    },
    simple('image', 'horizon_image', 'Horizon artwork', 'رسمة الأفق', {
      description: L(
        'A wide line or silhouette (SVG or PNG) that sits on the horizon. Never mirrored.',
        'خط أو ظلّ عريض (SVG أو PNG) يستقر على الأفق. لا يُعكس أبداً.',
      ),
    }),
    simple('image', 'marker_image', 'Marker', 'العلامة', {
      description: L('A small mark on the arc at the reached point. Empty = a plain disc.', 'علامة صغيرة على القوس عند نقطة التقدّم. فارغ = قرص بسيط.'),
    }),
    simple('url', 'cta_url', 'Button link', 'رابط الزر'),
    simple('color', 'bg_color', 'Background colour', 'لون الخلفية', { description: EMPTY_BACKGROUND }),
    simple('color', 'text_color', 'Text colour', 'لون النص', { description: EMPTY_TEXT }),
    simple('color', 'arc_color', 'Arc colour', 'لون القوس', { description: EMPTY_ACCENT }),
  ],
};

/** Same shape as CreativeSchemaEntry (schemaKit); structural, so no import is needed. */
export const entry: {
  schema: SectionSchema;
  defaultSettings: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
} = {
  schema,
  defaultSettings: { status: 'planned' },
  defaultContent: {},
};
