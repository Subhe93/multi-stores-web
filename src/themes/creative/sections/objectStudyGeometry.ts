// Geometry of "object-study": where each note sits beside the plate and
// which strokes lead to it. Pure functions, computed on the server from the
// owner's percentages; nothing here measures the page.
//
// All x / y are PHYSICAL percentages of the plate (from its left and top
// edge) in every writing direction: a note belongs to the point it
// describes, so it stays on that side of the object in Arabic too.
//
// A leader is a chain of straight strokes:
//   plate  dot -> the plate's edge on the nearer side          (percentages)
//   gutter edge -> 24 px outwards, where the note starts       (pixels)
// When two notes of one side are closer than 15 % of the plate height the
// lower one is pushed down and its leader becomes an elbow: in the gutter it
// goes 12 px out, turns to the note's height and goes 12 px on.

export type NoteSide = 'left' | 'right';

export interface NotePoint {
  x: number;
  y: number;
}

export interface PlacedNote extends NotePoint {
  /** Place in the owner's list, 0-based (the printed number is index + 1). */
  index: number;
  side: NoteSide;
  /** Height of the note beside the plate, in percent of the plate height. */
  noteY: number;
  /** True when the note is not at the height of its point. */
  elbow: boolean;
}

export interface LeaderStroke {
  /** 'plate': x in percent of the plate. 'gutter': x in px outwards from the plate edge (always positive). */
  space: 'plate' | 'gutter';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Start and length of the stroke inside the 1.3 s of its leader, in seconds. */
  begin: number;
  dur: number;
}

/** Smallest distance between two notes of one side, in percent of the plate height. */
export const NOTE_GAP = 15;
/** A note never starts lower than this (its text hangs below the line). */
export const NOTE_MAX_Y = 88;
/** How far the leader runs beyond the plate edge, in px. */
export const GUTTER = 24;

const round = (n: number) => Math.round(n * 100) / 100;

/** A percentage 0..100 from a number or a numeric string; anything else is null. */
export function percent(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return round(Math.min(100, Math.max(0, n)));
}

/** The nearer physical side of the plate: left for x below 50, else right. */
export function sideOf(x: number): NoteSide {
  return x < 50 ? 'left' : 'right';
}

/**
 * Places the notes. Per side they are sorted by y; a note closer than `gap`
 * to the one above is pushed down to keep the gap. If that runs past the
 * lowest allowed height the column is moved back up, still keeping the gap.
 * Returned in the owner's order.
 */
export function placeNotes(points: NotePoint[], gap: number = NOTE_GAP): PlacedNote[] {
  const placed: PlacedNote[] = points.map((p, index) => ({
    index,
    x: p.x,
    y: p.y,
    side: sideOf(p.x),
    noteY: p.y,
    elbow: false,
  }));
  for (const side of ['left', 'right'] as const) {
    const column = placed.filter((n) => n.side === side).sort((a, b) => a.y - b.y || a.index - b.index);
    for (let i = 0; i < column.length; i++) {
      const floor = i > 0 ? column[i - 1].noteY + gap : 0;
      column[i].noteY = Math.max(column[i].y, floor);
    }
    for (let i = column.length - 1; i >= 0; i--) {
      const ceiling = i < column.length - 1 ? column[i + 1].noteY - gap : NOTE_MAX_Y;
      column[i].noteY = Math.max(0, Math.min(column[i].noteY, ceiling));
    }
    for (const n of column) {
      n.noteY = round(n.noteY);
      n.elbow = Math.abs(n.noteY - n.y) > 0.01;
    }
  }
  return placed;
}

/** The strokes of one leader, in drawing order (from the dot outwards). */
export function leaderStrokes(note: PlacedNote): LeaderStroke[] {
  const edge = note.side === 'left' ? 0 : 100;
  if (!note.elbow) {
    return [
      { space: 'plate', x1: note.x, y1: note.y, x2: edge, y2: note.y, begin: 0, dur: 1.1 },
      { space: 'gutter', x1: 0, y1: note.y, x2: GUTTER, y2: note.y, begin: 1, dur: 0.3 },
    ];
  }
  const half = GUTTER / 2;
  return [
    { space: 'plate', x1: note.x, y1: note.y, x2: edge, y2: note.y, begin: 0, dur: 0.85 },
    { space: 'gutter', x1: 0, y1: note.y, x2: half, y2: note.y, begin: 0.75, dur: 0.15 },
    { space: 'gutter', x1: half, y1: note.y, x2: half, y2: note.noteY, begin: 0.88, dur: 0.27 },
    { space: 'gutter', x1: half, y1: note.noteY, x2: GUTTER, y2: note.noteY, begin: 1.12, dur: 0.18 },
  ];
}
