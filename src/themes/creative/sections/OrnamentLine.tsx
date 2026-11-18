// Section "ornament-line": a thin divider drawn from the store owner's own
// motif, which draws itself as it scrolls into view. Small and quiet: one
// strip between two sections, nothing else.
//
// The motif is owner content: a list of SVG path "d" strings for one tile
// (tile_width x tile_height user units, drawn 1 unit = 1 px). The platform
// ships no motif; with no paths the divider is two plain rails.
//
// Safety: owner strings are never rendered as markup. Each one passes
// sanitizePathData (command letters, digits, separators only) and is written
// into the `d` attribute of a <path> this component builds.
//
// Artwork is never mirrored: in RTL the strip is anchored to the right edge
// and the draw order runs from there; only the plain rails flip direction.

import type { CSSProperties, ReactNode } from 'react';
import type { SectionRenderProps } from '../../types';
import { numberOr } from '../../elementStyles';
import { ORNAMENT_LINE_CSS } from '../css/ornamentLine.css';
import { CxSection } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { ornamentPaths, type OrnamentPath } from './ornamentPath';

const TILE_W = { fallback: 120, min: 24, max: 400 };
const TILE_H = { fallback: 48, min: 8, max: 120 };
const MAX_PATHS = 12;
// Widths (px) the strip must cover, and the most tiles it is built from.
const COVER_CONTAINED = 1400;
const COVER_FULL = 2600;
const MAX_TILES = 32;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const dim = (raw: unknown, d: typeof TILE_W) => Math.round(clamp(numberOr(raw, d.fallback), d.min, d.max));

const SVG_PROPS = { 'aria-hidden': true, focusable: false, fill: 'none' } as const;

function Paths({ paths }: { paths: OrnamentPath[] }) {
  return paths.map((p, j) => (
    <path key={j} className="cx-ol-p" d={p.d} data-c={p.color} pathLength={1} style={{ '--cx-j': j } as CSSProperties} />
  ));
}

function OrnamentLine({ settings }: SectionRenderProps) {
  const full = settings.width === 'full';
  const drawMode = settings.draw === 'scroll' || settings.draw === 'none' ? settings.draw : 'once';
  const animated = drawMode !== 'none';

  const tw = dim(settings.tile_width, TILE_W);
  const th = dim(settings.tile_height, TILE_H);
  const paths = ornamentPaths(settings.paths, MAX_PATHS);

  const vars: Record<string, string> = { '--cx-ol-tw': `${tw}px`, '--cx-ol-th': `${th}px` };
  const colorA = str(settings.color_a);
  const colorB = str(settings.color_b);
  const colorC = str(settings.color_c);
  if (colorA) vars['--cx-ol-ca'] = colorA;
  if (colorB) vars['--cx-ol-cb'] = colorB;
  if (colorC) vars['--cx-ol-cc'] = colorC;

  const host = {
    'data-cx-behavior': animated ? 'draw' : undefined,
    'data-cx-draw': animated ? drawMode : undefined,
  };

  let body: ReactNode;
  if (paths.length > 0) {
    const count = clamp(Math.ceil((full ? COVER_FULL : COVER_CONTAINED) / tw), 1, MAX_TILES);
    const total = count * tw;
    body = (
      <div className="cx-ol-host" {...host}>
        {/* Fixed height: the strip is positioned inside and cropped at the inline end. */}
        <div className="cx-ol-band" aria-hidden="true" style={{ blockSize: th }}>
          <svg
            className="cx-ol-strip"
            width={total}
            height={th}
            viewBox={`0 0 ${total} ${th}`}
            style={{ '--cx-n': count } as CSSProperties}
            {...SVG_PROPS}
          >
            {Array.from({ length: count }, (_, i) => (
              <g key={i} className="cx-ol-t" transform={`translate(${i * tw} 0)`} style={{ '--cx-i': i } as CSSProperties}>
                <Paths paths={paths} />
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  } else {
    // No motif: two plain rails.
    body = (
      <div className="cx-ol-host" {...host}>
        <svg className="cx-ol-plain" {...SVG_PROPS}>
          <line className="cx-ol-p" x1="0" y1="1" x2="100%" y2="1" pathLength={1} />
          <line className="cx-ol-p" x1="0" y1="8" x2="100%" y2="8" pathLength={1} style={{ '--cx-j': 2 } as CSSProperties} />
        </svg>
      </div>
    );
  }

  return (
    <CxSection
      name="ornament-line"
      css={ORNAMENT_LINE_CSS}
      // "Static" needs no JavaScript at all.
      island={animated}
      as="div"
      className="cx-ol"
      style={vars as CSSProperties}
      data-cx-variant="divider"
      data-cx-width={full ? 'full' : 'contained'}
      data-cx-stroke={settings.stroke === 'thin' ? 'thin' : 'regular'}
    >
      <div className="cx-ol-in">{body}</div>
    </CxSection>
  );
}

export const ornamentLineSection = defineCreativeSection('ornament-line', OrnamentLine);
