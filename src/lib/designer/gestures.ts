// ── Designer editor: gesture math (M4.2 §7.1/§7.2) ────────────────────────
// Pure functions behind the canvas interactions: drag → pan, pinch → zoom,
// two-finger turn → rotation, wheel and keyboard steps, hit-testing. No DOM,
// so every rule is unit-tested. All lengths are template millimetres.

import {
  coverLayout,
  DEFAULT_ADJ,
  sortElements,
  type DesignElement,
  type ElementBase,
  type ImageSlotElement,
  type PhotoAdj,
  type TemplateSpecV1,
} from './design-renderer';

const EPS = 1e-6;
const DEG = Math.PI / 180;

export interface AdjLimits {
  zoom: [number, number];
  rot: [number, number];
}

export const DEFAULT_LIMITS: AdjLimits = { zoom: [1, 3], rot: [-180, 180] };

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/** Slot limits (template `adj_limits`, NPP defaults otherwise). */
export function limitsOf(slot: Pick<ImageSlotElement, 'adj_limits'>): AdjLimits {
  const l = slot.adj_limits;
  return {
    zoom: l && Array.isArray(l.zoom) ? [l.zoom[0], l.zoom[1]] : DEFAULT_LIMITS.zoom,
    rot: l && Array.isArray(l.rot) ? [l.rot[0], l.rot[1]] : DEFAULT_LIMITS.rot,
  };
}

/** Clamps every field of an adjustment into the slot limits (pan 0..1). */
export function clampAdj(adj: PhotoAdj, limits: AdjLimits = DEFAULT_LIMITS): PhotoAdj {
  return {
    zoom: clamp(adj.zoom, limits.zoom[0], limits.zoom[1]),
    rot: clamp(adj.rot, limits.rot[0], limits.rot[1]),
    panX: clamp(adj.panX, 0, 1),
    panY: clamp(adj.panY, 0, 1),
  };
}

/** Wraps an angle into (-180, 180]. */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

/** Rotates a vector by `deg` degrees (canvas convention: y down, clockwise positive). */
export function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  if (!deg) return { x, y };
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Screen-space delta → the element's own (unrotated) frame. */
export function toElementDelta(el: Pick<ElementBase, 'rot'>, dx: number, dy: number): { x: number; y: number } {
  return rotateVec(dx, dy, -(el.rot || 0));
}

/**
 * Drag → pan (NPP cover math): `panX -= dx_mm / (zw_mm - w_mm)`, same for y.
 * The delta is first taken into the slot's frame (rotated slots). An axis
 * with no overflow keeps its pan. Result clamped to 0..1.
 */
export function panByDrag(
  slot: Pick<ElementBase, 'x' | 'y' | 'w' | 'h' | 'rot'>,
  imgW: number,
  imgH: number,
  adj: PhotoAdj,
  dxMm: number,
  dyMm: number,
): PhotoAdj {
  const d = toElementDelta(slot, dxMm, dyMm);
  const l = coverLayout(slot, imgW, imgH, adj, 1);
  const overX = l.dw - slot.w;
  const overY = l.dh - slot.h;
  return {
    ...adj,
    panX: overX > EPS ? clamp(adj.panX - d.x / overX, 0, 1) : adj.panX,
    panY: overY > EPS ? clamp(adj.panY - d.y / overY, 0, 1) : adj.panY,
  };
}

export interface PinchStart {
  dist: number;
  angle: number;
  zoom: number;
  rot: number;
}

export interface Point {
  x: number;
  y: number;
}

export function pointerDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle of the a→b line in degrees. */
export function pointerAngle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x) / DEG;
}

export function pinchStart(a: Point, b: Point, adj: PhotoAdj): PinchStart {
  return { dist: pointerDistance(a, b), angle: pointerAngle(a, b), zoom: adj.zoom, rot: adj.rot };
}

/** Two pointers → zoom (distance ratio) and rotation (angle change), clamped. */
export function pinchUpdate(
  start: PinchStart,
  a: Point,
  b: Point,
  adj: PhotoAdj,
  limits: AdjLimits = DEFAULT_LIMITS,
): PhotoAdj {
  const dist = pointerDistance(a, b);
  const ratio = start.dist > EPS ? dist / start.dist : 1;
  const turn = normalizeDeg(pointerAngle(a, b) - start.angle);
  return {
    ...adj,
    zoom: clamp(start.zoom * ratio, limits.zoom[0], limits.zoom[1]),
    rot: clamp(normalizeDeg(start.rot + turn), limits.rot[0], limits.rot[1]),
  };
}

