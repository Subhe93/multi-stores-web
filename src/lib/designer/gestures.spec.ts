import { describe, expect, it } from 'vitest';
import {
  backingScale,
  clampAdj,
  clientToMm,
  containsPoint,
  hitTest,
  keyAdj,
  normalizeDeg,
  panByDrag,
  pinchStart,
  pinchUpdate,
  pxToMm,
  touchDirection,
  wheelAdj,
} from './gestures';
import { DEFAULT_ADJ, type ImageSlotElement, type TemplateSpecV1 } from './design-renderer';

const slot = { x: 100, y: 100, w: 200, h: 200, rot: 0 };
const adj = { ...DEFAULT_ADJ };

describe('panByDrag (NPP cover math)', () => {
  it('moves the image with the finger: right drag lowers panX by dx / overflow', () => {
    // Landscape 2000x1000 in a square 200mm slot: cover width 400mm, overflow 200mm.
    const next = panByDrag(slot, 2000, 1000, adj, 20, 0);
    expect(next.panX).toBeCloseTo(0.5 - 20 / 200);
    expect(next.panY).toBe(0.5); // no vertical overflow: unchanged
  });

  it('uses the zoomed overflow and clamps to 0..1', () => {
    const zoomed = { ...adj, zoom: 2 };
    // Square image at zoom 2: 400mm, overflow 200mm on both axes.
    const next = panByDrag(slot, 1000, 1000, zoomed, -40, 1000);
    expect(next.panX).toBeCloseTo(0.5 + 40 / 200);
    expect(next.panY).toBe(0);
  });

  it('takes a rotated slot into its own frame', () => {
    const rotated = { ...slot, rot: 90 };
    // A slot turned 90° clockwise has its own x axis pointing down the screen.
    const next = panByDrag(rotated, 2000, 1000, adj, 0, 20);
    expect(next.panX).toBeCloseTo(0.5 - 20 / 200);
    expect(next.panY).toBe(0.5);
  });

  it('keeps the pan without overflow (zoom 1, same aspect)', () => {
    expect(panByDrag(slot, 1000, 1000, adj, 50, 50)).toEqual(adj);
  });
});

describe('pinch', () => {
  it('scales zoom by the distance ratio and turns by the angle change, clamped', () => {
    const start = pinchStart({ x: 0, y: 0 }, { x: 100, y: 0 }, adj);
    const zoomed = pinchUpdate(start, { x: 0, y: 0 }, { x: 150, y: 0 }, adj);
    expect(zoomed.zoom).toBeCloseTo(1.5);
    const turned = pinchUpdate(start, { x: 0, y: 0 }, { x: 0, y: 100 }, adj);
    expect(turned.rot).toBeCloseTo(90);
    const huge = pinchUpdate(start, { x: 0, y: 0 }, { x: 1000, y: 0 }, adj);
    expect(huge.zoom).toBe(3);
    const small = pinchUpdate(start, { x: 0, y: 0 }, { x: 10, y: 0 }, adj);
    expect(small.zoom).toBe(1);
  });

  it('wraps angles across ±180', () => {
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(180)).toBe(180);
    const start = pinchStart({ x: 0, y: 0 }, { x: -100, y: 1 }, { ...adj, rot: 170 }); // ~179.4°
    const next = pinchUpdate(start, { x: 0, y: 0 }, { x: -100, y: -20 }, { ...adj, rot: 170 }); // ~-168.7°
    // 170 + ~11.9 = ~181.9, i.e. ~-178.1 after wrapping (not a jump to -360).
    expect(next.rot).toBeCloseTo(-178.12, 1);
  });
});

