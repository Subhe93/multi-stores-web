// STUB (owner: B1). Demo content for /dev/creative-demo: one minimal
// entry per section. The owner replaces it with complete, neutral demo
// content (en + ar); no client name, asset or tagline ever goes here.

import type { DemoSection } from './types';

export const FIXTURES: DemoSection[] = [
  {
    section_key: 'stage-scenes',
    settings: { artwork: '/creative-demo/shared/object-1.svg', artwork_2: '/creative-demo/shared/object-2.svg' },
    content: {
      en: { scenes: [{ scene: 'dark', heading: 'One object, *many scenes*' }, { scene: 'light', heading: 'It travels as you scroll' }] },
      ar: { scenes: [{ scene: 'dark', heading: 'عنصر واحد، *مشاهد عدّة*' }, { scene: 'light', heading: 'يتنقّل مع التمرير' }] },
    },
  },
  {
    section_key: 'hero-outline',
    settings: { image: '/creative-demo/shared/photo-1.svg', accent_text: 'ATELIER' },
    content: {
      en: { heading: 'Made with *care*', accent_text: 'ATELIER', cta_text: 'Shop now' },
      ar: { heading: 'صُنع *بعناية*', accent_text: 'ATELIER', cta_text: 'تسوّق الآن' },
    },
  },
];
