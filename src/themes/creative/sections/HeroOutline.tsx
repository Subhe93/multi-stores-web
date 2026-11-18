// STUB (owner: B1). Section "hero-outline": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { HERO_OUTLINE_CSS } from '../css/heroOutline.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function HeroOutline({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="hero-outline"
      css={HERO_OUTLINE_CSS}
      settings={settings}
      heading={content.heading}
      level="h1"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const heroOutlineSection = defineCreativeSection('hero-outline', HeroOutline);
