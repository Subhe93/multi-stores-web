// Demo page content, in reading order: the sunrise hero (B4), B1 (stage
// scenes, outline hero, existing sections with the creative options), B2,
// B3, then the rest of B4.

import type { SectionInstance } from '../../../types';
import { FIXTURES as B1 } from './b1';
import { FIXTURES as B2 } from './b2';
import { FIXTURES as B3 } from './b3';
import { FIXTURES as B4 } from './b4';
import type { DemoSection } from './types';

export type { DemoSection } from './types';

const isSunrise = (s: DemoSection) => s.section_key === 'hero-sunrise';

export const DEMO_FIXTURES: DemoSection[] = [
  ...B4.filter(isSunrise),
  ...B1,
  ...B2,
  ...B3,
  ...B4.filter((s) => !isSunrise(s)),
];

/** The fixtures as section instances (optionally only one section key). */
export function demoSections(only?: string): SectionInstance[] {
  return DEMO_FIXTURES.filter((s) => !only || s.section_key === only).map((s, i) => ({
    id: `demo-${i + 1}`,
    section_key: s.section_key,
    settings: s.settings,
    sort_order: i,
    translations: [
      { locale: 'en', content: s.content.en },
      { locale: 'ar', content: s.content.ar },
    ],
  }));
}
