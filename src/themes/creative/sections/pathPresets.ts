// Platform geometry of the motion-path line (contract 4.6). Pure, no React.
//
// The line runs from the centre of the first stop to the centre of the last
// one. Its box is 100 units wide and 100 units per gap between two stops, and
// the SVG stretches it over the real box (preserveAspectRatio="none"), which
// works because the stops are equal rows on the layouts that draw a shape.
// Every preset crosses the centre line (x = 50) at each stop, so a marker
// placed at the centre of its row always sits on the line, and every preset
// only moves downward (y never decreases): the trail can be revealed by a
// plain clip and the artwork found by its y.

export type PathShape = 'wave' | 'zigzag' | 'straight';
export type PathStyle = 'line' | 'dashed' | 'band';

/** Width of the path box in viewBox units. */
export const PATH_BOX_WIDTH = 100;
/** Height of one gap between two stops in viewBox units. */
export const PATH_GAP = 100;
/** Most stops a path carries (the schema's repeater limit). */
export const PATH_MAX_STOPS = 7;

// Furthest distance from the centre line. A cubic whose two handles sit at
// the same offset peaks at three quarters of that offset.
const WAVE_HANDLE = 48; // peak 36
const WAVE_REACH = 36; // vertical reach of a handle
const ZIGZAG_PEAK = 30;

export function pathShape(raw: unknown): PathShape {
  return raw === 'zigzag' || raw === 'straight' ? raw : 'wave';
}

export function pathStyle(raw: unknown): PathStyle {
  return raw === 'dashed' || raw === 'band' ? raw : 'line';
}

export interface PathGeometry {
  /** Path data of the chosen shape. */
  d: string;
  /** Path data of the plain vertical line (small screens, same box). */
  line: string;
  /** viewBox of both. */
  viewBox: string;
  height: number;
}

/**
 * Geometry for `stops` stops, or null when there is nothing to connect
 * (fewer than two stops). The first bend leans to the physical right; a
 * right-to-left page mirrors the whole SVG in CSS.
 */
export function buildPath(shape: PathShape, stops: number): PathGeometry | null {
  const count = Number.isFinite(stops) ? Math.min(PATH_MAX_STOPS, Math.max(0, Math.trunc(stops))) : 0;
  if (count < 2) return null;
  const gaps = count - 1;
  const height = gaps * PATH_GAP;
  const mid = PATH_BOX_WIDTH / 2;
  const line = `M${mid} 0V${height}`;
  let d = line;
  if (shape !== 'straight') {
    const parts = [`M${mid} 0`];
    for (let i = 0; i < gaps; i++) {
      const y0 = i * PATH_GAP;
      const y1 = y0 + PATH_GAP;
      const side = i % 2 === 0 ? 1 : -1;
      if (shape === 'wave') {
        const x = mid + side * WAVE_HANDLE;
        parts.push(`C${x} ${y0 + WAVE_REACH} ${x} ${y1 - WAVE_REACH} ${mid} ${y1}`);
      } else {
        parts.push(`L${mid + side * ZIGZAG_PEAK} ${y0 + PATH_GAP / 2}L${mid} ${y1}`);
      }
    }
    d = parts.join('');
  }
  return { d, line, viewBox: `0 0 ${PATH_BOX_WIDTH} ${height}`, height };
}
