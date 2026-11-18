// STUB (owner: B4). Section "hero-sunrise": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { HERO_SUNRISE_CSS } from '../css/heroSunrise.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function HeroSunrise({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="hero-sunrise"
      css={HERO_SUNRISE_CSS}
      settings={settings}
      heading={content.heading}
      level="h1"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const heroSunriseSection = defineCreativeSection('hero-sunrise', HeroSunrise);
