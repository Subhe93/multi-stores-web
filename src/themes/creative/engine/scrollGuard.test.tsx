import { afterEach, describe, expect, it, vi } from 'vitest';
import { isScrollLocked, subscribeScrollLock } from './scrollGuard';

// MutationObserver callbacks are microtasks.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function unlock() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.documentElement.style.overflow = '';
}

describe('scroll guard', () => {
  afterEach(async () => {
    unlock();
    await flush();
  });

  it('recognises the three lock shapes used by the store', () => {
    expect(isScrollLocked()).toBe(false);

    // Cart drawer, cookie dialog.
    document.body.style.overflow = 'hidden';
    expect(isScrollLocked()).toBe(true);
    unlock();

    // lib/scrollLock.ts (mobile menu, lightbox).
    document.body.style.position = 'fixed';
    document.body.style.top = '-420px';
    expect(isScrollLocked()).toBe(true);
    unlock();

    document.documentElement.style.overflow = 'hidden';
    expect(isScrollLocked()).toBe(true);
    unlock();

    expect(isScrollLocked()).toBe(false);
  });

  it('reports lock and unlock once each', async () => {
    const cb = vi.fn();
    const off = subscribeScrollLock(cb);

    document.body.style.overflow = 'hidden';
    await flush();
    expect(cb).toHaveBeenLastCalledWith(true);

    // A second lock on top of the first changes nothing.
    document.body.style.position = 'fixed';
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);

    unlock();
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(false);
    off();
  });

  it('ignores style changes that are not a lock', async () => {
    const cb = vi.fn();
    const off = subscribeScrollLock(cb);
    document.body.style.paddingRight = '15px';
    document.documentElement.style.scrollBehavior = 'auto';
    await flush();
    expect(cb).not.toHaveBeenCalled();
    document.body.style.paddingRight = '';
    document.documentElement.style.scrollBehavior = '';
    off();
  });

  it('shares one observer and disconnects it with the last subscriber', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const a = vi.fn();
    const b = vi.fn();

    const offA = subscribeScrollLock(a);
    const offB = subscribeScrollLock(b);
    // body + html, once.
    expect(observe).toHaveBeenCalledTimes(2);

    document.body.style.overflow = 'hidden';
    await flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    expect(disconnect).not.toHaveBeenCalled();
    unlock();
    await flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);

    offB();
    expect(disconnect).toHaveBeenCalledTimes(1);
    // Calling a cleanup twice is harmless.
    offB();
    expect(disconnect).toHaveBeenCalledTimes(1);

    document.body.style.overflow = 'hidden';
    await flush();
    expect(b).toHaveBeenCalledTimes(2);

    observe.mockRestore();
    disconnect.mockRestore();
  });

  it('a new subscriber after a full release starts from the current state', async () => {
    document.body.style.overflow = 'hidden';
    const cb = vi.fn();
    const off = subscribeScrollLock(cb);
    await flush();
    // Already locked when subscribing: no call until it changes.
    expect(cb).not.toHaveBeenCalled();
    unlock();
    await flush();
    expect(cb).toHaveBeenCalledWith(false);
    off();
  });
});
