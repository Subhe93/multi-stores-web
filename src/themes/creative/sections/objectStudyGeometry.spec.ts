import { describe, expect, it } from 'vitest';
import { GUTTER, leaderStrokes, NOTE_GAP, NOTE_MAX_Y, percent, placeNotes, sideOf } from './objectStudyGeometry';

describe('object-study geometry', () => {
  it('reads a percentage, clamps it and refuses anything else', () => {
    expect(percent(46)).toBe(46);
    expect(percent('30.5')).toBe(30.5);
    expect(percent(-4)).toBe(0);
    expect(percent(140)).toBe(100);
    expect(percent('')).toBeNull();
    expect(percent(undefined)).toBeNull();
    expect(percent('left')).toBeNull();
  });

  it('a note belongs to the nearer physical side: left below 50, else right', () => {
    expect(sideOf(0)).toBe('left');
    expect(sideOf(49.9)).toBe('left');
    expect(sideOf(50)).toBe('right');
    expect(sideOf(100)).toBe('right');
  });

  it('notes far enough apart sit at the height of their point, with a straight leader', () => {
    const placed = placeNotes([
      { x: 51, y: 52 },
      { x: 26, y: 42 },
      { x: 24, y: 77 },
    ]);
    expect(placed.map((n) => [n.index, n.side, n.noteY, n.elbow])).toEqual([
      [0, 'right', 52, false],
      [1, 'left', 42, false],
      [2, 'left', 77, false],
    ]);
    const strokes = leaderStrokes(placed[1]);
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).toMatchObject({ space: 'plate', x1: 26, y1: 42, x2: 0, y2: 42 });
    expect(strokes[1]).toMatchObject({ space: 'gutter', x1: 0, x2: GUTTER, y1: 42, y2: 42 });
    // The right side runs to the right edge.
    expect(leaderStrokes(placed[0])[0]).toMatchObject({ x2: 100 });
  });

  it('two notes of one side closer than 15 %: the lower one is pushed down and gets an elbow', () => {
    // Given out of order on purpose: sorting is by y, the result keeps the owner's order.
    const placed = placeNotes([
      { x: 30, y: 48 },
      { x: 20, y: 40 },
      { x: 70, y: 44 },
    ]);
    expect(placed[1]).toMatchObject({ side: 'left', noteY: 40, elbow: false });
    expect(placed[0]).toMatchObject({ side: 'left', noteY: 40 + NOTE_GAP, elbow: true });
    // The other side is not affected.
    expect(placed[2]).toMatchObject({ side: 'right', noteY: 44, elbow: false });

    const strokes = leaderStrokes(placed[0]);
    expect(strokes.map((s) => s.space)).toEqual(['plate', 'gutter', 'gutter', 'gutter']);
    // Horizontal to the edge, a short step out, down to the note, then on to it.
    expect(strokes[0]).toMatchObject({ x1: 30, y1: 48, x2: 0, y2: 48 });
    expect(strokes[2]).toMatchObject({ x1: GUTTER / 2, x2: GUTTER / 2, y1: 48, y2: 55 });
    expect(strokes[3]).toMatchObject({ x2: GUTTER, y1: 55, y2: 55 });
    // Each stroke starts before the one before it has ended; the leader fits in 1.3 s.
    for (let i = 1; i < strokes.length; i++) {
      expect(strokes[i].begin).toBeLessThanOrEqual(strokes[i - 1].begin + strokes[i - 1].dur);
    }
    const last = strokes[strokes.length - 1];
    expect(last.begin + last.dur).toBeCloseTo(1.3, 5);
  });

  it('a crowded column keeps the gap and never starts a note below the lowest height', () => {
    const placed = placeNotes([
      { x: 10, y: 80 },
      { x: 10, y: 84 },
      { x: 10, y: 95 },
    ]);
    const ys = placed.map((n) => n.noteY);
    expect(ys[2]).toBe(NOTE_MAX_Y);
    expect(ys[1]).toBe(NOTE_MAX_Y - NOTE_GAP);
    expect(ys[0]).toBe(NOTE_MAX_Y - 2 * NOTE_GAP);
    expect(placed.every((n) => n.elbow)).toBe(true);
  });
});
