// Demo content of builder B3 for /dev/creative-demo: the motion-path section
// in its two layouts, and existing sections that carry a scene theme and a
// living background through settings._style (each scene and each backdrop
// once). Neutral copy and placeholder artwork only.

import type { DemoSection } from './types';

// Section padding is stored per breakpoint.
const PAD = { desktop: { top: 'xl', bottom: 'xl' }, mobile: { top: 'lg', bottom: 'lg' } };

export const FIXTURES: DemoSection[] = [
  // Centred wave, cards alternating, travelling artwork, dark scene with
  // drifting rings above it.
  {
    section_key: 'motion-path',
    settings: {
      heading_emphasis: 'italic',
      heading_position: 'above',
      artwork: '/creative-demo/b3/spark.svg',
      artwork_size: 'md',
      artwork_rotate: false,
      artwork_flip_rtl: false,
      path_shape: 'wave',
      path_style: 'line',
      cards_side: 'alternate',
      scene: 'dark',
      scene_bg: '#121212',
      scene_text: '#F5F1EA',
      scene_accent: '#C9A45C',
      _style: {
        backdrop: 'particles',
        backdrop_particle: 'ring',
        backdrop_intensity: 'soft',
        backdrop_color_1: '#C9A45C',
        backdrop_color_2: '#F5F1EA',
      },
    },
    content: {
      en: {
        eyebrow: 'The journey',
        heading: 'From the studio to *your door*',
        subheading: 'Four quiet steps between the first sketch and the parcel in your hands.',
        stops: [
          {
            label: 'Step 01',
            title: 'Drawn by hand',
            text: 'Every piece starts as a pencil line on paper, long before any fabric is cut.',
            image: '/creative-demo/shared/photo-1.svg',
            image_alt: 'Abstract placeholder artwork in warm tones',
          },
          {
            label: 'Step 02',
            title: 'Cut and stitched',
            text: 'Small batches, made slowly by people who know the material.',
          },
          {
            label: 'Step 03',
            title: 'Checked twice',
            text: 'Seams, colour and finish are inspected before anything is folded.',
            image: '/creative-demo/shared/photo-3.svg',
            image_alt: 'Abstract placeholder artwork in cool tones',
          },
          {
            label: 'Step 04',
            title: 'Packed with care',
            text: 'Wrapped in recycled paper and sent on its way to you.',
            cta_text: 'See the collection',
            cta_url: '/products',
          },
        ],
      },
      ar: {
        eyebrow: 'الرحلة',
        heading: 'من المشغل إلى *بابك*',
        subheading: 'أربع خطوات هادئة بين الرسمة الأولى والطرد بين يديك.',
        stops: [
          {
            label: 'الخطوة 01',
            title: 'تُرسم باليد',
            text: 'تبدأ كل قطعة خطاً بقلم الرصاص على الورق، قبل قصّ أي قماش.',
            image: '/creative-demo/shared/photo-1.svg',
            image_alt: 'عمل فني تجريدي مؤقت بألوان دافئة',
          },
          {
            label: 'الخطوة 02',
            title: 'تُقصّ وتُخاط',
            text: 'كميات صغيرة تُصنع على مهل بأيدي من يعرفون الخامة.',
          },
          {
            label: 'الخطوة 03',
            title: 'تُفحص مرتين',
            text: 'نراجع الدرزات واللون واللمسة الأخيرة قبل طيّ أي قطعة.',
            image: '/creative-demo/shared/photo-3.svg',
            image_alt: 'عمل فني تجريدي مؤقت بألوان باردة',
          },
          {
            label: 'الخطوة 04',
            title: 'تُغلَّف بعناية',
            text: 'تُلفّ بورق معاد تدويره وتُرسل في طريقها إليك.',
            cta_text: 'شاهد المجموعة',
            cta_url: '/products',
          },
        ],
      },
    },
  },
  // Sticky heading beside a zigzag band, cards on one side; a small arrow
  // that turns with the line.
  {
    section_key: 'motion-path',
    settings: {
      heading_emphasis: 'color',
      heading_position: 'sticky',
      artwork: '/creative-demo/b3/arrow.svg',
      artwork_size: 'sm',
      artwork_rotate: true,
      artwork_flip_rtl: false,
      path_shape: 'zigzag',
      path_style: 'band',
      cards_side: 'one-side',
      scene: 'light',
    },
    content: {
      en: {
        eyebrow: 'How it works',
        heading: 'Ordering is\n*simple*',
        subheading: 'The heading stays beside the line while the steps pass.',
        stops: [
          { label: '01', title: 'Choose', text: 'Pick a piece and a size. Stock is shown live.' },
          { label: '02', title: 'Pay', text: 'Card payment in a few seconds, in your currency.' },
          { label: '03', title: 'Track', text: 'A tracking link arrives the moment the parcel leaves.' },
          { label: '04', title: 'Unwrap', text: 'Delivered to your door, ready to wear.' },
          { label: '05', title: 'Return', text: 'Changed your mind? Thirty days to send it back.' },
        ],
      },
      ar: {
        eyebrow: 'كيف نعمل',
        heading: 'الطلب\n*بسيط*',
        subheading: 'يبقى العنوان بجانب الخط بينما تمرّ الخطوات.',
        stops: [
          { label: '01', title: 'اختر', text: 'اختر القطعة والمقاس. المخزون يظهر مباشرة.' },
          { label: '02', title: 'ادفع', text: 'دفع بالبطاقة خلال ثوانٍ وبعملتك.' },
          { label: '03', title: 'تتبّع', text: 'يصلك رابط التتبّع لحظة خروج الطرد.' },
          { label: '04', title: 'افتح', text: 'يصل إلى بابك جاهزاً للارتداء.' },
          { label: '05', title: 'أرجِع', text: 'غيّرت رأيك؟ لديك ثلاثون يوماً للإرجاع.' },
        ],
      },
    },
  },
  // Existing sections with a scene and a living background from _style.
  {
    section_key: 'rich-text',
    settings: {
      _style: { padding: PAD, scene: 'dark', backdrop: 'dots', backdrop_intensity: 'medium' },
    },
    content: {
      en: {
        eyebrow: 'Dark scene, halftone dots',
        heading: 'Any section can change the scene',
        html: '<p>This is an ordinary text section. Its style panel switched the colours to the dark scene and added a halftone background; the section itself was not changed.</p>',
      },
      ar: {
        eyebrow: 'مشهد داكن، نقاط',
        heading: 'أي قسم يستطيع تغيير المشهد',
        html: '<p>هذا قسم نصي عادي. لوحة التنسيق حوّلت ألوانه إلى المشهد الداكن وأضافت خلفية منقّطة، ولم يتغيّر القسم نفسه.</p>',
      },
    },
  },
  {
    section_key: 'image-with-text',
    settings: {
      image: '/creative-demo/shared/photo-2.svg',
      _style: {
        padding: PAD,
        scene: 'light',
        scene_bg: '#F4EFE6',
        backdrop: 'glow',
        backdrop_color_1: '#C9A45C',
        backdrop_color_2: '#B4472E',
        backdrop_intensity: 'medium',
      },
    },
    content: {
      en: {
        eyebrow: 'Light scene, soft glow',
        heading: 'Made slowly, on purpose',
        body: 'A warm paper tone from the style panel, with two soft lights drifting behind the content.',
        alt: 'Abstract placeholder artwork',
      },
      ar: {
        eyebrow: 'مشهد فاتح، وهج ناعم',
        heading: 'صُنع على مهل، عن قصد',
        body: 'درجة ورقية دافئة من لوحة التنسيق، مع ضوءين ناعمين يتحركان خلف المحتوى.',
        alt: 'عمل فني تجريدي مؤقت',
      },
    },
  },
  {
    section_key: 'trust-badges',
    settings: {
      layout: 'cards',
      _style: {
        padding: PAD,
        scene: 'accent',
        scene_bg: '#B4472E',
        scene_text: '#FFF8EE',
        scene_accent: '#141414',
        backdrop: 'particles',
        backdrop_color_1: '#FFF8EE',
        backdrop_color_2: '#141414',
        backdrop_motion: 'slow',
      },
    },
    content: {
      en: {
        items: [
          { icon: 'shield', label: 'Secure payment' },
          { icon: 'truck', label: 'Tracked delivery' },
          { icon: 'refresh', label: 'Thirty-day returns' },
        ],
      },
      ar: {
        items: [
          { icon: 'shield', label: 'دفع آمن' },
          { icon: 'truck', label: 'توصيل مع تتبّع' },
          { icon: 'refresh', label: 'إرجاع خلال ثلاثين يوماً' },
        ],
      },
    },
  },
];
