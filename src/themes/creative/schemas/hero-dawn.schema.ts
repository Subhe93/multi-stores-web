// Settings schema of "hero-dawn": a night sky turning into dawn, a sun that
// rises behind a ridge, an arch photograph, an optional photo card and the
// copy. The dashboard keeps a six-locale mirror
// (multi-stores-dashboard/src/lib/creative-sections/hero-dawn.ts): same keys,
// order, types, options and defaults; creative.contract.test.tsx compares the
// two.
//
// Self-contained on purpose (plain field literals, type-only imports): this
// file is imported by the schema registry and by the section itself.

import type { FieldDefinition, LocalizedString } from '../../types';
import type { CreativeSchemaEntry } from '../schemas';

const L = (en: string, ar: string): LocalizedString => ({ en, ar });
const option = (value: string, en: string, ar: string) => ({ value, label: L(en, ar) });

export const HERO_DAWN_KEY = 'hero-dawn';

const ALT_HINT = L('Leave empty when the image is decorative.', 'اتركه فارغاً إذا كانت الصورة للزينة فقط.');
const EMPTY_DAWN = L('Empty = the built-in dawn palette.', 'فارغ = ألوان الفجر المدمجة.');
const LAYER_BOX = L(
  'Same square artboard as the other sun layers, the sun centred.',
  'نفس لوحة الرسم المربعة لطبقات الشمس الأخرى، والشمس في المنتصف.',
);

