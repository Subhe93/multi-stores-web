import { describe, expect, it } from 'vitest';
import { buildPath, pathShape, pathStyle, PATH_GAP, PATH_MAX_STOPS } from './pathPresets';

/** Every coordinate pair of a path made of M, C, L and V commands, in order. */
function points(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [, cmd, args] of d.matchAll(/([MCLV])([^MCLV]*)/g)) {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === 'V') out.push([out[out.length - 1][0], n[0]]);
    else for (let i = 0; i < n.length; i += 2) out.push([n[i], n[i + 1]]);
  }
  return out;
}

describe('path presets', () => {
  it('reads unknown values as the defaults', () => {
    expect(pathShape('zigzag')).toBe('zigzag');
    expect(pathShape('straight')).toBe('straight');
    expect(pathShape('spiral')).toBe('wave');
    expect(pathShape(undefined)).toBe('wave');
    expect(pathStyle('band')).toBe('band');
    expect(pathStyle('dashed')).toBe('dashed');
    expect(pathStyle(7)).toBe('line');
  });

  it('has nothing to connect below two stops', () => {
    expect(buildPath('wave', 0)).toBeNull();
    expect(buildPath('wave', 1)).toBeNull();
    expect(buildPath('zigzag', Number.NaN)).toBeNull();
  });

  it('spans one gap per pair of stops and never more than the repeater limit', () => {
    expect(buildPath('wave', 4)?.viewBox).toBe(`0 0 100 ${3 * PATH_GAP}`);
    expect(buildPath('wave', 40)?.height).toBe((PATH_MAX_STOPS - 1) * PATH_GAP);
  });

  it('a straight path is the plain line', () => {
    const g = buildPath('straight', 3)!;
    expect(g.d).toBe(g.line);
    expect(g.line).toBe('M50 0V200');
  });

  for (const shape of ['wave', 'zigzag'] as const) {
    it(`${shape}: starts and ends on the centre line, meets it at every stop and only moves downward`, () => {
      const g = buildPath(shape, 5)!;
      const pts = points(g.d);
      expect(pts[0]).toEqual([50, 0]);
      expect(pts[pts.length - 1]).toEqual([50, g.height]);
      // A segment ends on the centre line at each stop.
      for (let stop = 0; stop < 5; stop++) {
        expect(pts.some(([x, y]) => x === 50 && y === stop * PATH_GAP)).toBe(true);
      }
      for (let i = 1; i < pts.length; i++) expect(pts[i][1]).toBeGreaterThanOrEqual(pts[i - 1][1]);
      // Inside the box, bending to both sides.
      for (const [x] of pts) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
      }
      expect(new Set(pts.map(([x]) => Math.sign(x - 50)).filter(Boolean)).size).toBe(2);
    });
  }
});
