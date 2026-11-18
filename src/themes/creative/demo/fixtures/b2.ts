// Demo content of builder B2 for /dev/creative-demo: the marquee band (words
// and chips), the pinned story and the sticky steps. Neutral copy and
// placeholder artwork only; no client name, asset or tagline ever goes here.

import type { DemoSection } from './types';

const SHARED = '/creative-demo/shared';
const B2 = '/creative-demo/b2';

const WORDS_EN = ['Craft', 'Colour', 'Made to last', 'Small batches', 'Everyday pieces', 'Atelier'];
const WORDS_AR = ['حِرفة', 'لون', 'صُنع ليدوم', 'كميات صغيرة', 'قطع لكل يوم', 'Atelier'];

const PANELS_EN: Array<[string, string]> = [
  ['Made in small batches', 'Never more than forty pieces at a time.'],
  ['Repairs for life', 'Send a piece back and we mend it.'],
  ['Honest materials', 'Every fibre and metal is named on the label.'],
  ['Tracked delivery', 'Three to seven working days, with a tracking link.'],
  ['Thirty days to decide', 'Returns are free and need no explanation.'],
  ['People, not tickets', 'Write to us and a maker answers.'],
];
const PANELS_AR: Array<[string, string]> = [
  ['كميات صغيرة', 'لا أكثر من أربعين قطعة في المرة الواحدة.'],
  ['إصلاح مدى الحياة', 'أعد القطعة إلينا ونحن نصلحها.'],
  ['خامات صادقة', 'كل ليف ومعدن مذكور على البطاقة.'],
  ['توصيل مع تتبّع', 'من ثلاثة إلى سبعة أيام عمل، مع رابط تتبّع.'],
  ['ثلاثون يوماً للقرار', 'الإرجاع مجاني ولا يحتاج إلى تبرير.'],
  ['أشخاص لا تذاكر', 'اكتب لنا ويجيبك أحد الصنّاع.'],
];

const story = (
  rows: Array<[label: string, title: string, text: string, cta?: string]>,
): Array<Record<string, unknown>> =>
  rows.map(([label, title, text, cta], i) => ({
    image: `${SHARED}/photo-${(i % 4) + 1}.svg`,
    image_alt: title,
    icon: `${B2}/icon-${(i % 4) + 1}.svg`,
    label,
    title,
    text,
    ...(cta ? { cta_text: cta, cta_url: '/products' } : {}),
  }));

const chips = (names: string[]): Array<Record<string, unknown>> =>
  names.map((text, i) => ({ text, image: `${B2}/chip-${(i % 4) + 1}.svg`, image_alt: '' }));

