// Settings schemas of the scroll-driven creative sections: story-pinned, sticky-steps, motion-path and
// marquee-band. The dashboard keeps a six-locale mirror
// (multi-stores-dashboard/src/lib/creative-sections/*.ts): same keys, order,
// types, options and defaults; creative.contract.test.tsx compares the two.
//
// Owner decision: every size of a decorative word, numeral, marquee text or
// travelling artwork offers `sm` / `md` only, default `md`.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

// ── Compact field builders ──────────────────────────────────────────────

type Extra = Partial<Pick<FieldDefinition, 'description' | 'showIf' | 'maxItems'>>;
type Option = [value: string, en: string, ar: string];

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
const color = (key: string, en: string, ar: string, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'color',
  label: L(en, ar),
  ...extra,
});
const url = (key: string, en: string, ar: string): FieldDefinition => ({ key, type: 'url', label: L(en, ar) });
const bool = (key: string, en: string, ar: string, defaultValue: boolean, extra: Extra = {}): FieldDefinition => ({
  key,
  type: 'boolean',
  label: L(en, ar),
  defaultValue,
  ...extra,
});
const num = (
  key: string,
  en: string,
  ar: string,
  defaultValue: number,
  min: number,
  max: number,
  extra: Extra = {},
): FieldDefinition => ({ key, type: 'number', label: L(en, ar), defaultValue, min, max, ...extra });
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
const repeater = (
  key: string,
  en: string,
  ar: string,
  maxItems: number,
  fields: FieldDefinition[],
  extra: Extra = {},
): FieldDefinition => ({ key, type: 'repeater', label: L(en, ar), maxItems, fields, ...extra });

// ── Shared option lists ─────────────────────────────────────────────────

const SIZE_SM_MD: Option[] = [
  ['sm', 'Small', 'صغير'],
  ['md', 'Medium', 'متوسط'],
];
const FOCUS: Option[] = [
  ['center', 'Center', 'الوسط'],
  ['top', 'Top', 'الأعلى'],
  ['bottom', 'Bottom', 'الأسفل'],
];
const SCENE_OPTIONS: Option[] = [
  ['dark', 'Dark', 'داكن'],
  ['light', 'Light', 'فاتح'],
  ['accent', 'Accent colour', 'لون التمييز'],
];
const SHAPE_BASE: Option[] = [
  ['none', 'None', 'بدون'],
  ['circle', 'Circle', 'دائرة'],
  ['arch', 'Arch', 'قوس'],
];

const EMPTY_ACCENT = L('Empty = the theme accent colour.', 'فارغ = لون التمييز في الثيم.');
const EMPTY_SCENE = L("Empty = the scene's own colour.", 'فارغ = لون المشهد نفسه.');
const ALT_HINT = L('Leave empty when the image is decorative.', 'اتركه فارغاً إذا كانت الصورة للزينة فقط.');

// ── Shared field groups ─────────────────────────────────────────────────

/** SCENE: colour theme of the section (passed to CxSection). */
const sceneFields = (defaultValue: 'none' | 'dark' | 'light' | 'accent'): FieldDefinition[] => [
  select(
    'scene',
    'Colour scene',
    'مشهد الألوان',
    defaultValue,
    [['none', 'None (page colours)', 'بدون (ألوان الصفحة)'], ...SCENE_OPTIONS],
    {
      description: L(
        'Gives the section its own background and text colours, taken from the theme.',
        'يمنح القسم خلفية وألوان نص خاصة به مأخوذة من الثيم.',
      ),
    },
  ),
  color('scene_bg', 'Scene background', 'خلفية المشهد', { description: EMPTY_SCENE }),
  color('scene_text', 'Scene text colour', 'لون نص المشهد', { description: EMPTY_SCENE }),
  color('scene_accent', 'Scene accent colour', 'لون تمييز المشهد', { description: EMPTY_SCENE }),
];

/** EMPHASIS: the `*phrase*` marked in the heading text. */
const EMPHASIS_FIELDS: FieldDefinition[] = [
  select(
    'heading_emphasis',
    'Accent phrase',
    'العبارة المميَّزة',
    'italic',
    [
      ['none', 'None', 'بدون'],
      ['color', 'Accent colour', 'لون التمييز'],
      ['italic', 'Italic in accent colour', 'مائل بلون التمييز'],
    ],
    {
      description: L(
        'Wrap a phrase of the heading in asterisks to accent it: More than *just a drink*. One phrase per line. Arabic text is coloured, never slanted.',
        'ضع عبارة من العنوان بين نجمتين لتمييزها: أكثر من *مجرد مشروب*. عبارة واحدة في كل سطر. النص العربي يُلوَّن ولا يُمال.',
      ),
    },
  ),
  color('heading_emphasis_color', 'Accent phrase colour', 'لون العبارة المميَّزة', {
    description: EMPTY_ACCENT,
    showIf: { key: 'heading_emphasis', in: ['color', 'italic'] },
  }),
];