describe('wheel and keyboard', () => {
  it('wheel up zooms in, Shift+wheel rotates', () => {
    expect(wheelAdj(adj, -100, false).zoom).toBeGreaterThan(1);
    expect(wheelAdj(adj, 100, false).zoom).toBe(1);
    expect(wheelAdj(adj, 100, true).rot).toBeCloseTo(15);
  });

  it('arrow keys move the image like a drag; + - [ ] 0', () => {
    expect(keyAdj('ArrowLeft', adj, false)!.panX).toBeCloseTo(0.52);
    expect(keyAdj('ArrowRight', adj, true)!.panX).toBeCloseTo(0.4);
    expect(keyAdj('ArrowUp', adj, false)!.panY).toBeCloseTo(0.52);
    expect(keyAdj('+', adj, false)!.zoom).toBeCloseTo(1.05);
    expect(keyAdj('-', adj, false)!.zoom).toBe(1);
    expect(keyAdj(']', adj, true)!.rot).toBe(15);
    expect(keyAdj('0', { zoom: 2, rot: 30, panX: 0, panY: 1 }, false)).toEqual(DEFAULT_ADJ);
    expect(keyAdj('a', adj, false)).toBeNull();
  });

  it('clampAdj enforces limits', () => {
    expect(clampAdj({ zoom: 9, rot: -999, panX: -1, panY: 2 })).toEqual({ zoom: 3, rot: -180, panX: 0, panY: 1 });
  });
});

describe('coordinates and hit-testing', () => {
  const spec = {
    width: 500,
    height: 700,
    surfaces: [
      {
        key: 'front',
        background: { color: '#fff', fit: 'stretch' },
        elements: [
          { id: 'photo', type: 'image_slot', shape: 'ellipse', x: 100, y: 100, w: 200, h: 100, rot: 0, z: 1, locked: false },
          { id: 'name', type: 'text', editable: true, x: 0, y: 600, w: 500, h: 50, rot: 0, z: 2, locked: false },
          { id: 'logo', type: 'text', editable: false, x: 0, y: 650, w: 500, h: 50, rot: 0, z: 3, locked: true },
          { id: 'frame', type: 'image', x: 0, y: 0, w: 500, h: 700, rot: 0, z: 9, locked: true },
        ],
      },
    ],
  } as unknown as TemplateSpecV1;

  it('maps client px to template mm', () => {
    expect(clientToMm(150, 270, { left: 50, top: 20, width: 250, height: 350 }, spec)).toEqual({ x: 200, y: 500 });
    expect(pxToMm(10, 250, 500)).toBe(20);
  });

  it('finds slots (ellipse aware) and editable texts under decorations', () => {
    expect(hitTest(spec, { x: 200, y: 150 })?.id).toBe('photo');
    expect(hitTest(spec, { x: 105, y: 105 })).toBeNull(); // outside the ellipse corner
    expect(hitTest(spec, { x: 250, y: 620 })?.id).toBe('name');
    expect(hitTest(spec, { x: 250, y: 680 })).toBeNull(); // non-editable text
  });

  it('honours element rotation', () => {
    const el = { id: 's', type: 'image_slot', shape: 'rect', x: 0, y: 0, w: 100, h: 20, rot: 90, z: 0, locked: false } as unknown as ImageSlotElement;
    expect(containsPoint(el, { x: 50, y: 50 })).toBe(true); // along the rotated long side
    expect(containsPoint(el, { x: 95, y: 10 })).toBe(false);
  });

  it('caps the backing store width', () => {
    expect(backingScale(400, 2, 500)).toBeCloseTo(800 / 500);
    expect(backingScale(1000, 3, 500)).toBeCloseTo(1400 / 500);
  });
});

describe('touchDirection (NPP scroll-vs-pan heuristic)', () => {
  it('stays undecided inside the 4px slop square', () => {
    expect(touchDirection(0, 0)).toBe('undecided');
    expect(touchDirection(3, -3)).toBe('undecided');
    expect(touchDirection(-3.9, 3.9)).toBe('undecided');
  });

  it('a mostly vertical move lets the page scroll', () => {
    expect(touchDirection(0, 5)).toBe('scroll');
    expect(touchDirection(2, -9)).toBe('scroll');
    expect(touchDirection(4, 5)).toBe('scroll');
  });

  it('a horizontal or diagonal move pans the photo (ties pan)', () => {
    expect(touchDirection(5, 0)).toBe('pan');
    expect(touchDirection(-7, 2)).toBe('pan');
    expect(touchDirection(5, 5)).toBe('pan');
    expect(touchDirection(1, 4)).toBe('scroll');
  });

  it('honours a custom slop', () => {
    expect(touchDirection(6, 0, 8)).toBe('undecided');
    expect(touchDirection(9, 0, 8)).toBe('pan');
  });
});
