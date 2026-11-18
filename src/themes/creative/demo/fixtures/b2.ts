// STUB (owner: B2). Demo content for /dev/creative-demo: one minimal
// entry per section. The owner replaces it with complete, neutral demo
// content (en + ar); no client name, asset or tagline ever goes here.

import type { DemoSection } from './types';

export const FIXTURES: DemoSection[] = [
  {
    section_key: 'story-pinned',
    settings: { scene: 'dark' },
    content: {
      en: { heading: 'Our *story*' },
      ar: { heading: '*قصتنا*' },
    },
  },
  {
    section_key: 'sticky-steps',
    settings: {},
    content: {
      en: { heading: 'How it *works*' },
      ar: { heading: 'كيف *نعمل*' },
    },
  },
  {
    section_key: 'marquee-band',
    settings: {},
    content: {
      en: { heading: 'Craft, colour, care', items: [] },
      ar: { heading: 'حِرفة، لون، عناية', items: [] },
    },
  },
];