const FIELDS: FieldDefinition[] = [
  {
    key: 'arch_image',
    type: 'image',
    label: L('Arch photo', 'صورة القوس'),
    description: L(
      'The large photo in the arch in front of the sun. Portrait, at least 900 px wide.',
      'الصورة الكبيرة داخل القوس أمام الشمس. طولية، بعرض 900 بكسل على الأقل.',
    ),
  },
  { key: 'arch_alt', type: 'text', label: L('Arch photo description (alt text)', 'وصف صورة القوس (النص البديل)'), maxLength: 160, description: ALT_HINT },
  { key: 'card', type: 'boolean', label: L('Small photo card', 'بطاقة الصورة الصغيرة'), defaultValue: true },
  {
    key: 'card_image',
    type: 'image',
    label: L('Card photo', 'صورة البطاقة'),
    description: L('Portrait (4:5). It is toned into the night colours.', 'طولية (4:5). تُلوَّن بألوان الليل.'),
  },
  { key: 'card_alt', type: 'text', label: L('Card photo description (alt text)', 'وصف صورة البطاقة (النص البديل)'), maxLength: 160, description: ALT_HINT },
  {
    key: 'emblem',
    type: 'image',
    label: L('Sun emblem', 'شعار الشمس'),
    description: L(
      'Your sun or logo with its rays as one file (SVG or PNG on a transparent, square artboard, the sun centred). It rises and opens as one piece. Empty = the built-in sun. For the full motion upload the layers below instead.',
      'شمسك أو شعارك مع أشعته في ملف واحد (SVG أو PNG بخلفية شفافة ولوحة مربعة، والشمس في المنتصف). يصعد ويتفتّح كقطعة واحدة. فارغ = الشمس المدمجة. للحركة الكاملة ارفع الطبقات أدناه بدلاً منه.',
    ),
  },
  {
    key: 'emblem_rays',
    type: 'image',
    label: L('Sun layer: rays (optional)', 'طبقة الشمس: الأشعة (اختياري)'),
    description: L(
      'Only the rays. They open, turn slowly and fade towards their tips; the inner 56 % of the radius stays clear for the disc. ' +
        'Same square artboard as the other sun layers, the sun centred. Any layer replaces the single emblem above.',
      'الأشعة فقط. تتفتّح وتدور ببطء وتخفت نحو أطرافها، ويبقى 56٪ من نصف القطر الداخلي فارغاً للقرص. ' +
        'نفس لوحة الرسم المربعة لطبقات الشمس الأخرى، والشمس في المنتصف. أي طبقة تحلّ محلّ الشعار الواحد أعلاه.',
    ),
  },
  {
    key: 'emblem_disc',
    type: 'image',
    label: L('Sun layer: disc (optional)', 'طبقة الشمس: القرص (اختياري)'),
    description: L(
      'The disc of the sun, its radius 28 % of the artboard width. Empty = a round disc in the gold colour. ' + LAYER_BOX.en,
      'قرص الشمس، نصف قطره 28٪ من عرض لوحة الرسم. فارغ = قرص دائري باللون الذهبي. ' + LAYER_BOX.ar,
    ),
  },
  {
    key: 'emblem_front',
    type: 'image',
    label: L('Sun layer: intro detail (optional)', 'طبقة الشمس: تفصيل البداية (اختياري)'),
    description: L(
      'A detail drawn over the disc during the intro only (the mountain of a logo, an initial); it fades out after 1.7 s. ' + LAYER_BOX.en,
      'تفصيل يُرسم فوق القرص أثناء البداية فقط (جبل الشعار أو حرف أول)، ويختفي بعد 1.7 ثانية. ' + LAYER_BOX.ar,
    ),
  },
  {
    key: 'light',
    type: 'boolean',
    label: L('Living dawn light', 'ضوء الفجر الحي'),
    description: L(
      'A soft moving light in the sky (WebGL). Off, or on a device without it, the sky keeps its still gradients.',
      'ضوء ناعم متحرك في السماء (WebGL). عند إيقافه أو على جهاز لا يدعمه تبقى السماء بتدرّجاتها الثابتة.',
    ),
    defaultValue: true,
  },
  { key: 'cue', type: 'boolean', label: L('Scroll cue', 'إشارة التمرير'), defaultValue: true },
  {
    key: 'height',
    type: 'select',
    label: L('Height', 'الارتفاع'),
    defaultValue: 'screen',
    options: [option('screen', 'First screen', 'الشاشة الأولى'), option('compact', 'Compact', 'مضغوط')],
  },
  { key: 'sky_color', type: 'color', label: L('Night sky', 'سماء الليل'), description: EMPTY_DAWN },
  { key: 'warm_color', type: 'color', label: L('Warm horizon', 'الأفق الدافئ'), description: EMPTY_DAWN },
  { key: 'gold_color', type: 'color', label: L('Gold (sun, second heading line)', 'الذهبي (الشمس، السطر الثاني من العنوان)'), description: EMPTY_DAWN },
  { key: 'accent_color', type: 'color', label: L('Accent (button, ember)', 'لون التمييز (الزر، الجمر)'), description: EMPTY_DAWN },
  {
    key: 'cream_color',
    type: 'color',
    label: L('Light colour (text, lower edge)', 'اللون الفاتح (النص، الحافة السفلية)'),
    description: L(
      'The text and the curved lower edge. Give it the background colour of the next section. Empty = the built-in cream.',
      'النص والحافة السفلية المنحنية. اجعله بلون خلفية القسم التالي. فارغ = لون الكريم المدمج.',
    ),
  },
  { key: 'eyebrow', type: 'text', label: L('Eyebrow', 'السطر التمهيدي'), maxLength: 60 },
  { key: 'heading_1', type: 'text', label: L('Heading, first line', 'العنوان، السطر الأول'), maxLength: 80 },
  { key: 'heading_2', type: 'text', label: L('Heading, second line (gold)', 'العنوان، السطر الثاني (ذهبي)'), maxLength: 80 },
  { key: 'text', type: 'textarea', label: L('Text', 'النص'), maxLength: 280 },
  { key: 'cta_text', type: 'text', label: L('Button text', 'نص الزر'), maxLength: 40 },
  { key: 'cta_url', type: 'url', label: L('Button URL', 'رابط الزر') },
  { key: 'cta_secondary_text', type: 'text', label: L('Link text', 'نص الرابط'), maxLength: 40 },
  { key: 'cta_secondary_url', type: 'url', label: L('Link URL', 'رابط النص') },
  { key: 'cue_text', type: 'text', label: L('Scroll cue text', 'نص إشارة التمرير'), maxLength: 24 },
];

export const entry: CreativeSchemaEntry = {
  schema: {
    id: HERO_DAWN_KEY,
    label: L('Dawn hero', 'واجهة الفجر'),
    icon: 'sparkles',
    category: 'showcase',
    description: L(
      'A night sky turning into dawn: your sun rises behind a ridge, an arch photo rises in front of it, the copy follows line by line. Best as the first section.',
      'سماء ليل تتحوّل إلى فجر: تصعد شمسك خلف التلال وترتفع صورة القوس أمامها ثم يتبعها النص سطراً بعد سطر. الأفضل أن يكون القسم الأول.',
    ),
    pageTypes: ['HOME', 'STATIC', 'LANDING'],
    translatable: ['arch_alt', 'card_alt', 'eyebrow', 'heading_1', 'heading_2', 'text', 'cta_text', 'cta_secondary_text', 'cue_text'],
    schema: FIELDS,
  },
  defaultSettings: { card: true, light: true, cue: true, height: 'screen' },
  defaultContent: {
    eyebrow: 'A new day',
    heading_1: 'Your headline here.',
    heading_2: 'A second line in gold.',
    text: 'One or two sentences about what your store stands for.',
    cta_text: 'Shop now',
    cta_secondary_text: 'Our story',
    cue_text: 'Scroll',
  },
};
