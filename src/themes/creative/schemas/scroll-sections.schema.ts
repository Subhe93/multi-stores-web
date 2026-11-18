// Settings schemas of the scroll-driven creative sections: story-pinned, sticky-steps, motion-path and
// marquee-band, plus the two hero compositions and the travelling stage (hero-outline, hero-sunrise,
// stage-scenes). The dashboard keeps a six-locale mirror
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

// ── Hero and stage sections (hero-outline, hero-sunrise, stage-scenes) ──

const heroOutline: CreativeSchemaEntry = {
  schema: {
    id: 'hero-outline',
    label: L('Outline accent hero', 'واجهة بكلمة محدَّدة'),
    icon: 'sparkles',
    category: 'showcase',
    description: L(
      'A hero built around one photo or cut-out, with a modest outlined brand word as a quiet layer behind it.',
      'واجهة تتمحور حول صورة واحدة أو عنصر مقصوص، مع كلمة العلامة بخط محدَّد وحجم معتدل كطبقة هادئة خلفها.',
    ),
    pageTypes: [...PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'accent_text', 'cta_text', 'cta_secondary_text', 'alt', 'stats'],
    schema: [
      image('image', 'Image', 'الصورة', {
        description: L('A cut-out on a transparent background or a photo.', 'عنصر مقصوص بخلفية شفافة أو صورة.'),
      }),
      text('alt', 'Image description (alt text)', 'وصف الصورة (النص البديل)', 160, { description: ALT_HINT }),
      select('image_fit', 'Image fit', 'ملاءمة الصورة', 'contain', [
        ['contain', 'Whole image (cut-out)', 'الصورة كاملة (عنصر مقصوص)'],
        ['cover', 'Photo card', 'بطاقة صورة'],
      ]),
      select('image_focus', 'Image focus', 'تركيز الصورة', 'center', FOCUS, {
        showIf: { key: 'image_fit', in: ['cover'] },
      }),
      select('layout', 'Layout', 'التخطيط', 'center', [
        ['center', 'Image in the centre', 'الصورة في الوسط'],
        ['split', 'Split', 'مقسوم'],
      ]),
      select('height', 'Height', 'الارتفاع', 'lg', [
        ['md', 'Medium', 'متوسط'],
        ['lg', 'Tall', 'طويل'],
      ]),
      ...HEADING_TRIO(),
      ...EMPHASIS_FIELDS,
      text('accent_text', 'Accent word', 'الكلمة الزخرفية', 16, {
        description: L(
          'A short brand word shown as a quiet graphic layer. Decorative: screen readers skip it.',
          'كلمة قصيرة للعلامة تظهر كطبقة زخرفية هادئة. للزينة فقط: يتجاوزها قارئ الشاشة.',
        ),
      }),
      select('accent_style', 'Accent word style', 'نمط الكلمة الزخرفية', 'outline', [
        ['outline', 'Outline', 'محدَّدة'],
        ['faint', 'Faint', 'باهتة'],
        ['none', 'Hidden', 'مخفية'],
      ]),
      select('accent_size', 'Accent word size', 'حجم الكلمة الزخرفية', 'md', SIZE_SM_MD),
      select('accent_position', 'Accent word position', 'موضع الكلمة الزخرفية', 'behind', [
        ['behind', 'Behind the image', 'خلف الصورة'],
        ['below', 'Below the image', 'تحت الصورة'],
      ]),
      color('accent_color', 'Accent word colour', 'لون الكلمة الزخرفية', { description: EMPTY_ACCENT }),
      select('shape', 'Shape behind the image', 'شكل خلف الصورة', 'none', SHAPE_BASE),
      color('shape_color', 'Shape colour', 'لون الشكل', {
        description: L('Empty = the theme surface colour.', 'فارغ = لون السطح في الثيم.'),
      }),
      select('halo', 'Halo', 'الهالة', 'dots', [
        ['none', 'None', 'بدون'],
        ['dots', 'Dots', 'نقاط'],
        ['glow', 'Glow', 'توهّج'],
        ['rings', 'Rings', 'حلقات'],
      ]),
      color('halo_color_1', 'Halo colour 1', 'لون الهالة 1', { description: EMPTY_ACCENT }),
      color('halo_color_2', 'Halo colour 2', 'لون الهالة 2', {
        description: L('Empty = the theme secondary colour.', 'فارغ = اللون الثانوي في الثيم.'),
      }),
      repeater('stats', 'Figures', 'الأرقام', 3, [
        text('label', 'Label', 'التسمية', 24),
        text('value', 'Value', 'القيمة', 24),
      ]),
      bool('pointer_parallax', 'Follow the pointer', 'تتبّع المؤشر', true),
      bool('scroll_cue', 'Scroll cue', 'إشارة التمرير', false),
      ...sceneFields('none'),
      ...CTA_FIELDS,
    ],
  },
  defaultSettings: {
    image_fit: 'contain',
    layout: 'center',
    height: 'lg',
    heading_emphasis: 'italic',
    accent_style: 'outline',
    accent_size: 'md',
    accent_position: 'behind',
    shape: 'none',
    halo: 'dots',
    pointer_parallax: true,
    scroll_cue: false,
    scene: 'none',
    cta_tone: 'primary',
  },
  defaultContent: { heading: 'Your headline here', cta_text: 'Shop now' },
};

