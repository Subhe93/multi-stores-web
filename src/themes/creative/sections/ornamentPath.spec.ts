import { describe, expect, it } from 'vitest';
import { ornamentPaths, sanitizePathData } from './ornamentPath';

describe('sanitizePathData', () => {
  it('keeps plain path data (trimmed)', () => {
    expect(sanitizePathData('  M0 1 H120 ')).toBe('M0 1 H120');
    expect(sanitizePathData('M36 16 L44 24 L36 32 L28 24 Z')).toBe('M36 16 L44 24 L36 32 L28 24 Z');
    expect(sanitizePathData('M10,10 c-1.5,.5 3,-4 6,2 a4 4 0 0 1 2 2z')).toBe('M10,10 c-1.5,.5 3,-4 6,2 a4 4 0 0 1 2 2z');
  });

  it('rejects markup, quotes and CSS functions', () => {
    expect(sanitizePathData('M0 0"/><script>alert(1)</script>')).toBeNull();
    expect(sanitizePathData('M0 0 <')).toBeNull();
    expect(sanitizePathData("M0 0' onload='x")).toBeNull();
    expect(sanitizePathData('M0 0"')).toBeNull();
    expect(sanitizePathData('url(#a)')).toBeNull();
    expect(sanitizePathData('M0 0 url(javascript:1)')).toBeNull();
    expect(sanitizePathData('M0 0; fill: red')).toBeNull();
    expect(sanitizePathData('M0 0 &lt;')).toBeNull();
  });

  it('rejects letters outside the path command set', () => {
    expect(sanitizePathData('M0 0 X10')).toBeNull();
    expect(sanitizePathData('M0 0 1e3')).toBeNull();
    expect(sanitizePathData('hello')).toBeNull();
  });

  it('rejects empty, non-string and over-long input', () => {
    expect(sanitizePathData('')).toBeNull();
    expect(sanitizePathData('   ')).toBeNull();
    expect(sanitizePathData(null)).toBeNull();
    expect(sanitizePathData(12)).toBeNull();
    expect(sanitizePathData({ d: 'M0 0' })).toBeNull();
    expect(sanitizePathData(`M0 0 ${'L1 1 '.repeat(120)}`)).toBeNull();
    expect(sanitizePathData(`M${'1'.repeat(599)}`)).toBe(`M${'1'.repeat(599)}`);
  });
});

describe('ornamentPaths', () => {
  it('skips unsafe entries, caps the list and defaults the colour', () => {
    const list = ornamentPaths(
      [
        { d: 'M0 1 H120', color: 'b' },
        { d: '<svg onload=x>', color: 'a' },
        null,
        'M0 0',
        { d: 'M0 47 H120', color: 'zz' },
        { d: 'M0 24 H12', color: 'c' },
      ],
      5,
    );
    expect(list).toEqual([
      { d: 'M0 1 H120', color: 'b' },
      { d: 'M0 47 H120', color: 'a' },
    ]);
    expect(ornamentPaths('M0 0', 12)).toEqual([]);
    expect(ornamentPaths(undefined, 12)).toEqual([]);
  });
});
