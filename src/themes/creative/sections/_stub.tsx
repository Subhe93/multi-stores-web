// Foundation helper behind the eight section stubs. A builder that replaces
// its stub no longer imports this file; it is deleted once the last stub is
// gone.

import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag, type TextTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { emphasisValue } from '../emphasis';
import { CxSection, EmptyState, HeadingText } from '../primitives';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function StubSection({
  name,
  css,
  settings,
  heading,
  level,
  island,
  builderPreview,
}: {
  name: string;
  css: string;
  settings: Record<string, unknown>;
  heading: unknown;
  level: TextTag;
  island: boolean;
  builderPreview?: boolean;
}) {
  const text = headingLines(heading);
  // Nothing on the live store; a dashed placeholder in the builder only.
  if (!text) return builderPreview ? <EmptyState name={name} /> : null;
  return (
    <CxSection
      name={name}
      css={css}
      island={island}
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      data-cx-stub=""
    >
      {/* Inline styles: a new Tailwind utility would enter every store's global CSS. */}
      <div style={{ maxWidth: 'var(--theme-container-max)', marginInline: 'auto', padding: '4rem 1.5rem' }}>
        <Heading
          level={headingTag(settings.heading_level, level)}
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: 'var(--theme-scale-h2)',
            fontWeight: 'var(--theme-weight-heading)',
            lineHeight: 'var(--theme-line-heading)',
            ...multilineStyle(text),
          }}
        >
          <HeadingText
            text={text}
            reveal={island ? 'scroll' : 'none'}
            emphasis={emphasisValue(settings.heading_emphasis, 'italic')}
            emphasisColor={str(settings.heading_emphasis_color)}
          />
        </Heading>
      </div>
    </CxSection>
  );
}