/** CTA: two pill buttons (the second one outlined). */
const CTA_FIELDS: FieldDefinition[] = [
  text('cta_text', 'Button text', 'نص الزر', 40),
  text('cta_secondary_text', 'Second button text', 'نص الزر الثاني', 40),
  url('cta_url', 'Button URL', 'رابط الزر'),
  url('cta_secondary_url', 'Second button URL', 'رابط الزر الثاني'),
  select('cta_tone', 'Button colour', 'لون الزر', 'primary', [
    ['primary', 'Primary', 'أساسي'],
    ['accent', 'Accent', 'تمييز'],
  ]),
];

const HEADING_TRIO = (headingMax = 120): FieldDefinition[] => [
  text('eyebrow', 'Eyebrow', 'السطر التمهيدي', 60),
  area('heading', 'Heading', 'العنوان', headingMax),
  area('subheading', 'Subheading', 'العنوان الفرعي', 280),
];

// ── Definitions ─────────────────────────────────────────────────────────


const PAGE = ['HOME', 'STATIC', 'LANDING'] as const;
const PAGE_AND_FOOTER = ['HOME', 'STATIC', 'LANDING', 'FOOTER'] as const;


const storyPinned: CreativeSchemaEntry = {
  schema: {
    id: 'story-pinned',
    label: L('Pinned story', 'قصة مثبّتة'),
    icon: 'gallery',
    category: 'content',
    description: L(
      'A row of cards that moves sideways while the section stays in place. On phones it is a normal swipe row. Use it once per page.',
      'صف بطاقات يتحرّك أفقياً بينما يبقى القسم في مكانه. على الهاتف يصبح صفاً يُسحب بالإصبع. استخدمه مرة واحدة في الصفحة.',
    ),
    pageTypes: [...PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'items'],
    schema: [
      ...HEADING_TRIO(),
      ...EMPHASIS_FIELDS,
      repeater('items', 'Cards', 'البطاقات', 8, [
        image('image', 'Image', 'الصورة'),
        text('image_alt', 'Image description (alt text)', 'وصف الصورة (النص البديل)', 160),
        image('icon', 'Icon', 'الأيقونة'),
        text('label', 'Label', 'التسمية', 24),
        text('title', 'Title', 'العنوان', 80),
        area('text', 'Text', 'النص', 240),
        text('cta_text', 'Link text', 'نص الرابط', 40),
        url('cta_url', 'Link URL', 'عنوان الرابط'),
      ]),
      select('card_style', 'Card style', 'نمط البطاقة', 'editorial', [
        ['editorial', 'Photo above text', 'صورة فوق النص'],
        ['overlay', 'Text over photo', 'نص فوق الصورة'],
        ['panel', 'Panel (no photo)', 'لوحة (بدون صورة)'],
      ]),
      select('card_width', 'Card width', 'عرض البطاقة', 'md', [
        ['sm', 'Small', 'صغير'],
        ['md', 'Medium', 'متوسط'],
        ['lg', 'Large', 'كبير'],
      ]),
      select('image_aspect', 'Image proportions', 'أبعاد الصورة', 'portrait', [
        ['portrait', 'Portrait', 'طولي'],
        ['square', 'Square', 'مربع'],
        ['landscape', 'Landscape', 'عرضي'],
      ]),
      select('numerals', 'Numerals', 'الأرقام', 'small', [
        ['none', 'None', 'بدون'],
        ['small', 'Small', 'صغيرة'],
        ['outline', 'Outlined', 'محدَّدة'],
      ]),
      select('progress', 'Progress', 'مؤشر التقدّم', 'bar', [
        ['bar', 'Bar', 'شريط'],
        ['counter', 'Counter', 'عدّاد'],
        ['both', 'Bar and counter', 'شريط وعدّاد'],
        ['none', 'None', 'بدون'],
      ]),
      bool('hint', '"Keep scrolling" hint', 'تلميح «واصل التمرير»', true),
      select('heading_position', 'Heading position', 'موضع العنوان', 'above', [
        ['above', 'Above the row', 'فوق الصف'],
        ['start', 'First item of the row', 'أول عنصر في الصف'],
      ]),
      select('mobile_layout', 'Layout on phones', 'التخطيط على الهاتف', 'swipe', [
        ['swipe', 'Swipe row', 'صف يُسحب'],
        ['stack', 'Stack', 'عمودي'],
      ]),
      color('accent_color', 'Accent colour', 'لون التمييز', { description: EMPTY_ACCENT }),
      ...sceneFields('none'),
    ],
  },
  defaultSettings: {
    heading_emphasis: 'italic',
    card_style: 'editorial',
    card_width: 'md',
    image_aspect: 'portrait',
    numerals: 'small',
    progress: 'bar',
    hint: true,
    heading_position: 'above',
    mobile_layout: 'swipe',
    scene: 'none',
  },
  defaultContent: { heading: 'Our story' },
};

