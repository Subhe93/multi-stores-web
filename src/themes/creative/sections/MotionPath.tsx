// STUB (owner: B3). Section "motion-path": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { MOTION_PATH_CSS } from '../css/motionPath.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function MotionPath({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="motion-path"
      css={MOTION_PATH_CSS}
      settings={settings}
      heading={content.heading}
      level="h2"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const motionPathSection = defineCreativeSection('motion-path', MotionPath);