const heroSunrise: CreativeSchemaEntry = {
  schema: {
    id: 'hero-sunrise',
    label: L('Rising emblem hero', 'واجهة الشعار الصاعد'),
    icon: 'sparkles',
    category: 'showcase',
    description: L(
      'A hero where your own artwork rises into place on load, with an optional photo card.',
      'واجهة يصعد فيها عملك الفني إلى مكانه عند التحميل، مع بطاقة صورة اختيارية.',
    ),
    pageTypes: [...PAGE],
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text', 'alt'],
    schema: [
      image('sun_core', 'Rising artwork', 'العمل الفني الصاعد'),
      image('sun_rays', 'Rays (optional)', 'الأشعة (اختياري)', {
        description: L('Drawn behind the rising artwork.', 'تُرسم خلف العمل الفني الصاعد.'),
      }),
      image('foreground', 'Foreground (optional)', 'المقدّمة (اختياري)'),
      select(
        'foreground_mode',
        'Foreground mode',
        'نمط المقدّمة',
        'ridge',
        [
          ['ridge', 'Ridge along the bottom', 'حافة أسفل القسم'],
          ['emblem', 'Emblem (same box as the artwork)', 'شعار (نفس إطار العمل الفني)'],
        ],
        {
          description: L(
            'Emblem: export both artworks with the same square viewBox so they register exactly.',
            'شعار: صدِّر العملين بنفس إطار العرض المربع ليتطابقا تماماً.',
          ),
        },
      ),
      select('foreground_height', 'Foreground height', 'ارتفاع المقدّمة', 'md', SIZE_SM_MD, {
        showIf: { key: 'foreground_mode', in: ['ridge'] },
      }),
      select('plate', 'Plate', 'القرص الخلفي', 'none', [
        ['none', 'None', 'بدون'],
        ['disc', 'Round plate', 'قرص دائري'],
      ]),
      color('plate_color', 'Plate colour', 'لون القرص', {
        description: L('Empty = the theme surface colour.', 'فارغ = لون السطح في الثيم.'),
        showIf: { key: 'plate', in: ['disc'] },
      }),
      image('image', 'Photo (optional)', 'الصورة (اختياري)'),
      text('alt', 'Image description (alt text)', 'وصف الصورة (النص البديل)', 160, { description: ALT_HINT }),
      select('image_focus', 'Image focus', 'تركيز الصورة', 'center', FOCUS),
      select('sun_size', 'Artwork size', 'حجم العمل الفني', 'md', SIZE_SM_MD),
      select('sun_position', 'Artwork position', 'موضع العمل الفني', 'center', [
        ['start', 'Start', 'البداية'],
        ['center', 'Center', 'الوسط'],
        ['end', 'End', 'النهاية'],
        ['seam', 'On the photo corner', 'على زاوية الصورة'],
      ]),
      select('rays_motion', 'Rays motion', 'حركة الأشعة', 'rotate', [
        ['rotate', 'Slow rotation', 'دوران بطيء'],
        ['pulse', 'Pulse', 'نبض'],
        ['none', 'Still', 'ثابتة'],
      ]),
      bool('scroll_parallax', 'Move with scrolling', 'التحرّك مع التمرير', true),
      bool('glow', 'Glow', 'التوهّج', true),
      color('glow_color', 'Glow colour', 'لون التوهّج', { description: EMPTY_ACCENT }),
      select('mobile_order', 'Order on phones', 'الترتيب على الهاتف', 'image-first', [
        ['image-first', 'Image first', 'الصورة أولاً'],
        ['text-first', 'Text first', 'النص أولاً'],
      ]),
      ...HEADING_TRIO(),
      ...EMPHASIS_FIELDS,
      ...sceneFields('light'),
      ...CTA_FIELDS,
    ],
  },
  defaultSettings: {
    foreground_mode: 'ridge',
    foreground_height: 'md',
    plate: 'none',
    image_focus: 'center',
    sun_size: 'md',
    sun_position: 'center',
    rays_motion: 'rotate',
    scroll_parallax: true,
    glow: true,
    mobile_order: 'image-first',
    heading_emphasis: 'italic',
    scene: 'light',
    cta_tone: 'primary',
  },
  defaultContent: { heading: 'Your headline here', cta_text: 'Shop now' },
};