const stickySteps: CreativeSchemaEntry = {
  schema: {
    id: 'sticky-steps',
    label: L('Sticky steps', 'خطوات مع عنوان ثابت'),
    icon: 'list-ordered',
    category: 'content',
    description: L(
      'A heading that stays in view beside a numbered list of steps with a progress line.',
      'عنوان يبقى ظاهراً بجانب قائمة خطوات مرقّمة مع خط تقدّم.',
    ),
    pageTypes: [...PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'items'],
    schema: [
      ...HEADING_TRIO(),
      ...EMPHASIS_FIELDS,
      repeater('items', 'Steps', 'الخطوات', 8, [
        text('title', 'Title', 'العنوان', 80),
        area('text', 'Text', 'النص', 240),
      ]),
      select('numeral_style', 'Numeral style', 'نمط الأرقام', 'outline', [
        ['outline', 'Outlined', 'محدَّدة'],
        ['solid', 'Solid', 'مصمتة'],
        ['none', 'None', 'بدون'],
      ]),
      select('numeral_size', 'Numeral size', 'حجم الأرقام', 'md', SIZE_SM_MD),
      bool('progress_line', 'Progress line', 'خط التقدّم', true),
      select('heading_side', 'Heading side', 'جانب العنوان', 'start', [
        ['start', 'Start', 'البداية'],
        ['end', 'End', 'النهاية'],
      ]),
      select('spacing', 'Spacing', 'التباعد', 'md', [
        ['sm', 'Compact', 'متقارب'],
        ['md', 'Roomy', 'واسع'],
      ]),
      color('accent_color', 'Accent colour', 'لون التمييز', { description: EMPTY_ACCENT }),
      text('cta_text', 'Button text', 'نص الزر', 40),
      url('cta_url', 'Button URL', 'رابط الزر'),
      ...sceneFields('none'),
    ],
  },
  defaultSettings: {
    heading_emphasis: 'italic',
    numeral_style: 'outline',
    numeral_size: 'md',
    progress_line: true,
    heading_side: 'start',
    spacing: 'md',
    scene: 'none',
  },
  defaultContent: { heading: 'How it works' },
};

const motionPath: CreativeSchemaEntry = {
  schema: {
    id: 'motion-path',
    label: L('Journey path', 'مسار الرحلة'),
    icon: 'map-pin',
    category: 'content',
    description: L(
      'Stops along a drawn line; a small artwork travels down the line as the page scrolls.',
      'محطات على خط مرسوم؛ عمل فني صغير ينتقل على الخط أثناء تمرير الصفحة.',
    ),
    pageTypes: [...PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'stops'],
    schema: [
      ...HEADING_TRIO(),
      ...EMPHASIS_FIELDS,
      select('heading_position', 'Heading position', 'موضع العنوان', 'above', [
        ['above', 'Above the path', 'فوق المسار'],
        ['sticky', 'Sticky beside the path', 'ثابت بجانب المسار'],
      ]),
      repeater('stops', 'Stops', 'المحطات', 7, [
        text('label', 'Label', 'التسمية', 24),
        text('title', 'Title', 'العنوان', 80),
        area('text', 'Text', 'النص', 200),
        image('image', 'Image', 'الصورة'),
        text('image_alt', 'Image description (alt text)', 'وصف الصورة (النص البديل)', 160),
        text('cta_text', 'Link text', 'نص الرابط', 40),
        url('cta_url', 'Link URL', 'عنوان الرابط'),
      ]),
      image('artwork', 'Travelling artwork', 'العمل الفني المتنقّل'),
      select('artwork_size', 'Artwork size', 'حجم العمل الفني', 'md', SIZE_SM_MD),
      bool('artwork_rotate', 'Turn with the path', 'الدوران مع المسار', false),
      bool('artwork_flip_rtl', 'Mirror in right-to-left', 'عكس الاتجاه في العربية', false, {
        description: L(
          'For a vehicle or an arrow. Never for artwork that contains text.',
          'لمركبة أو سهم. لا تستخدمه مع عمل فني يحتوي نصاً.',
        ),
      }),
      select('path_shape', 'Path shape', 'شكل المسار', 'wave', [
        ['wave', 'Wave', 'متموّج'],
        ['zigzag', 'Zigzag', 'متعرّج'],
        ['straight', 'Straight', 'مستقيم'],
      ]),
      select('path_style', 'Path style', 'نمط المسار', 'line', [
        ['line', 'Line', 'خط'],
        ['dashed', 'Dashed', 'متقطّع'],
        ['band', 'Band', 'شريط'],
      ]),
      color('path_color', 'Path colour', 'لون المسار', {
        description: L('Empty = the theme border colour.', 'فارغ = لون الحدود في الثيم.'),
      }),
      color('trail_color', 'Trail colour', 'لون الأثر', { description: EMPTY_ACCENT }),
      color('marker_color', 'Marker colour', 'لون العلامات', { description: EMPTY_ACCENT }),
      select('cards_side', 'Cards', 'البطاقات', 'alternate', [
        ['alternate', 'Alternate sides', 'بالتناوب على الجانبين'],
        ['one-side', 'One side', 'جانب واحد'],
      ]),
      ...sceneFields('none'),
    ],
  },
  defaultSettings: {
    heading_emphasis: 'italic',
    heading_position: 'above',
    artwork_size: 'md',
    artwork_rotate: false,
    artwork_flip_rtl: false,
    path_shape: 'wave',
    path_style: 'line',
    cards_side: 'alternate',
    scene: 'none',
  },
  defaultContent: { heading: 'How it works' },
};

