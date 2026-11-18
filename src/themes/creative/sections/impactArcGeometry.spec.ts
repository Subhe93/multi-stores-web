import { describe, expect, it } from 'vitest';
import { ARC, arcFraction, arcPath, arcPoint, arcTick, goalValue, reachedValue, toPercent } from './impactArcGeometry';

describe('impact-arc geometry', () => {
  it('reads the goal and the reached figure, refusing junk', () => {
    expect(goalValue(100)).toBe(100);
    expect(goalValue('250')).toBe(250);
    expect(goalValue(0)).toBeNull();
    expect(goalValue(-5)).toBeNull();
    expect(goalValue('')).toBeNull();
    expect(goalValue('abc')).toBeNull();
    expect(goalValue(undefined)).toBeNull();
    expect(reachedValue(0)).toBe(0);
    expect(reachedValue('37')).toBe(37);
    expect(reachedValue('')).toBeNull();
    expect(reachedValue(null)).toBeNull();
    expect(reachedValue(-1)).toBeNull();
  });

  it('clamps the fraction to 0..1', () => {
    expect(arcFraction(37, 100)).toBeCloseTo(0.37);
    expect(arcFraction(0, 100)).toBe(0);
    expect(arcFraction(150, 100)).toBe(1);
    expect(arcFraction(null, 100)).toBe(0);
    expect(arcFraction(10, null)).toBe(0);
  });

  it('turns a fraction into a point on the arc', () => {
    expect(arcPoint(0)).toEqual({ x: 40, y: 400 });
    expect(arcPoint(0.5)).toEqual({ x: 400, y: 40 });
    expect(arcPoint(1)).toEqual({ x: 760, y: 400 });
    const quarter = arcPoint(0.25);
    expect(quarter.x).toBeCloseTo(ARC.cx - ARC.r * Math.SQRT1_2, 1);
    expect(quarter.y).toBeCloseTo(ARC.cy - ARC.r * Math.SQRT1_2, 1);
    // Out of range values stay on the arc.
    expect(arcPoint(-1)).toEqual({ x: 40, y: 400 });
    expect(arcPoint(7)).toEqual({ x: 760, y: 400 });
  });

  it('starts at the other end in a right-to-left store', () => {
    expect(arcPoint(0, true)).toEqual({ x: 760, y: 400 });
    expect(arcPoint(1, true)).toEqual({ x: 40, y: 400 });
    expect(arcPoint(0.25, true).x).toBeCloseTo(ARC.width - arcPoint(0.25).x, 1);
    expect(arcPoint(0.25, true).y).toBe(arcPoint(0.25).y);
    expect(arcPath()).toBe('M40 400 A360 360 0 0 1 760 400');
    expect(arcPath(true)).toBe('M760 400 A360 360 0 0 0 40 400');
  });

  it('draws ticks outside the track; end ticks point below the horizon', () => {
    expect(arcTick(0.5)).toEqual({ x1: 400, y1: 40, x2: 400, y2: 32 });
    expect(arcTick(0)).toEqual({ x1: 40, y1: 400, x2: 40, y2: 408 });
    expect(arcTick(1, true)).toEqual({ x1: 40, y1: 400, x2: 40, y2: 408 });
  });

  it('gives overlay positions as percentages of the gauge box', () => {
    expect(toPercent({ x: 400, y: 40 })).toEqual({ left: '50%', top: '10%' });
    expect(toPercent({ x: 40, y: 400 })).toEqual({ left: '5%', top: '100%' });
  });
});
