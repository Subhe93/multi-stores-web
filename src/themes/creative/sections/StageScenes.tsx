// STUB (owner: B1). Section "stage-scenes": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { STAGE_SCENES_CSS } from '../css/stageScenes.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

/** Heading of the first scene (the stub shows nothing else). */
function firstSceneHeading(scenes: unknown): unknown {
  const first = Array.isArray(scenes) ? (scenes[0] as { heading?: unknown } | undefined) : undefined;
  return first?.heading;
}

function StageScenes({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="stage-scenes"
      css={STAGE_SCENES_CSS}
      settings={settings}
      heading={firstSceneHeading(content.scenes)}
      level="h2"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const stageScenesSection = defineCreativeSection('stage-scenes', StageScenes);
