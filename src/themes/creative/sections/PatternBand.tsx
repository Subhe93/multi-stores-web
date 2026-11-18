// Section "pattern-band": the store's own woven pattern as one band that can
// return through a page. The owner's tile artwork repeats edge to edge at
// the height of the band; with a label the band carries a small woven tag.
//
// The platform ships no artwork: without an accepted tile the store renders
// nothing (the builder shows the empty state). The tile URL is the only
// owner value written into CSS and passes sections/patternUrl.ts first.
//
// Zero JavaScript of its own (island={false}): the entrance comes from the
// store motion runtime through the `motion` prop and the recipes. Without
// the prop no reveal attribute is rendered and the band is simply there.
//
// Artwork is never mirrored. In RTL the band is anchored at the right edge
// and the cloth arrives from there (css/patternBand.css.ts).

import type { CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { PATTERN_BAND_CSS } from '../css/patternBand.css';
import { CxSection, EmptyState } from '../primitives';
import { fade, hover, line, rise } from '../recipes';
import { entry, PATTERN_BAND_KEY } from '../schemas/pattern-band.schema';
import { patternCssUrl, safePatternUrl } from './patternUrl';

/** Over this many characters a phone moves the tag under the band (two lines at most on it). */
export const PATTERN_TAG_LONG = 40;

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const oneOf = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(raw) ? (raw as T) : fallback;

function PatternBand({ settings, content, locale, primaryLocale, motion, builderPreview }: SectionRenderProps) {
  const safe = safePatternUrl(settings.tile_image);
  if (!safe) return builderPreview ? <EmptyState name={PATTERN_BAND_KEY} /> : null;
  // Uploaded media is stored root-relative and served by the API origin.
  const tile = safe.startsWith('/') ? resolveMediaUrl(safe) : safe;

  const size = oneOf(settings.size, ['sm', 'md', 'lg'] as const, 'md');
  const space = oneOf(settings.space, ['none', 'sm', 'md', 'lg'] as const, 'md');
  const width = oneOf(settings.width, ['full', 'contained'] as const, 'full');
  const two = settings.rows === '2' || settings.rows === 2;
  const rails = settings.rails === true || settings.rails === 'true';

  const label = str(content.label).slice(0, 60);
  const labelUrl = str(settings.label_url);

  const vars: Record<string, string> = { '--cx-pb-img': patternCssUrl(tile) };
  const bg = str(settings.bg_color);
  const tag = str(settings.tag_color);
  const ink = str(settings.text_color);
  if (bg) vars['--cx-pb-bg'] = bg;
  if (tag) vars['--cx-pb-tag'] = tag;
  if (ink) vars['--cx-pb-ink'] = ink;

  const script = label && ARABIC_SCRIPT.test(label) ? 'arabic' : undefined;

  return (
    <CxSection
      name={PATTERN_BAND_KEY}
      css={PATTERN_BAND_CSS}
      island={false}
      as="div"
      className="cx-pb"
      style={vars as CSSProperties}
      data-cx-size={size}
      data-cx-rows={two ? '2' : '1'}
      data-cx-width={width}
      data-cx-space={space}
      data-cx-tag={label ? (label.length > PATTERN_TAG_LONG ? 'long' : 'short') : undefined}
    >
      <div className="cx-pb-in">
        {rails ? <span className="cx-pb-rail" data-cx-edge="start" aria-hidden="true" {...line(motion)} /> : null}
        <div className="cx-pb-stage">
          {/* Decorative cloth; the tag is the only real text. */}
          <div className="cx-pb-band" aria-hidden="true" {...fade(motion)}>
            <span className="cx-pb-row" />
            {two ? <span className="cx-pb-row" /> : null}
          </div>
          {label ? (
            <p className="cx-pb-tag" {...rise(motion, { d: 8 })}>
              {labelUrl ? (
                <a
                  className="cx-pb-label"
                  href={sectionHref(labelUrl, locale, primaryLocale)}
                  data-cx-script={script}
                  {...hover(motion, 'underline')}
                >
                  {label}
                </a>
              ) : (
                <span className="cx-pb-label" data-cx-script={script}>
                  {label}
                </span>
              )}
            </p>
          ) : null}
        </div>
        {rails ? <span className="cx-pb-rail" data-cx-edge="end" aria-hidden="true" {...line(motion)} /> : null}
      </div>
    </CxSection>
  );
}

// Built from the section's own schema entry (the shape defineCreativeSection
// returns): explicit builderPreview flag, frozen schema and defaults.
export const patternBandSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: PatternBand,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
