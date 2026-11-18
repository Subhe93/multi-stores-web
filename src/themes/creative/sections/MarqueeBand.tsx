// STUB (owner: B2). Section "marquee-band": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { MARQUEE_BAND_CSS } from '../css/marqueeBand.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function MarqueeBand({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="marquee-band"
      css={MARQUEE_BAND_CSS}
      settings={settings}
      heading={content.heading}
      level="p"
      island={false}
      builderPreview={builderPreview}
    />
  );
}

export const marqueeBandSection = defineCreativeSection('marquee-band', MarqueeBand);
