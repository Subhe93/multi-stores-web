// STUB (owner: B4). Section "ornament-line": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { ORNAMENT_LINE_CSS } from '../css/ornamentLine.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function OrnamentLine({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="ornament-line"
      css={ORNAMENT_LINE_CSS}
      settings={settings}
      heading={content.heading}
      level="h2"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const ornamentLineSection = defineCreativeSection('ornament-line', OrnamentLine);
