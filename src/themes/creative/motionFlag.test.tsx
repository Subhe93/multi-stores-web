import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMotionFlag, MOTION_FLAG_SCRIPT, motionForced, setMotionFlag } from './motionFlag';

const html = () => document.documentElement;
const flagged = () => html().hasAttribute('data-cx-motion');

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('prefers-reduced-motion'), media: query })),
  );
}

/** Runs the inline script exactly as the browser would. */
function runScript() {
  new Function(MOTION_FLAG_SCRIPT)();
}

function setSearch(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

describe('motion flag', () => {
  beforeEach(() => {
    clearMotionFlag();
    window.sessionStorage.clear();
    setSearch('');
  });
  afterEach(() => {
    clearMotionFlag();
    window.sessionStorage.clear();
    setSearch('');
  });

  it('sets the attribute when the visitor allows motion', () => {
    stubReducedMotion(false);
    expect(setMotionFlag()).toBe(true);
    expect(flagged()).toBe(true);
    expect(html().getAttribute('data-cx-motion')).toBe('');
  });

  it('reduced motion: no attribute', () => {
    stubReducedMotion(true);
    expect(setMotionFlag()).toBe(false);
    expect(flagged()).toBe(false);
  });

  it('the per-tab override opens the gate under reduced motion and survives a navigation', () => {
    stubReducedMotion(true);
    setSearch('?cx-motion=force');
    expect(setMotionFlag()).toBe(true);
    expect(motionForced()).toBe(true);
    // Next page of the same tab, without the query.
    clearMotionFlag();
    setSearch('');
    expect(setMotionFlag()).toBe(true);
  });

  it('another tab (empty session storage) is not forced', () => {
    stubReducedMotion(true);
    expect(motionForced()).toBe(false);
    expect(setMotionFlag()).toBe(false);
  });

  it('clearMotionFlag removes the attribute', () => {
    stubReducedMotion(false);
    setMotionFlag();
    clearMotionFlag();
    expect(flagged()).toBe(false);
  });

  it.each([
    [false, '', true],
    [true, '', false],
    [true, '?cx-motion=force', true],
    [false, '?cx-motion=force', true],
  ])('script and function agree (reduce=%s, search=%j)', (reduce, search, expected) => {
    stubReducedMotion(reduce);
    setSearch(search);
    runScript();
    const fromScript = flagged();
    const forcedByScript = window.sessionStorage.getItem('cx-motion');

    clearMotionFlag();
    window.sessionStorage.clear();
    const fromFunction = setMotionFlag();

    expect(fromScript).toBe(expected);
    expect(fromFunction).toBe(expected);
    expect(window.sessionStorage.getItem('cx-motion')).toBe(forcedByScript);
  });

  it('never throws without matchMedia or storage', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => runScript()).not.toThrow();
    expect(setMotionFlag()).toBe(false);
    expect(flagged()).toBe(false);
  });
});
