import { describe, expect, it } from 'vitest';
import { computeProgress, statusValue } from './progress';

const run = (goal: unknown, reached: unknown, status: unknown = 'in_progress', show: unknown = true) =>
  computeProgress({ goal, reached, status, show });

describe('computeProgress', () => {
  it('has no goal, no percent and no bar when the goal is missing, 0, negative or not a number', () => {
    for (const goal of [undefined, null, '', '   ', 0, -5, Number.NaN, Number.POSITIVE_INFINITY, 'abc', {}, []]) {
      expect(run(goal, 10), String(goal)).toEqual({ goal: null, reached: 10, percent: null, showBar: false });
    }
  });

  it('computes a floored whole percent from the two numbers', () => {
    expect(run(100, 60)).toEqual({ goal: 100, reached: 60, percent: 60, showBar: true });
    expect(run(3, 1).percent).toBe(33);
    expect(run(3, 2).percent).toBe(66);
    expect(run(100, 0).percent).toBe(0);
  });

  it('is exact for whole numbers (no floating-point loss before the floor)', () => {
    // 29 / 100 * 100 is 28.999999999999996 in floating point.
    expect(run(100, 29).percent).toBe(29);
    expect(run(100, 57).percent).toBe(57);
    expect(run(100, 58).percent).toBe(58);
    for (let reached = 0; reached <= 100; reached++) {
      expect(run(100, reached).percent, `${reached} of 100`).toBe(reached);
    }
    // Every whole pair up to 1000 equals integer division.
    for (let goal = 1; goal <= 1000; goal++) {
      for (let reached = 0; reached <= goal; reached++) {
        const exact = (reached * 100 - ((reached * 100) % goal)) / goal;
        if (run(goal, reached).percent !== exact) {
          throw new Error(`${reached} of ${goal}: got ${run(goal, reached).percent}, expected ${exact}`);
        }
      }
    }
  });

  it('is exact for decimals and never rounds an unmet goal up to 100', () => {
    expect(run(1, 0.29).percent).toBe(29);
    expect(run(1, 0.57).percent).toBe(57);
    expect(run(2.5, 1).percent).toBe(40);
    expect(run(1, 0.9999999999999).percent).toBe(99);
    expect(run(1e12, 1e12 - 1).percent).toBe(99);
  });

  it('shows 100 only once the goal is met', () => {
    expect(run(1000, 996).percent).toBe(99);
    expect(run(1000, 999.9).percent).toBe(99);
    expect(run(1000, 1000).percent).toBe(100);
  });

  it('caps a result above the goal at 100 and keeps the real reached number', () => {
    expect(run(100, 250)).toEqual({ goal: 100, reached: 250, percent: 100, showBar: true });
  });

  it('reads a missing, negative or invalid reached value as 0', () => {
    for (const reached of [undefined, null, '', -1, Number.NaN, 'x']) {
      expect(run(100, reached), String(reached)).toMatchObject({ reached: 0, percent: 0 });
    }
  });

  it('never shows a bar for a planned goal', () => {
    expect(run(100, 60, 'planned')).toEqual({ goal: 100, reached: 60, percent: 60, showBar: false });
  });

  it('shows the bar only for the literal true', () => {
    for (const show of [undefined, null, false, 'true', 1]) {
      // Called directly: the helper above would turn undefined into true.
      const result = computeProgress({ goal: 100, reached: 60, status: 'in_progress', show });
      expect(result.showBar, String(show)).toBe(false);
    }
    expect(run(100, 60, 'none').showBar).toBe(true);
  });

  it('does not change the numbers of a completed goal', () => {
    expect(run(100, 40, 'completed')).toEqual({ goal: 100, reached: 40, percent: 40, showBar: true });
  });

  it('accepts numeric strings', () => {
    expect(run('200', '50')).toEqual({ goal: 200, reached: 50, percent: 25, showBar: true });
  });
});

describe('statusValue', () => {
  it('keeps the four known values and falls back otherwise', () => {
    for (const s of ['none', 'planned', 'in_progress', 'completed']) expect(statusValue(s)).toBe(s);
    expect(statusValue(undefined)).toBe('none');
    expect(statusValue('done')).toBe('none');
    expect(statusValue(undefined, 'in_progress')).toBe('in_progress');
    expect(statusValue('in-progress', 'in_progress')).toBe('in_progress');
  });
});
