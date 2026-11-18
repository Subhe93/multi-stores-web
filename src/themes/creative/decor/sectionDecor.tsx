// Scene theme and living background on ANY section, from settings._style
// (contract 4.10). Called by SectionRenderer for every non-chrome section;
// returns null unless a scene or a backdrop holds a valid value, so a stored
// section that sets neither keeps today's markup.

import type { CSSProperties, ReactNode } from 'react';
import type { SectionStyle } from '../../sectionStyle';
import { BASE_CSS } from '../css/base.css';
import { DECOR_CSS } from '../css/decor.css';
import { CxStyle } from '../primitives/CxStyle';
import { JsFlag } from '../primitives/JsFlag';
import { sceneProps, sceneValue } from '../scene';
import { Pattern, patternKind } from './Pattern';

export interface SectionDecor {
  /** Classes added to the section wrapper. */
  className: string;
  /** Attributes added to the section wrapper. */
  attrs: Record<string, string>;
  /** Inline scene variables (hex overrides), merged into the wrapper style. */
  style?: CSSProperties;
  /** Rendered inside the wrapper, before the section. */
  before: ReactNode;
}

export function renderSectionDecor(style: SectionStyle | undefined, opts: { nested: boolean }): SectionDecor | null {
  if (!style || typeof style !== 'object') return null;
  // A hex override without a scene uses the 'light' scene, as in CxSection.
  const scene = sceneProps(sceneValue(style.scene), {
    bg: style.scene_bg,
    text: style.scene_text,
    accent: style.scene_accent,
  });
  const sceneName = scene['data-cx-scene'];
  const backdrop = patternKind(style.backdrop);
  if (!sceneName && !backdrop) return null;

  const classes: string[] = [];
  const attrs: Record<string, string> = {};
  if (sceneName) {
    classes.push('cx-scene-wrap');
    // The colour reaches the viewport edges, except inside a column.
    if (!opts.nested) classes.push('cx-scene-bleed');
    attrs['data-cx-scene'] = sceneName;
  }
  if (backdrop) {
    classes.push('cx-bd-host');
    if (!opts.nested) classes.push('cx-bd-bleed');
  }
  const still = style.backdrop_motion === 'still';

  return {
    className: classes.join(' '),
    attrs,
    style: scene.style,
    before: (
      <>
        {/* A moving backdrop needs the motion gate; no island is mounted. */}
        {backdrop && !still ? <JsFlag /> : null}
        {sceneName ? <CxStyle id="base" css={BASE_CSS} /> : null}
        {/* The Pattern brings the decor stylesheet itself. */}
        {backdrop ? null : <CxStyle id="decor" css={DECOR_CSS} />}
        {backdrop ? (
          <Pattern
            kind={backdrop}
            color1={style.backdrop_color_1}
            color2={style.backdrop_color_2}
            intensity={style.backdrop_intensity === 'medium' ? 'medium' : 'soft'}
            motion={still ? 'still' : 'slow'}
            particle={style.backdrop_particle === 'ring' ? 'ring' : 'dot'}
          />
        ) : null}
      </>
    ),
  };
}
