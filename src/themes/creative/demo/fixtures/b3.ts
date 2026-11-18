// STUB (owner: B3). Demo content for /dev/creative-demo: one minimal
// entry per section. The owner replaces it with complete, neutral demo
// content (en + ar); no client name, asset or tagline ever goes here.

import type { DemoSection } from './types';

export const FIXTURES: DemoSection[] = [
  {
    section_key: 'motion-path',
    settings: { scene: 'accent' },
    content: {
      en: { heading: 'From the studio to *your door*' },
      ar: { heading: 'من المشغل إلى *بابك*' },
    },
  },
];
