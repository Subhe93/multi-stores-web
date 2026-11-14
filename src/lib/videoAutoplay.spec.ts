// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetAutoplayForTests,
  autoplayBlockedByUser,
  holdAutoplay,
  registerAutoplay,
} from './videoAutoplay';

// Muted autoplay rules (product-video CONTRACT-AUTOPLAY A3 / 6.3).

type IOCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;
let ioCallback: IOCallback | null = null;

class FakeIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function see(el: Element, ratio: number) {
  ioCallback?.([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
}

function setMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }));
  window.matchMedia = globalThis.matchMedia;
}

function setConnection(conn: Record<string, unknown> | undefined) {
  Object.defineProperty(navigator, 'connection', { value: conn, configurable: true });
}

describe('autoplayBlockedByUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setConnection(undefined);
  });

  it('is false with no preference and a normal connection', () => {
    setMatchMedia(false);
    setConnection({ effectiveType: '4g', saveData: false });
    expect(autoplayBlockedByUser()).toBe(false);
  });

  it('is blocked by prefers-reduced-motion', () => {
    setMatchMedia(true);
    expect(autoplayBlockedByUser()).toBe(true);
  });

  it('is blocked by Save-Data and by 2g / slow-2g', () => {
    setMatchMedia(false);
    setConnection({ saveData: true });
    expect(autoplayBlockedByUser()).toBe(true);
    setConnection({ effectiveType: '2g' });
    expect(autoplayBlockedByUser()).toBe(true);
    setConnection({ effectiveType: 'slow-2g' });
    expect(autoplayBlockedByUser()).toBe(true);
    setConnection({ effectiveType: '3g' });
    expect(autoplayBlockedByUser()).toBe(false);
  });
});

describe('registerAutoplay coordinator', () => {
  beforeEach(() => {
    __resetAutoplayForTests();
    ioCallback = null;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });
  afterEach(() => {
    __resetAutoplayForTests();
    vi.unstubAllGlobals();
  });

  function els() {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    return { a, b };
  }

  it('grants the most visible video (>= 50 %) and switches on ratio change', () => {
    const { a, b } = els();
    const ga = vi.fn();
    const gb = vi.fn();
    registerAutoplay('a', a, ga);
    registerAutoplay('b', b, gb);
    see(a, 0.4);
    expect(ga).not.toHaveBeenCalled();
    see(a, 0.6);
    expect(ga).toHaveBeenLastCalledWith(true);
    see(b, 0.9);
    expect(ga).toHaveBeenLastCalledWith(false);
    expect(gb).toHaveBeenLastCalledWith(true);
    see(b, 0);
    expect(gb).toHaveBeenLastCalledWith(false);
    expect(ga).toHaveBeenLastCalledWith(true);
  });

  it('a tie goes to the earlier element in document order', () => {
    const { a, b } = els();
    const ga = vi.fn();
    const gb = vi.fn();
    registerAutoplay('b', b, gb);
    registerAutoplay('a', a, ga);
    see(b, 1);
    see(a, 1);
    expect(ga).toHaveBeenLastCalledWith(true);
    expect(gb).toHaveBeenLastCalledWith(false);
  });

  it('nobody is granted while a hold is active', () => {
    const { a } = els();
    const ga = vi.fn();
    registerAutoplay('a', a, ga);
    see(a, 1);
    expect(ga).toHaveBeenLastCalledWith(true);
    const release = holdAutoplay();
    expect(ga).toHaveBeenLastCalledWith(false);
    const release2 = holdAutoplay();
    release();
    expect(ga).toHaveBeenLastCalledWith(false);
    release2();
    expect(ga).toHaveBeenLastCalledWith(true);
  });

  it('nobody is granted while the tab is hidden', () => {
    const { a } = els();
    const ga = vi.fn();
    registerAutoplay('a', a, ga);
    see(a, 1);
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ga).toHaveBeenLastCalledWith(false);
    spy.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ga).toHaveBeenLastCalledWith(true);
    spy.mockRestore();
  });

  it('unregistering the winner hands autoplay to the next candidate', () => {
    const { a, b } = els();
    const ga = vi.fn();
    const gb = vi.fn();
    const offA = registerAutoplay('a', a, ga);
    registerAutoplay('b', b, gb);
    see(a, 1);
    see(b, 0.7);
    offA();
    expect(gb).toHaveBeenLastCalledWith(true);
  });

  it('is a no-op without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    __resetAutoplayForTests();
    const { a } = els();
    const ga = vi.fn();
    const off = registerAutoplay('a', a, ga);
    expect(typeof off).toBe('function');
    off();
    expect(ga).not.toHaveBeenCalled();
  });
});
