import { afterEach, describe, expect, it, vi } from 'vitest';
import { isScrollLocked, lockScroll } from './scrollLock';

// QA 2026-11-14 #10: the page behind a lightbox scrolled on wheel / touch,
// because <html overflow-x: clip> stops body { overflow: hidden } from
// reaching the viewport. The lock pins the body and restores the position.

afterEach(() => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
});

describe('lockScroll', () => {
  it('pins the body at the current offset and hides overflow on <html> and <body>', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(640);
    const unlock = lockScroll();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-640px');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    unlock();
  });

  it('restores the previous inline styles and the exact scroll position (instant)', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1200);
    document.body.style.overflow = 'auto';
    document.documentElement.style.scrollBehavior = 'smooth';
    const behaviours: string[] = [];
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
      behaviours.push(document.documentElement.style.scrollBehavior);
    });
    const unlock = lockScroll();
    unlock();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('');
    expect(scrollTo).toHaveBeenCalledWith(0, 1200);
    // The jump back is not animated by html { scroll-behavior: smooth }.
    expect(behaviours).toEqual(['auto']);
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
  });

  it('is reference-counted: the page is released by the last unlock only', () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    expect(isScrollLocked()).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    a(); // a second call of the same unlock is a no-op
    expect(isScrollLocked()).toBe(true);
    b();
    expect(isScrollLocked()).toBe(false);
    expect(document.body.style.position).toBe('');
  });
});
