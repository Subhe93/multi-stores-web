// STUB (owner: B2). Section "story-pinned": the foundation renders the heading
// only (or the builder empty state) so the section is registered, compiles
// and shows up in the demo route. The owner replaces this file with the real
// section built on the frozen schema in ../schemas.ts.

import type { SectionRenderProps } from '../../types';
import { STORY_PINNED_CSS } from '../css/storyPinned.css';
import { defineCreativeSection } from '../schemas';
import { StubSection } from './_stub';

function StoryPinned({ settings, content, builderPreview }: SectionRenderProps) {
  return (
    <StubSection
      name="story-pinned"
      css={STORY_PINNED_CSS}
      settings={settings}
      heading={content.heading}
      level="h2"
      island={true}
      builderPreview={builderPreview}
    />
  );
}

export const storyPinnedSection = defineCreativeSection('story-pinned', StoryPinned);
