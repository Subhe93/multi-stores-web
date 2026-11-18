// Motion recipes: the small vocabulary every section uses to describe its
// motion. Each helper returns data attributes to spread on an element, and
// an EMPTY object when the section got no `motion` prop (store switch off,
// or the section's own override "none"): the markup then stays byte for
// byte what it was.
//
//   <h2 {...rise(motion)}>…</h2>
//   <ul {...stagger(motion)}>{items.map((x, i) => <li {...item(motion, i)} />)}</ul>
//
// Pure module without imports: safe in server components and cheap inside
// client components. The numbers live in css/base.css.ts and
// css/motion.css.ts; the arming (what is below the fold starts hidden) in
// engine/core.ts.

/** 'intro' = first section of the page (plays on load, CSS only); 'scroll' = plays when it enters the viewport. */
export type Motion = 'intro' | 'scroll';
export type MotionProp = Motion | undefined;
export type MotionAttrs = { [k: `data-${string}`]: string | undefined };

export interface RevealOptions {
  /** Step in a sequence, 0..8 (0.09 s each; 0.04 s on fast surfaces). */
  i?: number;
  /** Extra start delay in tenths of a second, 0..12. */
  d?: number;
}

const NONE: MotionAttrs = Object.freeze({});

const int = (n: number | undefined, max: number): string | undefined => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined;
  return String(Math.min(Math.round(n), max));
};

function reveal(m: MotionProp, introKind: string, scrollKind: string, o?: RevealOptions): MotionAttrs {
  if (!m) return NONE;
  const attrs: MotionAttrs = m === 'intro' ? { 'data-cx-intro': introKind } : { 'data-cx-reveal': scrollKind };
  const i = int(o?.i, 8);
  const d = int(o?.d, 12);
  if (i) attrs['data-cx-i'] = i;
  if (d) attrs['data-cx-d'] = d;
  return attrs;
}

/** text-rise: fades in while rising a short distance. Text blocks, buttons, small groups. */
export function rise(m: MotionProp, o?: RevealOptions): MotionAttrs {
  return reveal(m, 'rise', 'rise', o);
}

/** Opacity only. For elements that must not move (overlays, badges on a photo). */
export function fade(m: MotionProp, o?: RevealOptions): MotionAttrs {
  return reveal(m, 'fade', 'fade', o);
}

/** line-draw: a hairline or rule grows from its inline start. */
export function line(m: MotionProp, o?: RevealOptions): MotionAttrs {
  return reveal(m, 'rule', 'line', o);
}

/**
 * cards-stagger, the container. On scroll its items rise one after the
 * other, row by row (the engine reads the rows). Mark the items with
 * item(); without marked items the container's children are used.
 */
export function stagger(m: MotionProp): MotionAttrs {
  return m === 'scroll' ? { 'data-cx-reveal': 'stagger' } : NONE;
}

/** cards-stagger, one item. `index` is its place in the list. */
export function item(m: MotionProp, index: number): MotionAttrs {
  if (!m) return NONE;
  if (m === 'scroll') return { 'data-cx-item': '' };
  const attrs: MotionAttrs = { 'data-cx-intro': 'rise' };
  const i = int(index, 5);
  if (i) attrs['data-cx-i'] = i;
  return attrs;
}

export type HoverKind = 'lift' | 'media' | 'underline' | 'press';

/**
 * Hover response (fine pointers only, CSS only).
 * lift = the card rises 4 px; media = the image inside zooms slowly to 1.045
 * (put it on the clipping frame); underline = a 1 px line sweeps in from the
 * inline start; press = buttons sink to 0.97 while pressed.
 */
export function hover(m: MotionProp, kind: HoverKind): MotionAttrs {
  return m ? { 'data-cx-hover': kind } : NONE;
}

/** button-magnetic: the element leans up to 8 px towards the pointer. Never on buy controls. */
export function magnetic(m: MotionProp): MotionAttrs {
  return m ? { 'data-cx-magnetic': '' } : NONE;
}

/**
 * media-parallax: the layer travels `y` percent of its own height while its
 * section crosses the viewport (default -6). Put it on a wrapper INSIDE a
 * clipping frame; the engine oversizes the layer so no edge shows. Desktop
 * only, off under the calm profile and on fast surfaces.
 */
export function parallax(m: MotionProp, y = -6): MotionAttrs {
  if (!m) return NONE;
  const travel = Math.max(-12, Math.min(12, Number.isFinite(y) ? y : -6));
  return { 'data-cx-behavior': 'scrub', 'data-cx-y': String(travel) };
}

/**
 * Decor drift: a small decorative element (the hero emblem) travels a short
 * way and may turn a little while its section crosses the viewport.
 * `y` in percent of its own height (-12..12, default -8), `rotate` in
 * degrees (-12..12, default 0; the sign flips in RTL). Same conditions as
 * media-parallax: 768 px and up, off under the calm profile. Never on a
 * photo: the element is not oversized.
 */
export function drift(m: MotionProp, o?: { y?: number; rotate?: number }): MotionAttrs {
  if (!m) return NONE;
  const clamp = (n: number | undefined, fallback: number) =>
    Math.max(-12, Math.min(12, typeof n === 'number' && Number.isFinite(n) ? n : fallback));
  const attrs: MotionAttrs = { 'data-cx-behavior': 'scrub', 'data-cx-drift': '', 'data-cx-y': String(clamp(o?.y, -8)) };
  const rotate = clamp(o?.rotate, 0);
  if (rotate) attrs['data-cx-rotate'] = String(rotate);
  return attrs;
}

/**
 * Root attributes for a surface the section renderer does not wrap (header,
 * drawers, cart, checkout, account pages): the engine arms the reveals
 * inside. `fast` = commerce timing (0.6 s, 14 px).
 */
export function surface(m: MotionProp, name: string, fast = false): MotionAttrs {
  if (!m) return NONE;
  const attrs: MotionAttrs = { 'data-cx-section': name };
  if (fast) attrs['data-cx-tier'] = 'fast';
  return attrs;
}