const stageScenes: CreativeSchemaEntry = {
  schema: {
    id: 'stage-scenes',
    label: L('Travelling object scenes', 'مشاهد العنصر المتنقّل'),
    icon: 'layout',
    category: 'showcase',
    description: L(
      'One cut-out stays on stage and travels, tilts and changes side while the page scrolls through colour scenes. Needs at least two scenes. Root sections only.',
      'عنصر مقصوص واحد يبقى على المسرح ويتنقّل ويميل ويبدّل جانبه أثناء تمرير الصفحة عبر مشاهد ملوّنة. يحتاج مشهدين على الأقل. للأقسام الجذرية فقط.',
    ),
    pageTypes: [...PAGE],
    translatable: ['artwork_alt', 'scenes'],
    schema: [
      image('artwork', 'Artwork', 'العمل الفني', {
        description: L(
          'A cut-out product, model or brand symbol on a transparent background.',
          'منتج أو عارض أو رمز العلامة مقصوص بخلفية شفافة.',
        ),
      }),
      text('artwork_alt', 'Artwork description (alt text)', 'وصف العمل الفني (النص البديل)', 160, {
        description: ALT_HINT,
      }),
      image('artwork_2', 'Second view (optional)', 'زاوية ثانية (اختياري)', {
        description: L('Same proportions as the first artwork.', 'بنفس أبعاد العمل الفني الأول.'),
      }),
      select('artwork_size', 'Artwork size', 'حجم العمل الفني', 'md', SIZE_SM_MD),
      select('artwork_aspect', 'Artwork proportions', 'أبعاد العمل الفني', 'portrait', [
        ['portrait', 'Portrait (3:4)', 'طولي (3:4)'],
        ['square', 'Square', 'مربع'],
      ]),
      bool('float', 'Gentle idle drift', 'انجراف هادئ عند السكون', true),
      select('scene_height', 'Scene height', 'ارتفاع المشهد', 'lg', [
        ['md', 'Medium', 'متوسط'],
        ['lg', 'Full screen', 'ملء الشاشة'],
      ]),
      image('marker_image', 'Bullet marker', 'علامة التعداد', {
        description: L('A small brand symbol; empty = an accent dot.', 'رمز صغير للعلامة؛ فارغ = نقطة بلون التمييز.'),
      }),
      ...EMPHASIS_FIELDS,
      repeater(
        'scenes',
        'Scenes',
        'المشاهد',
        5,
        [
          select('scene', 'Colour scene', 'مشهد الألوان', 'dark', SCENE_OPTIONS),
          color('scene_bg', 'Scene background', 'خلفية المشهد', { description: EMPTY_SCENE }),
          select('side', 'Artwork side', 'جانب العمل الفني', 'auto', [
            ['auto', 'Alternate', 'بالتناوب'],
            ['start', 'Start', 'البداية'],
            ['end', 'End', 'النهاية'],
          ]),
          select('tilt', 'Tilt', 'الميلان', 'soft', [
            ['none', 'None', 'بدون'],
            ['soft', 'Soft', 'خفيف'],
            ['strong', 'Strong', 'قوي'],
          ]),
          select('scale', 'Artwork scale', 'مقياس العمل الفني', 'md', SIZE_SM_MD),
          select('view', 'View', 'الزاوية', '1', [
            ['1', 'First', 'الأولى'],
            ['2', 'Second', 'الثانية'],
          ]),
          select('shape', 'Shape behind the artwork', 'شكل خلف العمل الفني', 'none', [
            ...SHAPE_BASE,
            ['blob', 'Blob', 'شكل حرّ'],
          ]),
          color('shape_color', 'Shape colour', 'لون الشكل', {
            description: L("Empty = the scene's surface colour.", 'فارغ = لون سطح المشهد.'),
          }),
          select('pattern', 'Pattern', 'النقش', 'none', [
            ['none', 'None', 'بدون'],
            ['dots', 'Dots', 'نقاط'],
            ['particles', 'Particles', 'جزيئات'],
          ]),
          text('eyebrow', 'Eyebrow', 'السطر التمهيدي', 60),
          area('heading', 'Heading', 'العنوان', 120),
          text('lead', 'Lead line', 'السطر الافتتاحي', 160),
          area('text', 'Text', 'النص', 400),
          text('chips', 'Chips (comma separated)', 'الوسوم (مفصولة بفواصل)', 80),
          area('bullets', 'Bullets (one per line)', 'النقاط (واحدة في كل سطر)', 300),
          text('cta_text', 'Button text', 'نص الزر', 40),
          url('cta_url', 'Button URL', 'رابط الزر'),
          text('cta_secondary_text', 'Second button text', 'نص الزر الثاني', 40),
          url('cta_secondary_url', 'Second button URL', 'رابط الزر الثاني'),
        ],
        {
          description: L('Two to five scenes.', 'من مشهدين إلى خمسة مشاهد.'),
        },
      ),
    ],
  },
  defaultSettings: {
    artwork_size: 'md',
    artwork_aspect: 'portrait',
    float: true,
    scene_height: 'lg',
    heading_emphasis: 'italic',
  },
  defaultContent: { scenes: [] },
};

export const HERO_SCHEMAS = {
  'hero-outline': heroOutline,
  'hero-sunrise': heroSunrise,
  'stage-scenes': stageScenes,
} as const;

export const SCROLL_SCHEMAS = {
  'story-pinned': storyPinned,
  'sticky-steps': stickySteps,
  'motion-path': motionPath,
  'marquee-band': marqueeBand,
} as const;