/** Mouse wheel: zoom (exponential, scroll up = in); with Shift it rotates instead. */
export function wheelAdj(
  adj: PhotoAdj,
  deltaY: number,
  shift: boolean,
  limits: AdjLimits = DEFAULT_LIMITS,
): PhotoAdj {
  if (shift) {
    return { ...adj, rot: clamp(adj.rot + clamp(deltaY, -100, 100) * 0.15, limits.rot[0], limits.rot[1]) };
  }
  return { ...adj, zoom: clamp(adj.zoom * Math.exp(-clamp(deltaY, -100, 100) * 0.002), limits.zoom[0], limits.zoom[1]) };
}

/**
 * Keyboard control of the active photo (canvas focused):
 * arrows pan (Shift = bigger step), +/- zoom, [ ] rotate, 0 resets.
 * Returns null for keys it does not handle. Arrow keys move the IMAGE in
 * the arrow's direction (like dragging), independent of the UI direction.
 */
export function keyAdj(
  key: string,
  adj: PhotoAdj,
  shift: boolean,
  limits: AdjLimits = DEFAULT_LIMITS,
  reset: PhotoAdj = DEFAULT_ADJ,
): PhotoAdj | null {
  const pan = shift ? 0.1 : 0.02;
  const rot = shift ? 15 : 1;
  let next: PhotoAdj;
  switch (key) {
    case 'ArrowLeft':
      next = { ...adj, panX: adj.panX + pan };
      break;
    case 'ArrowRight':
      next = { ...adj, panX: adj.panX - pan };
      break;
    case 'ArrowUp':
      next = { ...adj, panY: adj.panY + pan };
      break;
    case 'ArrowDown':
      next = { ...adj, panY: adj.panY - pan };
      break;
    case '+':
    case '=':
      next = { ...adj, zoom: adj.zoom + (shift ? 0.25 : 0.05) };
      break;
    case '-':
    case '_':
      next = { ...adj, zoom: adj.zoom - (shift ? 0.25 : 0.05) };
      break;
    case ']':
      next = { ...adj, rot: adj.rot + rot };
      break;
    case '[':
      next = { ...adj, rot: adj.rot - rot };
      break;
    case '0':
      next = { ...reset };
      break;
    default:
      return null;
  }
  return clampAdj(next, limits);
}

/** Client (CSS px) → template mm, for a canvas box showing the whole template. */
export function clientToMm(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  spec: Pick<TemplateSpecV1, 'width' | 'height'>,
): Point {
  const sx = rect.width > 0 ? spec.width / rect.width : 0;
  const sy = rect.height > 0 ? spec.height / rect.height : 0;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

/** CSS px delta → mm. */
export function pxToMm(px: number, rectWidth: number, specWidth: number): number {
  return rectWidth > 0 ? (px * specWidth) / rectWidth : 0;
}

/** True when a point (mm) is inside an element, honouring its rotation and an ellipse shape. */
export function containsPoint(el: DesignElement, p: Point): boolean {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const local = rotateVec(p.x - cx, p.y - cy, -(el.rot || 0));
  if (el.type === 'image_slot' && el.shape === 'ellipse') {
    const rx = el.w / 2;
    const ry = el.h / 2;
    if (rx <= 0 || ry <= 0) return false;
    return (local.x * local.x) / (rx * rx) + (local.y * local.y) / (ry * ry) <= 1;
  }
  return Math.abs(local.x) <= el.w / 2 && Math.abs(local.y) <= el.h / 2;
}

/**
 * Top-most customer-interactive element under a point: image slots and
 * editable texts (decorations never block). Draw order = (z, index), so the
 * search runs from the end.
 */
export function hitTest(spec: TemplateSpecV1, p: Point): DesignElement | null {
  const sf = (spec.surfaces || []).find((s) => s.key === 'front');
  if (!sf) return null;
  const sorted = sortElements(sf.elements || []);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const el = sorted[i]!;
    const interactive = el.type === 'image_slot' || (el.type === 'text' && el.editable);
    if (interactive && containsPoint(el, p)) return el;
  }
  return null;
}

/** Scale (px per mm) of a backing store at most `maxPx` wide for a box `cssWidth` wide. */
export function backingScale(cssWidth: number, dpr: number, specWidth: number, maxPx = 1400): number {
  const px = Math.max(1, Math.min(Math.round(cssWidth * Math.max(1, dpr)), maxPx));
  return specWidth > 0 ? px / specWidth : 1;
}

export type TouchDecision = 'undecided' | 'scroll' | 'pan';

/**
 * Touch on a photo: scroll the page or pan the photo? NPP's rule, applied to
 * the first movement: nothing is decided inside a `slopPx` square around the
 * touch point; past it, a mostly vertical move is a page scroll (the finger
 * is released to the browser) and anything else pans the photo. The canvas
 * keeps `touch-action: pan-y`, so the browser reaches the same verdict for
 * vertical moves and cancels the pointer.
 */
export function touchDirection(dx: number, dy: number, slopPx = 4): TouchDecision {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < slopPx && ay < slopPx) return 'undecided';
  return ay > ax ? 'scroll' : 'pan';
}
