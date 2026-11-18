// Geometry of the "impact-arc" gauge: a half circle over a horizon in a
// fixed 800 x 400 user space. The horizon is the bottom edge (y = 400), the
// centre of the circle sits on it. Pure numbers, no React: covered by
// impactArcGeometry.spec.ts.
//
// Direction: in a left-to-right store the arc starts at the left end and
// runs over the top to the right end; in a right-to-left store it starts at
// the right end. Nothing is mirrored with a transform: the path itself is
// generated in the other direction.

export const ARC = { width: 800, height: 400, cx: 400, cy: 400, r: 360 } as const;

/** Length of a tick outside the track, in user units. */
export const TICK = 8;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A positive finite number, else null (the goal; without it there is no gauge). */
export function goalValue(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/** A finite number >= 0, else null (empty = nothing verified yet). */
export function reachedValue(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/** reached / goal, clamped to 0..1. No goal or no figure gives 0. */
export function arcFraction(reached: number | null, goal: number | null): number {
  if (goal === null || reached === null || !(goal > 0)) return 0;
  const f = reached / goal;
  if (!Number.isFinite(f)) return 0;
  return Math.min(1, Math.max(0, f));
}

/**
 * Point on the circle of radius `radius` at `fraction` of the way along the
 * arc (0 = start end on the horizon, 0.5 = the top, 1 = the other end).
 */
export function arcPoint(fraction: number, rtl = false, radius: number = ARC.r): { x: number; y: number } {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const angle = Math.PI * f;
  const dx = Math.cos(angle) * radius;
  return {
    // LTR starts at cx - r and moves right; RTL starts at cx + r and moves left.
    x: r2(rtl ? ARC.cx + dx : ARC.cx - dx),
    y: r2(ARC.cy - Math.sin(angle) * radius),
  };
}

/** The half circle as one path, drawn from the start end over the top. */
export function arcPath(rtl = false): string {
  const start = arcPoint(0, rtl);
  const end = arcPoint(1, rtl);
  // Sweep 1 = clockwise on screen (left to right over the top).
  return `M${start.x} ${start.y} A${ARC.r} ${ARC.r} 0 0 ${rtl ? 0 : 1} ${end.x} ${end.y}`;
}

/**
 * A tick outside the track at `fraction`. The two end ticks would lie on the
 * horizon, so they point down from it instead (the end labels sit under them).
 */
export function arcTick(fraction: number, rtl = false): { x1: number; y1: number; x2: number; y2: number } {
  const a = arcPoint(fraction, rtl);
  if (fraction <= 0 || fraction >= 1) return { x1: a.x, y1: a.y, x2: a.x, y2: a.y + TICK };
  const b = arcPoint(fraction, rtl, ARC.r + TICK);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

/** A user-space point as percentages of the gauge box (for an HTML overlay). */
export function toPercent(p: { x: number; y: number }): { left: string; top: string } {
  return { left: `${r2((p.x / ARC.width) * 100)}%`, top: `${r2((p.y / ARC.height) * 100)}%` };
}