const marqueeBand: CreativeSchemaEntry = {
  schema: {
    id: 'marquee-band',
    label: L('Marquee band', 'شريط متحرّك'),
    icon: 'megaphone',
    category: 'showcase',
    description: L(
      'One or two rows of words, chips or cards that glide past, with your symbol as the separator. No JavaScript.',
      'صف أو صفان من الكلمات أو الوسوم أو البطاقات تنساب أفقياً، ورمزك فاصل بينها. بدون جافاسكربت.',
    ),
    pageTypes: [...PAGE_AND_FOOTER],
    translatable: ['heading', 'items'],
    schema: [
      text('heading', 'Label above', 'تسمية أعلى الشريط', 80),
      repeater('items', 'Items', 'العناصر', 16, [
        text('text', 'Text', 'النص', 60),
        image('image', 'Image', 'الصورة'),
        text('image_alt', 'Image description (alt text)', 'وصف الصورة (النص البديل)', 160),
        url('url', 'Link URL', 'عنوان الرابط'),
      ]),
      select('rows', 'Rows', 'الصفوف', '2', [
        ['1', 'One', 'صف واحد'],
        ['2', 'Two (opposite directions)', 'صفان (باتجاهين متعاكسين)'],
      ]),
      select('item_style', 'Item style', 'نمط العنصر', 'text', [
        ['text', 'Text', 'نص'],
        ['pill', 'Pill', 'وسم مستدير'],
        ['card', 'Card', 'بطاقة'],
      ]),
      select('size', 'Text size', 'حجم النص', 'md', SIZE_SM_MD),
      select(
        'text_style',
        'Text style',
        'نمط النص',
        'solid',
        [
          ['solid', 'Solid', 'مصمت'],
          ['outline', 'Outlined', 'محدَّد'],
          ['mixed', 'Alternating', 'بالتناوب'],
        ],
        {
          description: L('Arabic text is always solid.', 'النص العربي يبقى مصمتاً دائماً.'),
        },
      ),
      {
        ...text('separator', 'Separator', 'الفاصل', 3),
        defaultValue: '•',
      },
      image('separator_image', 'Separator symbol', 'رمز الفاصل', {
        description: L('Your brand symbol, drawn small between the items.', 'رمز علامتك، يُرسم صغيراً بين العناصر.'),
      }),
      select('speed', 'Speed', 'السرعة', 'slow', [
        ['slow', 'Slow', 'بطيء'],
        ['normal', 'Normal', 'عادي'],
        ['fast', 'Fast', 'سريع'],
      ]),
      bool('edge_fade', 'Fade at the edges', 'تلاشٍ عند الأطراف', true),
      bool('grayscale_images', 'Greyscale images', 'صور بالأبيض والأسود', false),
      color('text_color', 'Text colour', 'لون النص'),
      color('border_color', 'Border colour', 'لون الحدود'),
      ...sceneFields('none'),
    ],
  },
  defaultSettings: {
    rows: '2',
    item_style: 'text',
    size: 'md',
    text_style: 'solid',
    separator: '•',
    speed: 'slow',
    edge_fade: true,
    grayscale_images: false,
    scene: 'none',
  },
  defaultContent: { items: [] },
};

export const SCROLL_SCHEMAS = {
  'story-pinned': storyPinned,
  'sticky-steps': stickySteps,
  'motion-path': motionPath,
  'marquee-band': marqueeBand,
} as const;
