// STUB (owner: B4). Demo content for /dev/creative-demo: one minimal
// entry per section. The owner replaces it with complete, neutral demo
// content (en + ar); no client name, asset or tagline ever goes here.

import type { DemoSection } from './types';

export const FIXTURES: DemoSection[] = [
  {
    section_key: 'hero-sunrise',
    settings: { image: '/creative-demo/shared/photo-2.svg', scene: 'light' },
    content: {
      en: { heading: 'A new day,\na new *collection*', cta_text: 'Shop now' },
      ar: { heading: 'يوم جديد،\n*مجموعة* جديدة', cta_text: 'تسوّق الآن' },
    },
  },
  {
    section_key: 'ornament-line',
    settings: { variant: 'frame' },
    content: {
      en: { heading: 'Drawn by hand' },
      ar: { heading: 'مرسوم باليد' },
    },
  },
];