export const FIXTURES: DemoSection[] = [
  {
    section_key: 'marquee-band',
    settings: {
      scene: 'dark',
      rows: '2',
      item_style: 'text',
      size: 'md',
      text_style: 'mixed',
      separator_image: `${B2}/symbol.svg`,
      speed: 'slow',
      edge_fade: true,
    },
    content: {
      en: { items: WORDS_EN.map((text) => ({ text })) },
      ar: { items: WORDS_AR.map((text) => ({ text })) },
    },
  },
  {
    section_key: 'story-pinned',
    settings: {
      scene: 'light',
      heading_emphasis: 'italic',
      card_style: 'editorial',
      card_width: 'md',
      image_aspect: 'portrait',
      numerals: 'small',
      progress: 'both',
      hint: true,
      heading_position: 'above',
      mobile_layout: 'swipe',
    },
    content: {
      en: {
        eyebrow: 'Our story',
        heading: 'Made by hand,\n*made to stay.*',
        subheading: 'Five things we care about, from the first sketch to the parcel at your door.',
        items: story([
          ['Material', 'Chosen slowly.', 'Natural fibres and metals, sourced from workshops we know by name.'],
          ['Craft', 'Shaped by hand.', 'Every piece passes through the same few pairs of hands, start to finish.'],
          ['Detail', 'Finished with care.', 'Edges, seams and clasps are checked one by one before anything leaves.'],
          ['Use', 'Made for every day.', 'Objects meant to be worn and used, not kept in a drawer.'],
          ['Delivery', 'Packed without waste.', 'Recycled paper, no plastic, and a note from the person who packed it.', 'See the collection'],
        ]),
      },
      ar: {
        eyebrow: 'قصتنا',
        heading: 'صُنع باليد،\n*ليبقى معك.*',
        subheading: 'خمسة أشياء نهتم بها، من أول رسمة حتى وصول الطرد إلى بابك.',
        items: story([
          ['الخامة', 'نختارها على مهل.', 'ألياف ومعادن طبيعية من ورش نعرف أصحابها بالاسم.'],
          ['الحِرفة', 'تُشكَّل باليد.', 'كل قطعة تمرّ بين الأيدي نفسها من البداية إلى النهاية.'],
          ['التفاصيل', 'تُنجَز بعناية.', 'الحواف والدرزات والمشابك تُفحص واحدة واحدة قبل الشحن.'],
          ['الاستعمال', 'صُنعت لكل يوم.', 'قطع لتُرتدى وتُستعمل، لا لتبقى في الدرج.'],
          ['التوصيل', 'تغليف بلا هدر.', 'ورق معاد تدويره، بلا بلاستيك، ومعها بطاقة ممن جهّز الطرد.', 'شاهد المجموعة'],
        ]),
      },
    },
  },
  {
    // Second look of the same section: text panels, the heading as first item of the row.
    section_key: 'story-pinned',
    settings: {
      scene: 'dark',
      heading_emphasis: 'italic',
      card_style: 'panel',
      card_width: 'sm',
      numerals: 'outline',
      progress: 'bar',
      hint: true,
      heading_position: 'start',
      mobile_layout: 'stack',
    },
    content: {
      en: {
        eyebrow: 'The workshop',
        heading: 'Why *Atelier?*',
        subheading: 'Six reasons people come back.',
        items: PANELS_EN.map(([title, text], i) => ({ icon: `${B2}/icon-${(i % 4) + 1}.svg`, title, text })),
      },
      ar: {
        eyebrow: 'الورشة',
        heading: 'لماذا *Atelier؟*',
        subheading: 'ستة أسباب تجعل الناس يعودون.',
        items: PANELS_AR.map(([title, text], i) => ({ icon: `${B2}/icon-${(i % 4) + 1}.svg`, title, text })),
      },
    },
  },
  {
    section_key: 'sticky-steps',
    settings: {
      scene: 'dark',
      heading_emphasis: 'italic',
      numeral_style: 'outline',
      numeral_size: 'md',
      progress_line: true,
      heading_side: 'start',
      spacing: 'md',
      cta_url: '/products',
    },
    content: {
      en: {
        eyebrow: 'Five steps',
        heading: 'How an order\n*takes shape*',
        subheading: 'From your choice to your door, nothing is rushed and nothing is hidden.',
        cta_text: 'Start an order',
        items: [
          { title: 'You choose a piece', text: 'Pick a size, a colour and any personal detail you would like added.' },
          { title: 'We confirm the details', text: 'You receive a summary within a day, before anything is cut or cast.' },
          { title: 'The workshop makes it', text: 'Small batches, so each order gets the time it needs.' },
          { title: 'It is checked twice', text: 'Once by the maker and once by the person who packs it.' },
          { title: 'It travels to you', text: 'Tracked delivery, with a note on how to care for it.' },
        ],
      },
      ar: {
        eyebrow: 'خمس خطوات',
        heading: 'كيف يتشكّل\n*طلبك*',
        subheading: 'من اختيارك حتى بابك، لا شيء على عجل ولا شيء مخفي.',
        cta_text: 'ابدأ طلبك',
        items: [
          { title: 'تختار القطعة', text: 'حدّد المقاس واللون وأي تفصيل شخصي تودّ إضافته.' },
          { title: 'نؤكّد التفاصيل', text: 'يصلك ملخّص خلال يوم واحد، قبل القص أو الصبّ.' },
          { title: 'الورشة تصنعها', text: 'كميات صغيرة، ليأخذ كل طلب الوقت الذي يحتاجه.' },
          { title: 'تُفحص مرتين', text: 'مرة عند الصانع ومرة عند من يجهّز الطرد.' },
          { title: 'تسافر إليك', text: 'توصيل مع تتبّع، ومعها بطاقة للعناية بالقطعة.' },
        ],
      },
    },
  },
  {
    section_key: 'marquee-band',
    settings: {
      rows: '2',
      item_style: 'pill',
      size: 'sm',
      text_style: 'solid',
      speed: 'normal',
      edge_fade: true,
    },
    content: {
      en: {
        heading: 'Workshops we work with',
        items: chips(['North Studio', 'Loom House', 'Clay Room', 'Copper Works', 'Linen Mill', 'Stone Bench']),
      },
      ar: {
        heading: 'ورش نعمل معها',
        items: chips(['استوديو الشمال', 'بيت النَّول', 'غرفة الطين', 'ورشة النحاس', 'مصنع الكتّان', 'طاولة الحجر']),
      },
    },
  },
];
